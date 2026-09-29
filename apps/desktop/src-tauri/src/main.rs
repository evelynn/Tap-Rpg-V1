// 텝 데스크톱 창: 화면(apps/desktop/ui/dist)을 싣고, 저장 파일 입출력·두 번 실행 방지를 맡는다.
// 게임 규칙·저장 검사는 모두 화면 쪽 코어가 한다(이 껍데기는 파일과 창만 다룬다).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod save;
mod shell;

use std::time::Duration;
use tauri::{Emitter, Manager};

#[tauri::command]
fn app_exit(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    // 두 번째 실행은 첫 창에 보이라는 요청만 남기고 끝난다(03 §10)
    let Some(_lock) = save::instance_lock() else {
        let _ = std::fs::write(save::show_request_path(), b"1");
        return;
    };
    let _ = std::fs::remove_file(save::show_request_path());

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_exit,
            save::save_read_all,
            save::save_write,
            save::save_extra,
            save::save_quarantine,
            save::settings_read,
            save::settings_write,
            save::save_open_folder,
            shell::tray_tooltip,
        ])
        .setup(|app| {
            shell::build_tray(app.handle())?;
            shell::watch_fullscreen(app.handle().clone());
            let handle = app.handle().clone();
            // 두 번째 실행의 보이기 요청을 1초마다 확인한다
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(1));
                let p = save::show_request_path();
                if p.exists() {
                    let _ = std::fs::remove_file(&p);
                    // 화면 쪽 상태(보이는 중·그리기)도 함께 바뀌도록 트레이 `보이기`와 같은 길로 보낸다
                    let _ = handle.emit("tap://tray", "show".to_string());
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.unminimize();
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // 기본 창에는 닫기가 없다: Alt+F4 등 닫기 요청은 숨기기(트레이로), 완전 종료는 트레이 `종료`(03 §10)
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("tap://tray", "hide".to_string());
            }
        })
        .run(tauri::generate_context!())
        .expect("텝을 시작하지 못했습니다");
}
