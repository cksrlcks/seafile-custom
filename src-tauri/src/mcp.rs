//! Claude(MCP) 연결. Claude ─stdio─ `U-Drive --mcp`(relay) ─TCP─ 앱의 Hub ─이벤트─ WebView(JS가 MCP 처리)

use std::collections::HashSet;
use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

/// 앱과 relay가 함께 보는 접속 정보 위치 (Tauri app_config_dir과 같은 곳)
pub fn mcp_json_path() -> Option<PathBuf> {
    let base = if cfg!(windows) {
        PathBuf::from(std::env::var_os("APPDATA")?)
    } else if cfg!(target_os = "macos") {
        PathBuf::from(std::env::var_os("HOME")?).join("Library/Application Support")
    } else {
        std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).or_else(|| Some(PathBuf::from(std::env::var_os("HOME")?).join(".config")))?
    };
    Some(base.join("com.chang.seadrive").join("mcp.json"))
}

/// 127.0.0.1의 줄 단위 TCP 서버. 첫 줄이 토큰이어야 하고, 이후 줄은 on_line(연결 id, 줄)로 넘긴다.
/// WebView가 준비되기 전(set_ready 전)에 온 줄은 쌓아 뒀다가 준비되면 순서대로 넘긴다.
pub struct Hub {
    token: String,
    on_line: Box<dyn Fn(u64, String) + Send + Sync>,
    conns: Mutex<std::collections::HashMap<u64, TcpStream>>,
    /// Some = 아직 준비 전(쌓인 줄), None = 준비됨
    pending: Mutex<Option<Vec<(u64, String)>>>,
    /// WebView에 넘겼지만 아직 답이 없는 요청 (연결, JSON id). 새로고침 때 오류로 끝내려고 기억한다
    inflight: Mutex<HashSet<(u64, String)>>,
}

impl Hub {
    pub fn start(token: String, on_line: impl Fn(u64, String) + Send + Sync + 'static) -> io::Result<(Arc<Hub>, u16)> {
        let listener = TcpListener::bind("127.0.0.1:0")?;
        let port = listener.local_addr()?.port();
        let hub = Arc::new(Hub { token, on_line: Box::new(on_line), conns: Default::default(), pending: Mutex::new(Some(Vec::new())), inflight: Default::default() });
        let h = hub.clone();
        std::thread::spawn(move || {
            for (id, stream) in (1u64..).zip(listener.incoming()) {
                let Ok(stream) = stream else { continue };
                let h = h.clone();
                std::thread::spawn(move || h.serve(id, stream));
            }
        });
        Ok((hub, port))
    }

    fn serve(&self, id: u64, stream: TcpStream) {
        let Ok(write) = stream.try_clone() else { return };
        let mut lines = BufReader::new(stream).lines();
        match lines.next() {
            Some(Ok(t)) if t.trim_end() == self.token => {}
            _ => return, // 토큰이 틀리면 두 핸들이 모두 drop되어 연결이 닫힌다
        }
        self.conns.lock().unwrap().insert(id, write);
        for line in lines {
            let Ok(line) = line else { break };
            let line = line.trim_end_matches('\r');
            if !line.is_empty() {
                self.dispatch(id, line.to_string());
            }
        }
        self.conns.lock().unwrap().remove(&id);
    }

    fn dispatch(&self, id: u64, line: String) {
        if let Some(rid) = rpc_id(&line, true) {
            self.inflight.lock().unwrap().insert((id, rid));
        }
        let mut p = self.pending.lock().unwrap();
        match p.as_mut() {
            Some(buf) => buf.push((id, line)),
            None => {
                drop(p);
                (self.on_line)(id, line);
            }
        }
    }

    /// WebView가 mcp-request를 들을 준비가 됐다. 쌓인 줄을 넘긴다(잠금을 쥔 채라 새 줄이 앞지르지 않는다)
    pub fn set_ready(&self) {
        let mut p = self.pending.lock().unwrap();
        for (id, line) in p.take().into_iter().flatten() {
            (self.on_line)(id, line);
        }
    }

