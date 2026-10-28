//! MCP 도구가 쓰는 로컬 파일 접근 (올릴 파일 읽기, 최근 다운로드, Claude 연결 안내)

use serde::Serialize;
use std::path::Path;

const READ_CAP: u64 = 200 * 1024 * 1024;

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

#[tauri::command]
pub fn recent_files(dir: String, limit: usize) -> Result<Vec<LocalFile>, String> {
    list_recent(Path::new(&dir), limit)
}

#[tauri::command]
pub fn exe_path() -> String {
    std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default()
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
