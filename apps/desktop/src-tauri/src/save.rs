// 저장 파일 입출력(13 §8.2·§8.4·§8.6). 바이트만 다룬다 — 검사·고르기는 코어(save/pick, loadSave)가 화면 쪽에서 한다.
// 폴더: %APPDATA%\Tap\save\(save.json, save.json.tmp, backup_n.json, pre_migration_vN.json, corrupt\), %APPDATA%\Tap\settings.json
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const SAVE_FILE: &str = "save.json";
const TMP_FILE: &str = "save.json.tmp";
const BACKUP_MIN_GAP_MS: u128 = 10 * 60 * 1000;
const CORRUPT_KEEP: usize = 5;

// 쓰기는 한 번에 하나(13 §8.2). 명령이 여러 스레드에서 와도 차례로 쓴다
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn app_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    base.join("Tap")
}

fn save_dir() -> PathBuf {
    app_dir().join("save")
}

fn backup(n: u32) -> String {
    format!("backup_{n}.json")
}

// 이름은 이 폴더 안의 파일만(경로 넘김 막기)
fn safe(name: &str) -> Result<&str, String> {
    if name.is_empty() || name.contains(['/', '\\', ':']) || name.contains("..") {
        return Err(format!("쓸 수 없는 이름: {name}"));
    }
    Ok(name)
}

fn write_synced(path: &PathBuf, text: &str) -> Result<(), String> {
    let mut f = File::create(path).map_err(|e| e.to_string())?;
    f.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    f.sync_all().map_err(|e| e.to_string())
}

fn mtime_ms(path: &PathBuf) -> u128 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// 있는 저장 파일(save.json, tmp, backup_1..n)의 [이름, 글] 목록. 읽을 수 없는 파일은 글을 비운다(코어가 K1로 거른다)
#[tauri::command]
pub fn save_read_all(backups: u32) -> Vec<(String, String)> {
    let dir = save_dir();
    let mut names = vec![SAVE_FILE.to_string(), TMP_FILE.to_string()];
    names.extend((1..=backups).map(backup));
    names
        .into_iter()
        .filter_map(|n| {
            let p = dir.join(&n);
            p.exists().then(|| (n, fs::read_to_string(&p).unwrap_or_default()))
        })
        .collect()
}

/// 13 §8.2 순서: 임시 파일 쓰기·플러시 → (백업 순환) → 원자적 교체
#[tauri::command]
pub fn save_write(text: String, backup_due: bool, force_backup: bool, backups: u32) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = save_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = dir.join(TMP_FILE);
    write_synced(&tmp, &text)?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0);
    if backup_due && backups > 0 && (force_backup || now.saturating_sub(mtime_ms(&dir.join(backup(1)))) >= BACKUP_MIN_GAP_MS) {
        for i in (1..backups).rev() {
            let from = dir.join(backup(i));
            if from.exists() {
                let _ = fs::rename(&from, dir.join(backup(i + 1)));
            }
        }
        let save = dir.join(SAVE_FILE);
        if save.exists() {
            let _ = fs::rename(&save, dir.join(backup(1)));
        }
    }
    // Windows rename은 MoveFileEx(REPLACE_EXISTING)라 원자적으로 덮어쓴다. 실패하면 save.json은 그대로 남는다
    fs::rename(&tmp, dir.join(SAVE_FILE)).map_err(|e| e.to_string())
}

/// 이전 전 원본 사본 등 한 파일을 그대로 남긴다(13 §8.7)
#[tauri::command]
pub fn save_extra(file: String, text: String) -> Result<(), String> {
    let dir = save_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    write_synced(&dir.join(safe(&file)?), &text)
}

/// 손상 파일을 corrupt\{시각}_{이름}으로 옮기고 최대 5개만 남긴다(13 §8.4)
#[tauri::command]
pub fn save_quarantine(files: Vec<String>, stamp: String) -> Result<Vec<String>, String> {
    let dir = save_dir();
    let box_dir = dir.join("corrupt");
    fs::create_dir_all(&box_dir).map_err(|e| e.to_string())?;
    let mut moved = vec![];
    for f in files {
        let from = dir.join(safe(&f)?);
        if !from.exists() {
            continue;
        }
        let name = format!("{}_{}", safe(&stamp)?, f);
        fs::rename(&from, box_dir.join(&name)).map_err(|e| e.to_string())?;
        moved.push(name);
    }
    let mut kept: Vec<_> = fs::read_dir(&box_dir).map_err(|e| e.to_string())?.filter_map(|e| e.ok()).map(|e| e.path()).collect();
    kept.sort();
    let extra = kept.len().saturating_sub(CORRUPT_KEEP);
    for old in kept.into_iter().take(extra) {
        let _ = fs::remove_file(old);
    }
    Ok(moved)
}

#[tauri::command]
pub fn settings_read() -> Option<String> {
    fs::read_to_string(app_dir().join("settings.json")).ok()
}

#[tauri::command]
pub fn settings_write(text: String) -> Result<(), String> {
    let dir = app_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tmp = dir.join("settings.json.tmp");
    write_synced(&tmp, &text)?;
    fs::rename(&tmp, dir.join("settings.json")).map_err(|e| e.to_string())
}

/// 저장 폴더를 탐색기로 연다(모두 읽을 수 없을 때 `폴더 열기`, 13 §8.5)
#[tauri::command]
pub fn save_open_folder() {
    let _ = std::process::Command::new("explorer").arg(save_dir()).spawn();
}

/// 두 번 실행 방지: 잠금 파일을 공유 없이 연다. 이미 열려 있으면 None(두 번째 실행)
pub fn instance_lock() -> Option<File> {
    use std::os::windows::fs::OpenOptionsExt;
    let dir = app_dir();
    let _ = fs::create_dir_all(&dir);
    OpenOptions::new().write(true).create(true).truncate(false).share_mode(0).open(dir.join("instance.lock")).ok()
}

pub fn show_request_path() -> PathBuf {
    app_dir().join("show.req")
}
