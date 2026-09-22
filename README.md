# 텝 (가칭)

작업 화면 한쪽에서 작은 SD 모험가가 스스로 살아가고, 그 삶과 유품이 다음 세대로 이어지는 방치형 판타지 RPG.

## 문서

- 기획: `docs/텝_게임기획_설정문서_v0.1.md`
- 세부 설계: `docs/design/00_문서지도.md`부터 읽는다. 수치·ID는 `01_핵심규칙_수치기준.md`가 단일 출처다.
- 구현 결정: `docs/dev/IMPL_DECISIONS.md`

## 구조

| 경로 | 내용 |
| --- | --- |
| `packages/core` | 시뮬레이션 코어. 순수 TypeScript이며 DOM·Node API를 쓰지 않는다 |
| `packages/content-kit` | 콘텐츠 팩 로더·검증기(Node 도구) |
| `tools/sim` | 헤드리스 밸런스 시뮬레이터 |
| `content/` | 콘텐츠 팩(데이터). 새 지역·사건·시나리오는 코드가 아니라 팩으로 추가한다 |
| `apps/desktop` | (M2) Tauri 2 데스크톱 창 |

## 명령

```sh
pnpm install --offline   # 로컬 저장소에서 설치 (docs/dev/IMPL_DECISIONS.md I02)
pnpm check               # 타입 검사 + 테스트 + 코어 ID 검사 + 설계 문서 검사
pnpm sim                 # 헤드리스 시뮬레이터
```
