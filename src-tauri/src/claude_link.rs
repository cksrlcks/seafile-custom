//! 설정 → Claude 연결: Claude Code·Claude 데스크톱 앱에 U-Drive MCP를 등록하고, 등록됐는지 확인한다

use serde::Serialize;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const CONFIG: &str = "claude_desktop_config.json";
/// Claude에 등록하는 MCP 서버 이름
const NAME: &str = "u-drive";
/// 0.9.0에서 쓰던 이름. 다시 연결할 때 이 앱을 가리키는 것만 지운다
const OLD_NAME: &str = "drive";

fn exe() -> Result<String, String> {
    std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).map_err(|e| e.to_string())
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key).map(PathBuf::from)
}

/// 설정 JSON에 mcpServers.<name>이 이 exe로 들어 있는가
fn has_server(text: &str, name: &str, exe: &str) -> bool {
    serde_json::from_str::<Value>(text).ok().and_then(|v| v.pointer(&format!("/mcpServers/{name}/command")).cloned()) == Some(json!(exe))
}

fn has_drive(text: &str, exe: &str) -> bool {
    has_server(text, NAME, exe)
}

/// 기존 설정에 mcpServers.u-drive만 넣고(이 앱의 예전 drive 항목은 지운다) 나머지는 그대로 둔다. 읽을 수 없는 파일은 덮어쓰지 않는다
fn merge_drive(existing: Option<&str>, exe: &str) -> Result<String, String> {
    let mut v: Value = match existing.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => serde_json::from_str(s).map_err(|_| "Claude 설정 파일 형식이 올바르지 않아 고치지 않았습니다".to_string())?,
        None => json!({}),
    };
    let root = v.as_object_mut().ok_or("Claude 설정 파일 형식이 올바르지 않아 고치지 않았습니다")?;
    let servers = root.entry("mcpServers").or_insert_with(|| json!({}));
    let servers = servers.as_object_mut().ok_or("Claude 설정 파일의 mcpServers 형식이 올바르지 않아 고치지 않았습니다")?;
    if servers.get(OLD_NAME).and_then(|s| s.get("command")) == Some(&json!(exe)) {
        servers.remove(OLD_NAME);
    }
    servers.insert(NAME.into(), json!({ "command": exe, "args": ["--mcp"] }));
    serde_json::to_string_pretty(&v).map_err(|e| e.to_string())
}

/// Claude 데스크톱 앱 설정 폴더 후보 중 실제로 있는 것. 하나도 없으면 기본 위치(마지막 원소) 하나.
/// Windows는 설치 방식에 따라 위치가 다르다: 최신(LOCALAPPDATA\Claude-Data\<패키지>), MSIX(Packages\Claude_*\LocalCache), 일반(APPDATA\Claude)
fn desktop_dirs(local: Option<&Path>, roaming: Option<&Path>, home: Option<&Path>) -> Vec<PathBuf> {
    let subdirs = |dir: PathBuf, prefix: &str| -> Vec<PathBuf> {
        let Ok(rd) = std::fs::read_dir(&dir) else { return vec![] };
        rd.flatten().filter(|e| e.path().is_dir() && e.file_name().to_string_lossy().starts_with(prefix)).map(|e| e.path()).collect()
    };
    let mut found = Vec::new();
    let default = if cfg!(windows) {
        if let Some(local) = local {
            found.extend(subdirs(local.join("Claude-Data"), ""));
            found.extend(subdirs(local.join("Packages"), "Claude_").into_iter().map(|p| p.join(r"LocalCache\Roaming\Claude")).filter(|p| p.is_dir()));
        }
        roaming.map(|r| r.join("Claude"))
    } else if cfg!(target_os = "macos") {
        home.map(|h| h.join("Library/Application Support/Claude"))
    } else {
        home.map(|h| h.join(".config/Claude"))
    };
    if let Some(d) = default {
        if d.is_dir() || found.is_empty() {
            found.push(d);
        }
    }
    found
}

fn desktop_config_files() -> Vec<PathBuf> {
    desktop_dirs(env_path("LOCALAPPDATA").as_deref(), env_path("APPDATA").as_deref(), env_path("HOME").or_else(|| env_path("USERPROFILE")).as_deref())
        .into_iter()
        .map(|d| d.join(CONFIG))
        .collect()
}

