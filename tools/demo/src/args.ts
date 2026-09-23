// 데모 실행기 인자 파싱. 화면·세계와 떨어져 있어 단위 테스트로 검사한다.

export interface DemoArgs {
  speed: number // 배속(유효 진행 초 ÷ 실제 초)
  seed: string // 가문 씨앗(16진 16자리가 아니면 해시해서 쓴다)
  attitude: string | null // 태도 id(없으면 콘텐츠 기본값)
  name: string
  family: string
  minutes: number // 최대 유효 진행 분
  gen: number // 지켜볼 생애 수
  fast: boolean // 기다리지 않고 바로 흘린다
  plain: boolean // 커서 제어 없이 줄 단위로만 출력
  auto: boolean // 선택 대기를 사전 방침(자동 선택)으로 처리
  save: boolean // 끝나면 일지를 reports/에 저장
  help: boolean
}

export const DEFAULTS: DemoArgs = {
  speed: 60,
  seed: 'tap',
  attitude: null,
  name: '모라',
  family: '조약돌',
  minutes: 600,
  gen: 1,
  fast: false,
  plain: false,
  auto: false,
  save: false,
  help: false,
}

export const USAGE = [
  '사용법: pnpm demo [옵션]',
  '  --speed <배속>   유효 진행 1초를 실제 1÷배속 초로 흘린다 (기본 60)',
  '  --seed <문자열>  가문 씨앗 (기본 tap)',
  '  --attitude <id>  태도 id (예: stable · adventurous · challenging)',
  '  --name <이름>    첫 인물 이름 (기본 모라)',
  '  --family <가문>  가문 이름 (기본 조약돌)',
  '  --minutes <분>   최대 유효 진행 분 (기본 600 = 한 생애)',
  '  --gen <수>       지켜볼 생애 수 (기본 1)',
  '  --fast           기다리지 않고 끝까지 흘린다',
  '  --plain          커서 제어 없이 줄 단위로만 출력',
  '  --auto           선택 대기를 사전 방침으로 자동 처리',
  '  --save           끝나면 일지를 reports/demo-<씨앗>.md 로 저장',
  '  --help           이 안내를 보여 준다',
].join('\n')

const FLAGS = ['fast', 'plain', 'auto', 'save', 'help'] as const
const TEXTS = ['seed', 'attitude', 'name', 'family'] as const
const NUMBERS = ['speed', 'minutes', 'gen'] as const

function readNumber(key: (typeof NUMBERS)[number], raw: string): number {
  const v = Number(raw)
  if (!Number.isFinite(v) || v <= 0) throw new Error(`--${key} 값은 0보다 큰 수여야 한다: ${raw}`)
  if (key === 'gen' && !Number.isInteger(v)) throw new Error(`--gen 값은 정수여야 한다: ${raw}`)
  return v
}

// --키 값 / --플래그 / --키=값 세 모양을 받는다. 모르는 옵션은 오류다
export function parseArgs(argv: readonly string[]): DemoArgs {
  const out: DemoArgs = { ...DEFAULTS }
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!
    if (!token.startsWith('--')) throw new Error(`모르는 인자: ${token}\n${USAGE}`)
    const eq = token.indexOf('=')
    const key = (eq === -1 ? token.slice(2) : token.slice(2, eq)) as string
    const inline = eq === -1 ? null : token.slice(eq + 1)
    if ((FLAGS as readonly string[]).includes(key)) {
      out[key as (typeof FLAGS)[number]] = true
      continue
    }
    const wanted = (TEXTS as readonly string[]).includes(key) || (NUMBERS as readonly string[]).includes(key)
    if (!wanted) throw new Error(`모르는 옵션: ${token}\n${USAGE}`)
    const value = inline ?? argv[++i]
    if (value === undefined || value === '') throw new Error(`--${key} 값이 없다`)
    if (key === 'seed') out.seed = value
    else if (key === 'attitude') out.attitude = value
    else if (key === 'name') out.name = value
    else if (key === 'family') out.family = value
    else out[key as (typeof NUMBERS)[number]] = readNumber(key as (typeof NUMBERS)[number], value)
  }
  return out
}

// 첫 줄 안내: 지금 설정과 조작법
export function renderIntro(args: DemoArgs): string {
  const speed = args.fast ? '바로 흘림(--fast)' : `${args.speed}배속`
  const choice = args.auto ? '사전 방침 자동' : '숫자 입력'
  return [
    `텝 데모 — ${args.family} 가문 · ${args.name} · 씨앗 ${args.seed} · ${speed}`,
    `생애 ${args.gen}회 · 최대 ${args.minutes}유효분 · 선택 ${choice}${args.save ? ' · 일지 저장 켬' : ''}`,
    '기록이 시간 흐름대로 한 줄씩 쌓인다. 선택 대기가 걸리면 번호를 입력한다. Ctrl+C로 언제든 멈출 수 있다.',
  ].join('\n')
}