    pub fn respond(&self, conn: u64, line: &str) -> io::Result<()> {
        if let Some(rid) = rpc_id(line, false) {
            self.inflight.lock().unwrap().remove(&(conn, rid));
        }
        let mut conns = self.conns.lock().unwrap();
        let s = conns.get_mut(&conn).ok_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "연결이 끊겼습니다"))?;
        s.write_all(format!("{line}\n").as_bytes())
    }

    /// WebView가 새로 로드되기 시작했다: 답을 기다리던 요청은 오류로 끝내고, 새 페이지가 mcp_ready할 때까지 다시 쌓는다
    pub fn reset(&self) {
        let mut p = self.pending.lock().unwrap();
        if p.is_none() {
            *p = Some(Vec::new());
        }
        drop(p);
        let lost: Vec<(u64, String)> = self.inflight.lock().unwrap().drain().collect();
        for (conn, rid) in lost {
            let _ = self.respond(conn, &rpc_error(&rid, "U-Drive 앱 화면이 다시 시작됐습니다. 다시 시도해 주세요."));
        }
    }
}

fn rpc_error(id: &str, message: &str) -> String {
    format!(r#"{{"jsonrpc":"2.0","id":{id},"error":{{"code":-32000,"message":"{message}"}}}}"#)
}

/// JSON-RPC 줄에서 id(JSON 표기). 요청이면 method가 있고, 응답이면 없다
fn rpc_id(line: &str, request: bool) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if v.get("method").is_some() != request {
        return None;
    }
    v.get("id").filter(|id| !id.is_null()).map(|id| id.to_string())
}

struct Shared<W> {
    out: Mutex<W>,
    /// 응답을 기다리는 요청 id
    pending: Mutex<HashSet<String>>,
    cv: Condvar,
    /// 살아 있는 연결 번호. 0 = 연결 없음
    live: AtomicU64,
}

impl<W: Write> Shared<W> {
    fn emit(&self, line: &str) {
        let mut o = self.out.lock().unwrap();
        let _ = writeln!(o, "{line}");
        let _ = o.flush();
    }

    /// 응답을 못 받게 된 요청마다 오류로 답한다
    fn fail_pending(&self) {
        let ids: Vec<String> = self.pending.lock().unwrap().drain().collect();
        for id in ids {
            self.emit(&rpc_error(&id, "U-Drive 앱과 연결이 끊겼습니다. 다시 시도해 주세요."));
        }
        self.cv.notify_all();
    }

    /// 연결 gen이 아직 살아 있으면 끊긴 것으로 표시하고 대기 요청을 실패시킨다(이미 새 연결이면 무시)
    fn drop_conn(&self, conn_no: u64) {
        if self.live.compare_exchange(conn_no, 0, Ordering::SeqCst, Ordering::SeqCst).is_ok() {
            self.fail_pending();
        }
    }
}

/// stdin 줄을 앱으로, 앱의 줄을 stdout으로 그대로 옮긴다. 연결이 끊기면 다음 줄에서 connect()로 다시 붙는다.
/// connect는 토큰 줄까지 보낸 소켓을 돌려준다. 입력이 끝나면 대기 중인 응답을 최대 5초 기다린다.
pub fn relay_io(input: impl BufRead, output: impl Write + Send + 'static, mut connect: impl FnMut() -> io::Result<TcpStream>) -> io::Result<()> {
    let sh = Arc::new(Shared { out: Mutex::new(output), pending: Default::default(), cv: Condvar::new(), live: AtomicU64::new(0) });
    let mut sock: Option<(u64, TcpStream)> = None;
    let mut gens = 0u64;
    for line in input.lines() {
        let line = line?;
        let line = line.trim_start_matches('\u{feff}').trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }
        if let Some(id) = rpc_id(line, true) {
            sh.pending.lock().unwrap().insert(id);
        }
        if sock.as_ref().map_or(true, |(g, _)| sh.live.load(Ordering::SeqCst) != *g) {
            sock = None;
            match connect() {
                Ok(s) => {
                    gens += 1;
                    let conn_no = gens;
                    sh.live.store(conn_no, Ordering::SeqCst);
                    let reader = s.try_clone()?;
                    let sh2 = sh.clone();
                    std::thread::spawn(move || {
                        for l in BufReader::new(reader).lines() {
                            let Ok(l) = l else { break };
                            if let Some(id) = rpc_id(&l, false) {
                                sh2.pending.lock().unwrap().remove(&id);
                            }
                            sh2.emit(&l);
                            sh2.cv.notify_all();
                        }
                        sh2.drop_conn(conn_no);
                    });
                    sock = Some((conn_no, s));
                }
                Err(e) => {
                    eprintln!("U-Drive 앱에 연결하지 못했습니다: {e}");
                    sh.fail_pending();
                    continue;
                }
            }
        }
        let (conn_no, s) = sock.as_mut().unwrap();
        if writeln!(s, "{line}").is_err() {
            sh.drop_conn(*conn_no);
        }
    }
    let p = sh.pending.lock().unwrap();
    let _ = sh.cv.wait_timeout_while(p, Duration::from_secs(5), |p| !p.is_empty());
    Ok(())
}

