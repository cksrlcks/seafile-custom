// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Claude(MCP)용 중계 모드: 창 없이 stdio ↔ 실행 중인 앱만 잇는다
    if std::env::args().any(|a| a == "--mcp") {
        std::process::exit(seadrive_lib::mcp::relay());
    }
    seadrive_lib::run()
}
