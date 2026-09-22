# 텝 설계 문서 정합성 검사 — docs/design/*.md
# 실행: python docs/design/tools/lint_docs.py   (종료 코드 0 = 오류 없음)
import re
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent
FILES = sorted(p for p in DOCS.glob("[0-9][0-9]_*.md"))

# 폐기된 표기 → 이유
RETIRED = [
    (r"(?<![A-Z])C0[3-5](?![-\d])|C0[12] ?`?(낡은 호각|들쥐 이빨)", "장신구 옛 ID(C01~C05) → J01~J05 (D17). 연속 사건 C01·C02는 유효"),
    (r"\bfam_[a-z0-9_]+", "옛 플래그 형식 fam_ → fam. (00 §2.2)"),
    (r"\bc01_rescued\b|\bf02_gave_to_yuan\b|trip\.fear_penalty", "옛 플래그 이름"),
    (r"(?<![\w])\{(die|gen|long_sleep_age|parent|relation|new|old|v|l)(:[^}]*)?\}|\{luck-2\}", "옛 템플릿 변수 이름(16 §1.4 등록표 사용)"),
    (r"큰 들쥐 앞니|늑대 가죽|잿빛 송곳니|박쥐 날개막|쇳소리 귀뼈|그림자 날개|들쥐 꼬리털", "옛 재료 이름 (D31)"),
    (r"지역 14곳|장소 14곳", "장소는 13곳"),
    (r"적절히|필요에 따라|추후 결정|\bTBD\b|등등", "미확정 표현"),
]

TAG_LINE = re.compile(r"`\[(사냥|모험|던전|이동|휴식|마을|장비|판정|특성|성장|발견|인연|부상|중요|가족|은퇴|사망|계승|가문)\] ([^`]+)`")
VAR = re.compile(r"\{[a-z_]+(?::[^}]*)?\}")
REF = re.compile(r"(?<![\d.])(\d{2}) ?§(\d+(?:\.\d+)*)")
HEAD = re.compile(r"^#{2,4} (\d+(?:\.\d+)*)[ .]", re.M)
# 장소 파일명 약어(예: 02_세계관 → 02)
def sections(text):
    return set(HEAD.findall(text))

def main():
    errors, warns = [], []
    texts = {p.name[:2]: p.read_text(encoding="utf-8") for p in FILES}
    secs = {k: sections(v) for k, v in texts.items()}
    for p in FILES:
        num = p.name[:2]
        legacy_table = False  # 16 §1.4.4 옛 표기 → 정식 이름 대응표는 옛 이름을 일부러 적는다
        for ln, line in enumerate(texts[num].splitlines(), 1):
            if line.startswith("#"):
                legacy_table = (num == "16" and line.startswith("#### 1.4.4"))
            for pat, why in RETIRED:
                if num == "00" and ("D17" in line or "D31" in line or "D16" in line):
                    continue  # 결정 기록은 옛 이름을 설명으로 인용한다
                if legacy_table or (num == "16" and "불가" in line and "계산식" in line):
                    continue  # 옛 표기 대응표와 계산식 금지 규칙 문장
                if re.search(pat, line):
                    errors.append(f"{p.name}:{ln}: {why}: {line.strip()[:80]}")
            for m in REF.finditer(line):
                doc, sec = m.group(1), m.group(2)
                if doc in secs and doc != "01" and sec not in secs[doc] and sec.split(".")[0] not in secs[doc]:
                    warns.append(f"{p.name}:{ln}: 참조 대상 없음 {doc} §{sec}")
            for m in TAG_LINE.finditer(line):
                body = VAR.sub("가나다", m.group(2))  # 변수는 3자로 계산(이름 평균)
                # 한 줄 기록 28자, 상세 기록 80자(14 §1). 문맥으로 둘을 가릴 수 없으므로
                # 80자 초과는 오류, 29~80자는 "한 줄"이라고 적힌 줄에서만 경고한다.
                if len(body) > 80:
                    errors.append(f"{p.name}:{ln}: 기록 {len(body)}자(>80): {m.group(0)[:60]}")
                elif len(body) > 28 and m.group(1) != "판정" and "한 줄" in line:
                    warns.append(f"{p.name}:{ln}: 한 줄 기록 {len(body)}자(>28): {m.group(0)[:60]}")
    for e in errors:
        print("ERROR", e)
    for w in warns:
        print("WARN ", w)
    print(f"\n검사 문서 {len(FILES)}개 · 오류 {len(errors)} · 경고 {len(warns)}")
    return 1 if errors else 0

if __name__ == "__main__":
    sys.exit(main())
