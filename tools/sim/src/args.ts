// CLI 인자 해석. 파일·시계를 만지지 않아 단위 테스트로 그대로 잰다.

export interface SimArgs {
  attitude: string // 태도 id 또는 'all'
  seeds: [number, number]
  minutes: number // 생애당 유효 진행 분 상한. 0이면 콘텐츠에서 계산한 상한을 쓴다
  lives: number
  content: string[]
  out: string
  json: boolean
  csv: boolean
  rules: string // 규칙 커밋 해시(환경에서 읽지 않고 인자로 받는다)
  help: boolean
}

export const USAGE = [
  '사용법: pnpm sim [옵션]',
  '  --attitude <id|all>   태도(기본 all). 콘텐츠의 attitude id',
  '  --seeds <a-b|n>       시드 범위(기본 1-100)',
  '  --minutes <n>         생애당 유효 진행 분 상한(기본 0 = 생애가 끝날 때까지)',
  '  --lives <n>           한 가문에서 이어 볼 생애 수(기본 1)',
  '  --content <경로...>   콘텐츠 팩 경로(기본 content/base)',
  '  --out <폴더>          보고 저장 폴더(기본 reports)',
  '  --json                요약 JSON도 쓴다',
  '  --csv                 생애별 CSV도 쓴다(형식 인자가 하나도 없으면 CSV는 기본으로 쓴다)',
  '  --rules <해시>        보고에 적을 규칙 커밋 해시',
].join('\n')

export const DEFAULT_ARGS: SimArgs = {
  attitude: 'all',
  seeds: [1, 100],
  minutes: 0,
  lives: 1,
  content: ['content/base'],
  out: 'reports',
  json: false,
  csv: false,
  rules: '미지정',
  help: false,
}

function positive(name: string, raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name}에는 1 이상의 정수가 온다: ${raw ?? ''}`)
  return n
}

function parseSeeds(raw: string | undefined): [number, number] {
  const m = /^(\d+)(?:-(\d+))?$/.exec(raw ?? '')
  if (!m) throw new Error(`--seeds 형식은 a-b 또는 n이다: ${raw ?? ''}`)
  const lo = Number(m[1])
  const hi = m[2] === undefined ? lo : Number(m[2])
  if (lo < 1 || hi < lo) throw new Error(`--seeds 범위가 뒤집혔다: ${raw ?? ''}`)
  return [lo, hi]
}

export function parseArgs(argv: readonly string[]): SimArgs {
  const args: SimArgs = { ...DEFAULT_ARGS, seeds: [...DEFAULT_ARGS.seeds], content: [...DEFAULT_ARGS.content] }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!
    const next = argv[i + 1]
    switch (flag) {
      case '--help':
      case '-h':
        args.help = true
        break
      case '--attitude':
        if (next === undefined || next.startsWith('--')) throw new Error('--attitude 값이 없다')
        args.attitude = next
        i += 1
        break
      case '--seeds':
        args.seeds = parseSeeds(next)
        i += 1
        break
      case '--minutes': {
        const n = Number(next)
        if (!Number.isFinite(n) || n < 0) throw new Error(`--minutes에는 0 이상의 수가 온다: ${next ?? ''}`)
        args.minutes = n
        i += 1
        break
      }
      case '--lives':
        args.lives = positive('--lives', next)
        i += 1
        break
      case '--content': {
        const paths: string[] = []
        while (i + 1 < argv.length && !argv[i + 1]!.startsWith('--')) paths.push(argv[++i]!)
        if (!paths.length) throw new Error('--content 경로가 없다')
        args.content = paths
        break
      }
      case '--out':
        if (next === undefined || next.startsWith('--')) throw new Error('--out 값이 없다')
        args.out = next
        i += 1
        break
      case '--rules':
        if (next === undefined || next.startsWith('--')) throw new Error('--rules 값이 없다')
        args.rules = next
        i += 1
        break
      case '--json':
        args.json = true
        break
      case '--csv':
        args.csv = true
        break
      default:
        throw new Error(`모르는 옵션: ${flag}`)
    }
  }
  // 형식 인자가 하나도 없으면 17 §5.1 기본 출력(Markdown + 생애별 CSV)
  if (!args.json && !args.csv) args.csv = true
  return args
}
