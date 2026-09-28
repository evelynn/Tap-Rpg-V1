// 텝 데스크톱 창(1차): 브라우저 시제품 화면(apps/desktop/ui/dist)을 창 하나에 담는다.
// 기본 창 768 × 64 테두리 없음·상세 창 분리(03 §1)는 다음 단계다.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("텝을 시작하지 못했습니다");
}
