// 창 껍데기(03 §10, D85): 트레이 메뉴, 전체화면 앱 감지. 항목을 고르면 화면 쪽에 이벤트로 알리고
// 실제 동작(보이기·일시정지·클릭 통과 등)은 화면이 한다(설정·저장과 같은 곳에서 상태를 들고 있으려고).
use std::time::Duration;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager};

pub const TRAY_ITEMS: &[(&str, &str)] = &[
    ("toggle", "기본 창 보이기 / 숨기기"),
    ("detail", "상세 창 열기"),
    ("pause", "일시정지 / 다시 진행"),
    ("clickthrough_off", "클릭 통과 해제"),
    ("lock", "위치 잠금"),
    ("ontop", "항상 위에 표시"),
    ("-", ""),
    ("reset_pos", "창 위치 초기화"),
    ("reset_size", "창 크기 초기화"),
    ("-", ""),
    ("settings", "설정"),
    ("quit", "종료"),
];

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::new(app)?;
    for (id, label) in TRAY_ITEMS {
        if *id == "-" {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
        } else {
            menu.append(&MenuItem::with_id(app, *id, *label, true, None::<&str>)?)?;
        }
    }
    let mut tray = TrayIconBuilder::with_id("tap").menu(&menu).tooltip("텝").show_menu_on_left_click(false);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, e| {
        let _ = app.emit("tap://tray", e.id().as_ref().to_string());
    })
    .on_tray_icon_event(|tray, e| {
        // 왼쪽 클릭: 창 보이기(숨어 있었으면)
        if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, button_state: tauri::tray::MouseButtonState::Up, .. } = e {
            let _ = tray.app_handle().emit("tap://tray", "show".to_string());
        }
    })
    .build(app)?;
    Ok(())
}

/// 트레이 아이콘 설명 글(선택 대기 알림, 03 §10)
#[tauri::command]
pub fn tray_tooltip(app: AppHandle, text: String) {
    if let Some(t) = app.tray_by_id("tap") {
        let _ = t.set_tooltip(Some(text));
    }
}

// ── 전체화면 앱 감지(03 §10): 포그라운드 창이 그 모니터 전체를 덮으면 true. 바탕 화면·작업 표시줄·우리 창은 뺀다 ──

#[cfg(windows)]
fn foreground_fullscreen(own: isize) -> bool {
    use windows_sys::Win32::Foundation::{HWND, RECT};
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetClassNameW, GetForegroundWindow, GetWindowRect};
    unsafe {
        let fg: HWND = GetForegroundWindow();
        if fg.is_null() || fg as isize == own {
            return false;
        }
        let mut cls = [0u16; 64];
        let n = GetClassNameW(fg, cls.as_mut_ptr(), cls.len() as i32);
        let name = String::from_utf16_lossy(&cls[..n.max(0) as usize]);
        if matches!(name.as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
            return false;
        }
        let mut r: RECT = std::mem::zeroed();
        if GetWindowRect(fg, &mut r) == 0 {
            return false;
        }
        let mon = MonitorFromWindow(fg, MONITOR_DEFAULTTONEAREST);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(mon, &mut mi) == 0 {
            return false;
        }
        let m = mi.rcMonitor;
        r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom
    }
}

pub fn watch_fullscreen(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = false;
        loop {
            std::thread::sleep(Duration::from_millis(500));
            let own = app
                .get_webview_window("main")
                .and_then(|w| w.hwnd().ok())
                .map(|h| h.0 as isize)
                .unwrap_or(0);
            #[cfg(windows)]
            let now = foreground_fullscreen(own);
            #[cfg(not(windows))]
            let now = { let _ = own; false };
            if now != last {
                last = now;
                let _ = app.emit("tap://fullscreen", now);
            }
        }
    });
}
