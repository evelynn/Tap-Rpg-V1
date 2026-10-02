export const meta = {
  name: 'm1-wave5-finish',
  description: 'T11 저장·오프라인, T12 헤드리스 시뮬레이터·밸런스 리포트, T13 확장 팩 증명, 데모 실행기를 만들고 M1 완료 검증',
  phases: [
    { title: 'Implement', detail: 'T11 ∥ T12 ∥ T13 ∥ 데모 실행기' },
    { title: 'Integrate', detail: '연결·M1 완료 기준 실행' },
    { title: 'Verify', detail: '독립 검증(기준 대조·데모 사람 확인)' },
    { title: 'Fix', detail: '검증 반영' },
  ],
}

const ROOT = 'E:\\AI_work\\Tap_rpg'
const CTX = [
  '[프로젝트] ' + ROOT + ' — 방치형 SD 판타지 RPG 「텝」. 설계 문서 docs/design/00~18(소유 규칙 00 §2.4, 수치·ID 01). 개발 문서 docs/dev/{CONTENT_SCHEMA.md, ARCHITECTURE.md, IMPL_DECISIONS.md, BALANCE_BACKLOG.md}. 기반 팩 content/base.',
  '[저장소] pnpm 모노레포(최근 커밋 ab4d005). packages/core에 schema·rng·time·text·content·state·rules·journal·combat·recovery·items·economy·events·ai·activity·life·succession·sim 이 모두 구현돼 있고, sim/life-loop.ts의 createGameWorld/loadGameWorld로 한 생애가 끝까지 돌아간다(World.advance(초)). 테스트 837개 통과. 명령: pnpm typecheck, pnpm test, pnpm lint:ids, pnpm content:check, pnpm check. 네트워크 설치 불가 — 새 npm 패키지 금지(Node 22 내장 모듈과 기존 의존성만).',
  '[원칙] Karpathy 최소 코드·기존 스타일·짧은 한국어 주석. 수치는 콘텐츠 데이터에서 읽는다. 코어는 콘텐츠 ID·Node API·Math.random·Date 금지(파일·시계는 tools 쪽에서). 결정성 유지.',
  '[금지] git commit 금지. 담당 폴더 밖 수정 금지. docs/dev/IMPL_DECISIONS.md 는 통합자만.',
].join('\n')

const FIND = {
  type: 'object',
  properties: { findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['Critical', 'Major', 'Minor'] }, where: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' },
  }, required: ['severity', 'where', 'issue', 'fix'] } } },
  required: ['findings'],
}