/// mcp.json을 읽어 앱에 붙고 토큰을 보낸다. 앱이 없으면 트레이로 띄우고 15초간 기다린다
fn connect_app() -> io::Result<TcpStream> {
    fn try_once() -> io::Result<TcpStream> {
        let path = mcp_json_path().ok_or_else(|| io::Error::other("설정 폴더를 찾을 수 없습니다"))?;
        let v: serde_json::Value = serde_json::from_slice(&std::fs::read(path)?)?;
        let port = v["port"].as_u64().ok_or_else(|| io::Error::other("mcp.json에 port가 없습니다"))? as u16;
        let mut s = TcpStream::connect(("127.0.0.1", port))?;
        writeln!(s, "{}", v["token"].as_str().unwrap_or_default())?;
        Ok(s)
    }
    let deadline = Instant::now() + Duration::from_secs(15);
    let mut launched = false;
    loop {
        match try_once() {
            Ok(s) => return Ok(s),
            Err(e) if Instant::now() > deadline => return Err(e),
            Err(_) => {}
        }
        if !launched {
            launched = true;
            autostart_command()?.spawn()?;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

/// 앱을 트레이로 띄우는 명령. 중계의 stdio(Claude의 파이프)와 작업 폴더(Claude의 프로젝트)를 물려주지 않는다
fn autostart_command() -> io::Result<std::process::Command> {
    use std::process::Stdio;
    let exe = std::env::current_exe()?;
    let mut cmd = std::process::Command::new(&exe);
    cmd.arg("--autostart").stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    if let Some(dir) = exe.parent() {
        cmd.current_dir(dir);
    }
    Ok(cmd)
}

/// `U-Drive --mcp` 진입점. 종료 코드를 돌려준다
pub fn relay() -> i32 {
    match relay_io(io::stdin().lock(), io::stdout(), connect_app) {
        Ok(()) => 0,
        Err(e) => {
            eprintln!("{e}");
            1
        }
    }
}

/// 32자리 hex. ponytail: 표준 라이브러리 RandomState(OS 시드)로 만든다. 더 강한 난수가 필요하면 getrandom 크레이트로 교체
fn new_token() -> String {
    use std::hash::{BuildHasher, Hasher};
    let part = || {
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
        h.write_u32(std::process::id());
        h.finish()
    };
    format!("{:016x}{:016x}", part(), part())
}

/// 앱 시작 시: Hub를 띄우고 mcp.json에 포트·토큰을 쓴다. 받은 줄은 mcp-request 이벤트로 WebView에 넘긴다
pub fn setup(app: &AppHandle) {
    let token = new_token();
    let handle = app.clone();
    let started = Hub::start(token.clone(), move |conn, line| {
        let _ = handle.emit("mcp-request", serde_json::json!({ "conn": conn, "line": line }));
    });
    let (hub, port) = match started {
        Ok(v) => v,
        Err(e) => return eprintln!("MCP 리스너를 열지 못했습니다: {e}"),
    };
    if let Some(path) = mcp_json_path() {
        let _ = std::fs::create_dir_all(path.parent().unwrap());
        let _ = std::fs::write(&path, serde_json::json!({ "port": port, "token": token }).to_string());
    }
    app.manage(hub);
}

#[tauri::command]
pub fn mcp_ready(hub: State<Arc<Hub>>) {
    hub.set_ready();
}

#[tauri::command]
pub fn mcp_respond(hub: State<Arc<Hub>>, conn: u64, line: String) -> Result<(), String> {
    hub.respond(conn, &line).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;
    use std::sync::OnceLock;

    fn wait_until(mut ok: impl FnMut() -> bool) -> bool {
        let end = Instant::now() + Duration::from_secs(3);
        while Instant::now() < end {
            if ok() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        false
    }

    type Seen = Arc<Mutex<Vec<(u64, String)>>>;

    fn recording_hub() -> (Arc<Hub>, u16, Seen) {
        let seen: Seen = Default::default();
        let s = seen.clone();
        let (hub, port) = Hub::start("tok".into(), move |c, l| s.lock().unwrap().push((c, l))).unwrap();
        (hub, port, seen)
    }

    fn client(port: u16, token: &str) -> TcpStream {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        writeln!(s, "{token}").unwrap();
        s
    }

    #[derive(Clone, Default)]
    struct Out(Arc<Mutex<Vec<u8>>>);
    impl Write for Out {
        fn write(&mut self, b: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(b);
            Ok(b.len())
        }
        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }
    impl Out {
        fn text(&self) -> String {
            String::from_utf8(self.0.lock().unwrap().clone()).unwrap()
        }
    }

    #[test]
    fn hub_rejects_wrong_token() {
        let (hub, port, seen) = recording_hub();
        hub.set_ready();
        let mut s = client(port, "wrong");
        writeln!(s, "hello").unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let mut buf = [0u8; 8];
        assert_eq!(s.read(&mut buf).unwrap_or(0), 0);
        assert!(seen.lock().unwrap().is_empty());
    }

    #[test]
    fn hub_buffers_until_ready() {
        let (hub, port, seen) = recording_hub();
        let mut s = client(port, "tok");
        writeln!(s, "a\nb").unwrap();
        std::thread::sleep(Duration::from_millis(200));
        assert!(seen.lock().unwrap().is_empty());
        hub.set_ready();
        assert!(wait_until(|| seen.lock().unwrap().len() == 2));
        let got: Vec<String> = seen.lock().unwrap().iter().map(|(_, l)| l.clone()).collect();
        assert_eq!(got, ["a", "b"]);
    }

    #[test]
    fn hub_routes_two_connections() {
        let (hub, port, seen) = recording_hub();
        hub.set_ready();
        let mut a = client(port, "tok");
        let mut b = client(port, "tok");
        writeln!(a, "from-a").unwrap();
        writeln!(b, "from-b").unwrap();
        assert!(wait_until(|| seen.lock().unwrap().len() == 2));
        let conn_of = |l: &str| seen.lock().unwrap().iter().find(|(_, x)| x == l).unwrap().0;
        hub.respond(conn_of("from-a"), "x").unwrap();
        hub.respond(conn_of("from-b"), "y").unwrap();
        let mut ra = BufReader::new(a.try_clone().unwrap());
        let mut rb = BufReader::new(b.try_clone().unwrap());
        let (mut la, mut lb) = (String::new(), String::new());
        ra.read_line(&mut la).unwrap();
        rb.read_line(&mut lb).unwrap();
        assert_eq!((la.as_str(), lb.as_str()), ("x\n", "y\n"));
    }

    #[test]
    fn hub_strips_crlf() {
        let (hub, port, seen) = recording_hub();
        hub.set_ready();
        let mut s = client(port, "tok");
        s.write_all(b"{\"id\":1}\r\n\r\n").unwrap();
        assert!(wait_until(|| !seen.lock().unwrap().is_empty()));
        std::thread::sleep(Duration::from_millis(100));
        let got: Vec<String> = seen.lock().unwrap().iter().map(|(_, l)| l.clone()).collect();
        assert_eq!(got, ["{\"id\":1}"]);
    }

    #[test]
    fn autostart_detaches_from_relay() {
        // 앱이 Claude의 작업 폴더를 붙잡지 않도록 실행 파일 폴더에서 시작한다(stdio는 null로 끊는다)
        let cmd = autostart_command().unwrap();
        let exe = std::env::current_exe().unwrap();
        assert_eq!(cmd.get_program(), exe.as_os_str());
        assert_eq!(cmd.get_args().collect::<Vec<_>>(), ["--autostart"]);
        assert_eq!(cmd.get_current_dir(), exe.parent());
    }

    #[test]
    fn hub_reset_fails_inflight_and_rebuffers() {
        // WebView 새로고침: 답을 기다리던 요청은 오류로 끝내고, 새 페이지가 준비될 때까지 다시 쌓는다
        let (hub, port, seen) = recording_hub();
        hub.set_ready();
        let mut s = client(port, "tok");
        writeln!(s, r#"{{"jsonrpc":"2.0","id":5,"method":"tools/call"}}"#).unwrap();
        writeln!(s, r#"{{"jsonrpc":"2.0","id":6,"method":"ping"}}"#).unwrap();
        assert!(wait_until(|| seen.lock().unwrap().len() == 2));
        let conn = seen.lock().unwrap()[0].0;
        hub.respond(conn, r#"{"jsonrpc":"2.0","id":6,"result":{}}"#).unwrap();
        hub.reset();
        let mut r = BufReader::new(s.try_clone().unwrap());
        let (mut first, mut second) = (String::new(), String::new());
        r.read_line(&mut first).unwrap();
        r.read_line(&mut second).unwrap();
        assert!(first.contains("\"id\":6") && first.contains("result"), "{first}");
        assert!(second.contains("\"id\":5") && second.contains("-32000"), "{second}");
        writeln!(s, "after").unwrap();
        std::thread::sleep(Duration::from_millis(200));
        assert_eq!(seen.lock().unwrap().len(), 2);
        hub.set_ready();
        assert!(wait_until(|| seen.lock().unwrap().len() == 3));
    }

    /// on_line에서 delay 뒤 id 1에 응답하는 Hub
    fn answering_hub(delay: Duration) -> u16 {
        let cell: Arc<OnceLock<Arc<Hub>>> = Default::default();
        let c = cell.clone();
        let (hub, port) = Hub::start("tok".into(), move |conn, _| {
            let c = c.clone();
            std::thread::spawn(move || {
                std::thread::sleep(delay);
                c.get().unwrap().respond(conn, r#"{"jsonrpc":"2.0","id":1,"result":{}}"#).unwrap();
            });
        })
        .unwrap();
        hub.set_ready();
        let _ = cell.set(hub);
        port
    }

    const PING: &str = "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"ping\"}\n";

    #[test]
    fn relay_roundtrip() {
        let port = answering_hub(Duration::ZERO);
        let out = Out::default();
        relay_io(PING.as_bytes(), out.clone(), || Ok(client(port, "tok"))).unwrap();
        assert_eq!(out.text(), "{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\n");
    }

    #[test]
    fn relay_waits_pending_on_eof() {
        let port = answering_hub(Duration::from_millis(200));
        let out = Out::default();
        relay_io(PING.as_bytes(), out.clone(), || Ok(client(port, "tok"))).unwrap();
        assert!(out.text().contains("\"result\""));
    }

    #[test]
    fn relay_strips_bom() {
        // .NET 등은 stdin 첫 줄 앞에 UTF-8 BOM을 붙인다. 지우지 않으면 요청으로 인식 못 해 응답을 기다리지 않고 끝난다
        let port = answering_hub(Duration::from_millis(200));
        let out = Out::default();
        relay_io(format!("\u{feff}{PING}").as_bytes(), out.clone(), || Ok(client(port, "tok"))).unwrap();
        assert!(out.text().contains("\"result\""), "{}", out.text());
    }

    #[test]
    fn relay_errors_pending_on_disconnect() {
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = server.local_addr().unwrap().port();
        std::thread::spawn(move || {
            let (s, _) = server.accept().unwrap();
            let mut r = BufReader::new(s);
            let mut l = String::new();
            r.read_line(&mut l).unwrap(); // 토큰
            r.read_line(&mut l).unwrap(); // 요청
        }); // 응답 없이 닫힘
        let out = Out::default();
        let input = "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"tools/call\"}\n";
        relay_io(input.as_bytes(), out.clone(), || Ok(client(port, "tok"))).unwrap();
        let text = out.text();
        assert!(text.contains("\"id\":7") && text.contains("-32000"), "{text}");
    }
}
