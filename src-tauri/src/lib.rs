use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_opener::OpenerExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 윈도우 셸이 쓰는 파일/폴더 아이콘을 PNG(RGBA)로. 탐색기와 같은 그림. ext는 확장자(없으면 ""), dir이면 폴더.
/// size: 16·32·48 중 하나로 올림. async라 메인 스레드를 막지 않는다.
#[tauri::command]
async fn file_icon(ext: String, dir: bool, size: u32) -> Result<tauri::ipc::Response, String> {
    shell_icon::png(&ext, dir, size).map(tauri::ipc::Response::new)
}

#[cfg(not(windows))]
mod shell_icon {
    pub fn png(_ext: &str, _dir: bool, _size: u32) -> Result<Vec<u8>, String> {
        Err("unsupported".into())
    }
}

#[cfg(windows)]
mod shell_icon {
    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{DeleteObject, GetDC, GetDIBits, ReleaseDC, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS};
    use windows::Win32::Storage::FileSystem::{FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL};
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Controls::{IImageList, ILD_TRANSPARENT};
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHGetImageList, SHFILEINFOW, SHGFI_SYSICONINDEX, SHGFI_USEFILEATTRIBUTES, SHIL_EXTRALARGE, SHIL_LARGE, SHIL_SMALL};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO};

    pub fn png(ext: &str, dir: bool, size: u32) -> Result<Vec<u8>, String> {
        // USEFILEATTRIBUTES: 실제 파일 없이 이름의 확장자만 보고 연결된 아이콘을 찾는다
        let name = if dir { "folder".to_string() } else if ext.is_empty() { "file".to_string() } else { format!("file.{ext}") };
        let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
        let attrs = if dir { FILE_ATTRIBUTE_DIRECTORY } else { FILE_ATTRIBUTE_NORMAL };
        let shil = if size <= 16 { SHIL_SMALL } else if size <= 32 { SHIL_LARGE } else { SHIL_EXTRALARGE };
        unsafe {
            let com = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
            let result = (|| {
                let mut info = SHFILEINFOW::default();
                let ok = SHGetFileInfoW(PCWSTR(wide.as_ptr()), attrs, Some(&mut info), std::mem::size_of::<SHFILEINFOW>() as u32, SHGFI_SYSICONINDEX | SHGFI_USEFILEATTRIBUTES);
                if ok == 0 {
                    return Err("SHGetFileInfoW".to_string());
                }
                let list: IImageList = SHGetImageList(shil as i32).map_err(|e| e.to_string())?;
                let hicon = list.GetIcon(info.iIcon, ILD_TRANSPARENT.0).map_err(|e| e.to_string())?;
                let out = icon_to_png(hicon);
                let _ = DestroyIcon(hicon);
                out
            })();
            if com {
                CoUninitialize();
            }
            result
        }
    }

    fn icon_to_png(hicon: HICON) -> Result<Vec<u8>, String> {
        let mut ii = ICONINFO::default();
        let (w, h, mut px, rows) = unsafe {
            GetIconInfo(hicon, &mut ii).map_err(|e| e.to_string())?;
            let hdc = GetDC(None);
            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
            GetDIBits(hdc, ii.hbmColor, 0, 0, None, &mut bmi, DIB_RGB_COLORS); // 크기만 받는다
            let (w, h) = (bmi.bmiHeader.biWidth, bmi.bmiHeader.biHeight.abs());
            bmi.bmiHeader.biHeight = -h; // top-down
            bmi.bmiHeader.biBitCount = 32;
            bmi.bmiHeader.biCompression = BI_RGB.0;
            bmi.bmiHeader.biSizeImage = 0;
            let mut px = vec![0u8; (w.max(0) * h.max(0) * 4) as usize];
            let rows = GetDIBits(hdc, ii.hbmColor, 0, h as u32, Some(px.as_mut_ptr() as *mut _), &mut bmi, DIB_RGB_COLORS);
            ReleaseDC(None, hdc);
            let _ = DeleteObject(ii.hbmColor.into());
            let _ = DeleteObject(ii.hbmMask.into());
            (w, h, px, rows)
        };
        if rows == 0 || w <= 0 || h <= 0 {
            return Err("GetDIBits".to_string());
        }
        // BGRA → RGBA. shortcut: 알파 채널이 없는 구형 아이콘(전부 0)은 불투명 처리, 문제 되면 hbmMask로 투명 적용
        let opaque = px.chunks(4).all(|p| p[3] == 0);
        for p in px.chunks_mut(4) {
            p.swap(0, 2);
            if opaque {
                p[3] = 255;
            }
        }
        let mut out = Vec::new();
        let mut enc = png::Encoder::new(&mut out, w as u32, h as u32);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        enc.write_header().and_then(|mut wr| wr.write_image_data(&px)).map_err(|e| e.to_string())?;
        Ok(out)
    }
}

/// 창 닫기는 트레이로 숨기기만 하므로, 실제 종료는 이 커맨드로
#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let item = |id: &str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
            let sep = || PredefinedMenuItem::separator(app);
            let version = MenuItem::new(app, format!("Drive v{}", app.package_info().version), false, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &item("open", "Drive 열기")?,
                    &sep()?,
                    &item("upload", "파일 업로드…")?,
                    &item("refresh", "새로고침")?,
                    &item("downloads", "다운로드 폴더 열기")?,
                    &sep()?,
                    &item("settings", "설정…")?,
                    &item("logout", "로그아웃")?,
                    &sep()?,
                    &version,
                    &item("quit", "종료")?,
                ],
            )?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Drive")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => app.exit(0),
                    "downloads" => {
                        if let Ok(dir) = app.path().download_dir() {
                            let _ = app.opener().open_path(dir.to_string_lossy(), None::<&str>);
                        }
                    }
                    // 나머지는 화면 쪽 동작: 창을 띄우고 프론트로 넘긴다
                    id => {
                        show_main(app);
                        let _ = app.emit("tray", id);
                    }
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![greet, file_icon, quit])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