const TASKS = [
  { key: 'T11', label: 'T11:save', effort: 'high', brief: [
    '[너의 작업: T11 — 저장·불러오기·이전·오프라인 정산] 담당: packages/core/src/save/(새 폴더, 순수 로직)과 packages/core/src/offline/(새 폴더), 그리고 파일 입출력 어댑터는 packages/content-kit/src/save/(Node 쪽). 테스트 포함.',
    '읽기: 13 전체(오프라인 정산 절차와 정지 지점 우선순위, 부재 시간 측정과 시계 역행, 저장 시점·원자적 쓰기·백업 3개·체크섬·복구 순서·스키마 버전과 이전, 복귀 요약 데이터, 일지 보존), 16 §5·§7(save_root·header·body·K/B 검사), CONTENT_SCHEMA §6.',
    '구현: (1) 직렬화: 키 순서 고정(정규 JSON)·SHA-256 체크섬(코어의 순수 TS SHA-256 재사용)·schema_version 1·이전 함수 등록부(빈 상태로 시작하되 v→v+1 적용 골격). (2) 로드 검사 K1~K7(치명)·B1~B15(보정)과 진단 로그. (3) 오프라인 정산: 부재 시간 계산(시계 역행 5분 허용·high_water), 상한 8시간, 60초 미만 무시, 저장된 확정 결과 먼저 적용, 04 결정 규칙으로 진행, 정지 지점 5종(생애 종료·운명 대기·계승 대기·생애 단계 경계·상한)과 멈춘 이유 코드, 남은 시간 버림, 한 번에 한 생애 종료까지. 복귀 요약 데이터 생성. (4) Node 어댑터: 원자적 교체(임시 파일 → rename)·백업 3개 순환(10분 간격)·손상 파일 보관·복구 순서.',
    '테스트 합격 기준(17 §4 단계 6): 무작위 시점 강제 종료 100회 후 손상 0·확정 결과 재추첨 0(저장 → 로드 → 이어 진행 결과가 중단 없이 진행한 것과 같음), v0.1 §14.1 시나리오(10시간 부재·3시간 지점 운명 사건 → 정산 180분·버림 300분·멈춘 이유), 정산 1,000회에서 생애 종료 두 번 넘김 0, 경계 정지 켬에서 경계 넘김 0, 운명 대기 1시간 동안 유효 진행 0, 480분 정산 ≤ 2초.',
  ].join('\n') },
  { key: 'T12', label: 'T12:sim', effort: 'high', brief: [
    '[너의 작업: T12 — 헤드리스 밸런스 시뮬레이터와 리포트] 담당: tools/sim/(전부)와 그 테스트.',
    '읽기: 17 §5(입력·실행 방식·출력·합격 기준과 지표 표), 01 §17(목표 범위), docs/dev/BALANCE_BACKLOG.md.',
    '구현: CLI `pnpm sim [--attitude stable|adventurous|challenging|all] [--seeds 1-100] [--minutes 600] [--lives N] [--content content/base ...] [--out reports/] [--json] [--csv]`. 게임 규칙 코드를 그대로 호출(오프라인 정산과 같은 경로). 생애별 CSV 1행(17 §5.2 항목)과 Markdown 요약(태도별 중앙값·p10~p90·목표·판정·불합격 목록·규칙 커밋 해시는 환경에서 받지 말고 인자로 선택), 지표 계산: 01 §17 전 항목 + 17 §5.3 관찰 지표. 합격 기준: 중앙값이 목표 범위 안 + 생애 80% 이상이 범위 안. 300생애 10분 이내로 도는지 측정해 보고.',
    '테스트: 소수 생애(예: 태도별 2생애 × 120분)로 리포트 생성·지표 계산의 단위 테스트, 같은 시드 → 같은 리포트.',
  ].join('\n') },
  { key: 'T13', label: 'T13:expansion', effort: 'medium', brief: [
    '[너의 작업: T13 — 확장성 증명 팩과 콘텐츠 작성 가이드] 담당: content/examples/mist-forest/(새 팩)과 docs/dev/CONTENT_GUIDE.md, packages/content-kit/test/expansion.test.ts.',
    '만들 것: 기반 팩 위에 얹는 확장 팩 「안개 이끼숲」 — 사냥터 1곳(권장 레벨 10~18), 모험 경로 1곳, 새 적 1종(기존 계열 재사용), 생활 사건 2개, 연속 사건 1줄기 3단계(고유 보상 장비 1개 포함), 필요한 플래그·문형. 02 §3의 안개 이끼숲 설정(거대한 버섯·반딧불·짙은 안개·약초·정령과의 인연)을 따른다. pack.json에 requires: base.',
    '핵심 조건: **코어 코드 수정 0**. 팩만 추가해 pnpm content:check(기반 + 확장)가 오류 0이고, 시뮬레이터에서 새 지역이 후보로 선택되고 새 사건이 발생해야 한다. 테스트로 증명한다(확장 팩을 로드한 세계를 짧게 돌려 새 장소 방문·새 사건 발생 확인). 코어 수정이 필요하면 무엇이 막았는지 보고에 적는다(그 자체가 확장성 결함이다).',
    'docs/dev/CONTENT_GUIDE.md: 팩 만들기 절차, 파일 배치, 자주 쓰는 조건·효과, 사건 한 개를 처음부터 쓰는 예, 검증 오류 코드 읽는 법, 새 지역·새 시나리오 추가 체크리스트.',
  ].join('\n') },
  { key: 'DEMO', label: 'demo:runner', effort: 'medium', brief: [
    '[너의 작업: 데모 실행기] 담당: tools/demo/(새 워크스페이스 패키지 @tap/demo)와 루트 package.json 의 "demo" 스크립트 추가(루트 package.json 은 너만 수정).',
    '목적: 사용자가 터미널에서 **게임을 지켜보는 데모**. 화면(M2 Tauri)은 아직 없으므로 한 줄 기록을 시간 흐름대로 보여 준다.',
    '기능: `pnpm demo [--speed 60] [--seed ...] [--attitude ...] [--name 이름] [--family 가문] [--minutes 600] [--gen 3] [--fast]`',
    '- 기본은 실시간 재생: 유효 진행 1초를 실제 1초로(--speed 60이면 60배속) 흘리며, 새 한 줄 기록이 생기면 `[사냥] …` 형식으로 출력한다. 나이·레벨·체력·동전 같은 상태 줄을 한 줄 상태 표시줄로 갱신(ANSI 커서 제어는 최소로, --plain이면 줄 단위 출력).',
    '- 중요 기록(`[중요]`·`[운명]`·`[부상]`·`[계승]` 등)은 눈에 띄게, 선택 대기가 걸리면 멈추고 선택지를 보여 주며 숫자 입력을 받는다(node:readline). 사전 방침으로 자동 진행하는 `--auto` 옵션도 둔다.',
    '- 생애가 끝나면 생애 요약(나이·레벨·주요 사건·유품·사망 원인 또는 은퇴 역할)과 계승 결과(후계자·유전 특성·유품·이전 동전)를 보여 주고, --gen 만큼 이어서 진행한다.',
    '- 종료 시 일지 전체를 reports/demo-<시드>.md 로 저장(선택: --save).',
    '사용성: 첫 줄에 조작법과 현재 설정을 한국어로 안내한다. 오류 없이 Ctrl+C로 중단할 수 있어야 한다. 실행은 tsx(개발 의존성)로 한다.',
    '테스트: tools/demo/test/ 에 렌더 함수(기록 → 출력 문자열)와 인자 파싱 단위 테스트. 실제 재생은 --fast --minutes 30 으로 한 번 돌려 예외 0을 확인(테스트에서는 짧게).',
  ].join('\n') },
]

