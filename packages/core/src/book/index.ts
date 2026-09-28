// 생애의 책(18): 엮기 입력 → 선별 → 블록 변환 → 검사·수리 → 봉인, 그리고 봉인 뒤 덧붙임 3칸
export { BOOK_GEN_VERSION, bookInput, type BookAppendixSource, type BookEventInfo, type BookEventKind, type BookInput, type BookInputOptions } from './input'
export { BOOK_LIMITS, bookBytes, compileBook, minimalBook } from './compile'
export { attitudeSegments } from './select'
export { FRAME as BOOK_FRAME, ageWord, bc4Hit, bkId } from './text'
export { bindBook, bookJournal, bookOf, markBookOpened, setBookAfterword, setBookReceivedBy } from './seal'