/// 임시 파일에 쓰고 바꿔 끼운다. 쓰다가 실패해도 원래 설정 파일은 그대로 남는다
fn write_atomic(path: &Path, text: &str) -> Result<(), String> {
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.drive-tmp");
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

fn connect_desktop_at(files: &[PathBuf], exe: &str) -> Result<(), String> {
    for f in files {
        let existing = std::fs::read_to_string(f).ok();
        write_atomic(f, &merge_drive(existing.as_deref(), exe)?)?;
    }
    Ok(())
}

/// claude 실행 파일 후보. GUI 앱은 셸 PATH를 못 물려받을 수 있어(macOS) 흔한 설치 위치를 먼저 본다
fn claude_candidates(home: Option<&Path>) -> Vec<PathBuf> {
    let mut c = Vec::new();
    if cfg!(windows) {
        if let Some(h) = home {
            c.push(h.join(r".local\bin\claude.exe"));
        }
        if let Some(a) = env_path("APPDATA") {
            c.push(a.join(r"npm\claude.cmd"));
        }
    } else {
        if let Some(h) = home {
            c.push(h.join(".local/bin/claude"));
            c.push(h.join(".claude/local/claude"));
        }
        c.push("/opt/homebrew/bin/claude".into());
        c.push("/usr/local/bin/claude".into());
    }
    c.retain(|p| p.is_file());
    c.push(if cfg!(windows) { "claude.exe" } else { "claude" }.into()); // 마지막으로 PATH에서 찾기
    c
}

fn run_claude(bin: &Path, args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut cmd = Command::new(bin);
    cmd.args(args).stdin(Stdio::null());
    #[cfg(windows)]
    std::os::windows::process::CommandExt::creation_flags(&mut cmd, 0x0800_0000); // CREATE_NO_WINDOW: 콘솔 창이 깜박이지 않게
    cmd.output()
}

#[derive(Serialize)]
pub struct ClaudeStatus {
    code: bool,
    desktop: bool,
}

#[tauri::command]
pub fn claude_status() -> Result<ClaudeStatus, String> {
    let exe = exe()?;
    let read = |p: &Path| std::fs::read_to_string(p).unwrap_or_default();
    let home = env_path("HOME").or_else(|| env_path("USERPROFILE"));
    Ok(ClaudeStatus {
        code: home.is_some_and(|h| has_drive(&read(&h.join(".claude.json")), &exe)),
        desktop: desktop_config_files().iter().any(|f| has_drive(&read(f), &exe)),
    })
}

#[tauri::command]
pub async fn connect_claude_desktop() -> Result<(), String> {
    connect_desktop_at(&desktop_config_files(), &exe()?)
}

/// `claude mcp add`로 등록한다. ~/.claude.json은 Claude Code가 수시로 다시 쓰는 파일이라 직접 고치지 않는다
#[tauri::command]
pub async fn connect_claude_code() -> Result<(), String> {
    let exe = exe()?;
    let home = env_path("HOME").or_else(|| env_path("USERPROFILE"));
    let old_is_mine = home.as_ref().is_some_and(|h| has_server(&std::fs::read_to_string(h.join(".claude.json")).unwrap_or_default(), OLD_NAME, &exe));
    for bin in claude_candidates(home.as_deref()) {
        let Ok(_) = run_claude(&bin, &["mcp", "remove", NAME, "-s", "user"]) else { continue }; // 실행이 안 되면 다음 후보. 등록이 없어서 실패한 건 괜찮다
        if old_is_mine {
            let _ = run_claude(&bin, &["mcp", "remove", OLD_NAME, "-s", "user"]);
        }
        let out = run_claude(&bin, &["mcp", "add", "--scope", "user", NAME, "--", &exe, "--mcp"]).map_err(|e| e.to_string())?;
        if out.status.success() {
            return Ok(());
        }
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Err("claude 명령을 찾지 못했습니다".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("seadrive-claude-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn merge_keeps_other_settings_and_order() {
        let before = r#"{"preferences":{"a":1},"mcpServers":{"other":{"command":"x"}},"z":true}"#;
        let after = merge_drive(Some(before), r"C:\D\seadrive.exe").unwrap();
        let v: Value = serde_json::from_str(&after).unwrap();
        assert_eq!(v["preferences"]["a"], 1);
        assert_eq!(v["mcpServers"]["other"]["command"], "x");
        assert_eq!(v["mcpServers"][NAME], json!({ "command": r"C:\D\seadrive.exe", "args": ["--mcp"] }));
        assert!(after.find("preferences").unwrap() < after.find("\"z\"").unwrap(), "키 순서를 유지한다");
        assert!(has_drive(&after, r"C:\D\seadrive.exe"));
        assert!(!has_drive(&after, r"C:\other.exe"));
    }

    #[test]
    fn merge_replaces_old_name_only_if_it_is_this_app() {
        let mine = merge_drive(Some(r#"{"mcpServers":{"drive":{"command":"/a/Drive","args":["--mcp"]}}}"#), "/a/Drive").unwrap();
        let v: Value = serde_json::from_str(&mine).unwrap();
        assert!(v["mcpServers"].get(OLD_NAME).is_none(), "0.9.0에서 등록한 이 앱의 drive 항목은 지운다");
        assert!(has_drive(&mine, "/a/Drive"));

        let other = merge_drive(Some(r#"{"mcpServers":{"drive":{"command":"/other/tool"}}}"#), "/a/Drive").unwrap();
        let v: Value = serde_json::from_str(&other).unwrap();
        assert_eq!(v["mcpServers"][OLD_NAME]["command"], "/other/tool", "다른 프로그램의 drive 항목은 그대로 둔다");
    }

    #[test]
    fn merge_creates_from_empty_and_refuses_broken() {
        assert!(has_drive(&merge_drive(None, "/a/Drive").unwrap(), "/a/Drive"));
        assert!(has_drive(&merge_drive(Some("  "), "/a/Drive").unwrap(), "/a/Drive"));
        assert!(merge_drive(Some("{ broken"), "/a/Drive").is_err());
        assert!(merge_drive(Some("[]"), "/a/Drive").is_err());
        assert!(merge_drive(Some(r#"{"mcpServers":[]}"#), "/a/Drive").is_err());
    }

    #[test]
    fn connect_writes_every_file_and_leaves_broken_one() {
        let d = temp_dir("connect");
        let a = d.join("a").join(CONFIG);
        connect_desktop_at(&[a.clone()], "/x/Drive").unwrap();
        assert!(has_drive(&std::fs::read_to_string(&a).unwrap(), "/x/Drive"));

        let b = d.join(CONFIG);
        std::fs::write(&b, "{ broken").unwrap();
        assert!(connect_desktop_at(&[b.clone()], "/x/Drive").is_err());
        assert_eq!(std::fs::read_to_string(&b).unwrap(), "{ broken");
    }

    #[cfg(windows)]
    #[test]
    fn desktop_dirs_finds_every_install_kind() {
        let d = temp_dir("dirs");
        let (local, roaming) = (d.join("Local"), d.join("Roaming"));
        // 아무것도 없으면 기본 위치 하나
        assert_eq!(desktop_dirs(Some(&local), Some(&roaming), None), vec![roaming.join("Claude")]);

        let data = local.join(r"Claude-Data\claude_abc");
        let msix = local.join(r"Packages\Claude_abc\LocalCache\Roaming\Claude");
        std::fs::create_dir_all(&data).unwrap();
        std::fs::create_dir_all(&msix).unwrap();
        std::fs::create_dir_all(local.join(r"Packages\Other_abc\LocalCache\Roaming\Claude")).unwrap();
        // 기본 위치가 없으면 찾은 것만
        assert_eq!(desktop_dirs(Some(&local), Some(&roaming), None), vec![data.clone(), msix.clone()]);

        std::fs::create_dir_all(roaming.join("Claude")).unwrap();
        assert_eq!(desktop_dirs(Some(&local), Some(&roaming), None), vec![data, msix, roaming.join("Claude")]);
    }
}