phase('Implement')
const impl = await parallel(TASKS.map((t) => () => agent(CTX + '\n' + t.brief + '\n끝에 pnpm typecheck && pnpm test && pnpm lint:ids 통과. 최종 보고: 만든 파일, 명령 사용법, 구현 결정 후보, 남은 문제.', { label: t.label, phase: 'Implement', effort: t.effort })))

phase('Integrate')
const integ = await agent(CTX + '\n' + [
  '[너의 작업: 통합자] M1을 완료 상태로 만든다(packages/core/src/index.ts, sim/, 루트 package.json, docs/dev/* 수정 가능).',
  '1. 저장·오프라인(T11)을 World 루프에 연결: 저장 시점(13 §8.1)에 자동 저장 훅, 재시작 시 확정 결과 이어 적용, 오프라인 정산 진입점.',
  '2. 시뮬레이터(T12)·데모(DEMO)가 같은 경로를 쓰는지 확인하고 중복 코드를 합친다.',
  '3. `pnpm sim --attitude all --seeds 1-30 --out reports/` 를 실제로 돌려 리포트를 만들고, 01 §17 지표의 합격·불합격을 docs/dev/BALANCE_BACKLOG.md 에 기록(수치를 임의로 바꾸지 말 것).',
  '4. README.md 에 M1 사용법(설치·검사·시뮬레이터·데모)과 M2 예정(Tauri 창)을 적는다.',
  '5. docs/dev/IMPL_DECISIONS.md 갱신. pnpm check 종료 코드 0.',
  '[구현 보고]', JSON.stringify(impl, null, 1),
].join('\n'), { label: 'integrate', phase: 'Integrate', effort: 'high' })

phase('Verify')
const verifies = await parallel([
  () => agent(CTX + '\n' + '[너의 작업: 독립 검증자 — M1 완료 기준] 수정하지 마라. docs/design/17 §4 단계 2·3·4·5·6의 **헤드리스 verify 항목을 전부 직접 실행**해 통과 여부와 측정값을 findings에 적는다(불합격은 Major 이상). 특히 단계 6(강제 종료 100회·부재 시나리오·정산 1,000회·경계 정지·480분 ≤ 2초)과 단계 5(사건 30개 전부 발생·흡혈귀 20생애·가문 플래그 반응)를 실측한다. 스크립트는 scratch 폴더에 만들고 저장소를 더럽히지 마라.', { label: 'verify:m1', phase: 'Verify', schema: FIND }),
  () => agent(CTX + '\n' + '[너의 작업: 독립 검증자 — 데모와 확장성(사람 눈 기준)] 수정하지 마라. (1) `pnpm demo --fast --minutes 120 --seed 7 --plain` 을 실제로 돌려 출력이 사람이 읽기에 자연스러운지 본다: 한 줄 기록 28자 규칙, 조사 오류, 중복 문장, 시간 흐름의 이상(같은 장면 반복), 선택 대기 안내의 명확성. 문제를 예시 줄과 함께 적는다. (2) content/examples/mist-forest 확장 팩이 코어 수정 없이 로드·발생하는지 직접 확인한다. (3) docs/dev/CONTENT_GUIDE.md 를 보고 새 사건 하나를 실제로 만들어 검증기를 통과시켜 보고, 가이드에서 막힌 지점을 적는다(만든 파일은 지운다).', { label: 'verify:demo', phase: 'Verify', schema: FIND }),
])
const findings = verifies.filter(Boolean).flatMap((v) => v.findings)
log('검증 ' + findings.length + '건')

phase('Fix')
const fix = await agent(CTX + '\n' + [
  '[너의 작업: 수정자] 아래 검증 결과를 확인하고 사실인 것만 최소로 고친다(코어·도구·문서 수정 가능). 밸런스 수치가 범위를 벗어난 것은 구현 오류만 고치고, 값 조정이 필요한 것은 docs/dev/BALANCE_BACKLOG.md 에 측정값과 함께 남긴다. 끝에 pnpm check 종료 코드 0과 `pnpm demo --fast --minutes 60 --seed 3 --plain` 무오류를 확인한다. 항목별 처리 보고.',
  '[검증 결과]', JSON.stringify(findings, null, 1),
].join('\n'), { label: 'fix', phase: 'Fix', effort: 'high' })

return { impl, integ, findings_count: findings.length, fix }
