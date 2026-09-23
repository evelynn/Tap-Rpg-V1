// 시뮬레이션 골격: 세계(World), 행동 해석기 등록부, 새 가문 생성, 사건 포트 조립
export * from './create'
export * from './services'
export * from './world'
// 생애 루프(활동 + 생애 + 계승 조립). 위 세 모듈이 먼저 평가돼야 해서 마지막에 둔다
export * from './life-loop'
