//! MCP 도구가 쓰는 로컬 파일 접근 (올릴 파일 읽기, 최근 다운로드, 작업 공간 파일 내려받기)

use serde::Serialize;
use std::path::Path;

pub(crate) const READ_CAP: u64 = 200 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalFile {
    name: String,
    path: String,
    size: u64,
    /// 유닉스 초
    mtime: f64,
}

/// 파일 전체를 읽는다. cap을 넘으면 거절(문구는 실제 상한 200MB 기준)
fn read_capped(path: &Path, cap: u64) -> Result<Vec<u8>, String> {
    let meta = std::fs::metadata(path).map_err(|_| format!("파일을 찾을 수 없습니다: {}", path.display()))?;
    if meta.len() > cap {
        return Err("200MB가 넘는 파일은 U-Drive 앱에서 직접 올려 주세요".into());
    }
    std::fs::read(path).map_err(|e| e.to_string())
}

/// dir 바로 아래 파일만, 수정 시각 최신순으로 limit개
fn list_recent(dir: &Path, limit: usize) -> Result<Vec<LocalFile>, String> {
    let mut files: Vec<LocalFile> = std::fs::read_dir(dir)
        .map_err(|e| format!("{}: {e}", dir.display()))?
        .flatten()
        .filter_map(|e| {
            let m = e.metadata().ok().filter(|m| m.is_file())?;
            let mtime = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs_f64();
            Some(LocalFile { name: e.file_name().to_string_lossy().into_owned(), path: e.path().to_string_lossy().into_owned(), size: m.len(), mtime })
        })
        .collect();
    files.sort_by(|a, b| b.mtime.total_cmp(&a.mtime));
    files.truncate(limit);
    Ok(files)
}

#[tauri::command]
pub async fn read_local_file(path: String) -> Result<tauri::ipc::Response, String> {
    read_capped(Path::new(&path), READ_CAP).map(tauri::ipc::Response::new)
}

/// 새 파일로만 쓴다. 이미 있으면 거절(사용자 파일을 덮어쓰지 않게)
fn write_new(path: &Path, data: &[u8]) -> Result<(), String> {
    use std::io::Write;
    let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(path).map_err(|e| format!("{}: {e}", path.display()))?;
    f.write_all(data).map_err(|e| e.to_string())
}

/// MCP upload_base64: Claude 작업 공간의 파일을 PC 다운로드 폴더에 내려받는다
#[tauri::command]
pub async fn write_local_file(path: String, data: Vec<u8>) -> Result<(), String> {
    write_new(Path::new(&path), &data)
}

/// 심볼릭 링크를 따라간 실제 경로. 아직 없는 파일이면 부모 폴더만 따라가 이름을 붙이고, 그것도 없으면 그대로.
/// MCP가 숨김·시스템 폴더를 막을 때 링크로 돌아가지 못하게 쓴다(localPath.ts)
fn resolve(path: &Path) -> std::path::PathBuf {
    std::fs::canonicalize(path)
        .or_else(|e| match (path.parent(), path.file_name()) {
            (Some(dir), Some(name)) => std::fs::canonicalize(dir).map(|d| d.join(name)),
            _ => Err(e),
        })
        .unwrap_or_else(|_| path.to_path_buf())
}

/// 윈도우 canonicalize의 \\?\ 접두어를 뗀다(\\?\UNC\server → \\server)
fn plain(p: &str) -> String {
    if let Some(rest) = p.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else {
        p.strip_prefix(r"\\?\").unwrap_or(p).to_string()
    }
}

#[tauri::command]
pub fn real_path(path: String) -> String {
    plain(&resolve(Path::new(&path)).to_string_lossy())
}

/// 저장할 이름에서 경로 부분을 뗀다(../ 로 다른 폴더에 쓰지 못하게). 남는 게 없으면 "file"
pub(crate) fn plain_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or("").trim();
    if base.is_empty() || base == "." || base == ".." { "file".into() } else { base.to_string() }
}

#[tauri::command]
pub fn recent_files(dir: String, limit: usize) -> Result<Vec<LocalFile>, String> {
    list_recent(Path::new(&dir), limit)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("seadrive-localfs-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn read_capped_reads_korean_path() {
        let p = temp_dir("ko").join("회의 자료.txt");
        std::fs::write(&p, "안녕").unwrap();
        assert_eq!(read_capped(&p, 10).unwrap(), "안녕".as_bytes());
    }

    #[test]
    fn write_new_never_overwrites() {
        let p = temp_dir("write").join("보고서.docx");
        write_new(&p, b"hello").unwrap();
        assert_eq!(std::fs::read(&p).unwrap(), b"hello");
        assert!(write_new(&p, b"other").is_err());
        assert_eq!(std::fs::read(&p).unwrap(), b"hello");
    }

    #[test]
    fn read_capped_rejects_over_cap() {
        let p = temp_dir("cap").join("big.bin");
        std::fs::write(&p, [0u8; 11]).unwrap();
        assert!(read_capped(&p, 10).unwrap_err().contains("200MB"));
    }

    #[test]
    fn plain_name_drops_directories() {
        assert_eq!(plain_name("보고서.docx"), "보고서.docx");
        assert_eq!(plain_name("../../Library/LaunchAgents/x.plist"), "x.plist");
        assert_eq!(plain_name(r"..\..\x.bat"), "x.bat");
        assert_eq!(plain_name(".."), "file");
    }

    #[test]
    fn plain_strips_verbatim_prefix() {
        assert_eq!(plain(r"\\?\C:\Users\a"), r"C:\Users\a");
        assert_eq!(plain(r"\\?\UNC\srv\share"), r"\\srv\share");
        assert_eq!(plain("/Users/a"), "/Users/a");
    }

    #[cfg(unix)]
    #[test]
    fn resolve_follows_links() {
        let d = temp_dir("link");
        let secret = d.join(".ssh");
        std::fs::create_dir(&secret).unwrap();
        std::os::unix::fs::symlink(&secret, d.join("work")).unwrap();
        let real = std::fs::canonicalize(&secret).unwrap();
        assert_eq!(resolve(&d.join("work")), real);
        assert_eq!(resolve(&d.join("work").join("new.txt")), real.join("new.txt"));
        assert_eq!(resolve(Path::new("/no/such/dir/x")), Path::new("/no/such/dir/x"));
    }

    #[test]
    fn list_recent_sorts_and_limits() {
        let d = temp_dir("recent");
        for (i, n) in ["old.txt", "mid.txt", "new.txt"].iter().enumerate() {
            let f = std::fs::File::create(d.join(n)).unwrap();
            f.set_modified(std::time::SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_000_000 + i as u64 * 100)).unwrap();
        }
        std::fs::create_dir(d.join("folder")).unwrap();
        let names: Vec<String> = list_recent(&d, 2).unwrap().into_iter().map(|f| f.name).collect();
        assert_eq!(names, ["new.txt", "mid.txt"]);
    }
}
