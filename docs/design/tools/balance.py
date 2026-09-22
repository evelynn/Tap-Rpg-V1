# 텝 밸런스 기준값 산출 스크립트 — docs/design/01_핵심규칙_수치기준.md 부록 A
# 실행: python docs/design/tools/balance.py
import math

# ---- time ----
MIN_PER_YEAR = 12
START_AGE = 18

# ---- xp model ----
PROD_RATE = 0.75  # productive encounters per effective minute (avg incl. travel/rest/town)

def xp_encounter(L):
    return 6 + 3 * L

def target_min(n):
    return 4 + 20 * (1 - math.exp(-(n - 1) / 6)) + 0.3 * (n - 1)

def r5(x):
    return int(5 * round(x / 5))

def req(n):
    return max(25, r5(target_min(n) * PROD_RATE * xp_encounter(n)))

# stat assumption for main stat (combat build): birth 3, +1 at 4,10,16,22,28
def main_stat(L):
    return 3 + sum(1 for t in (4, 10, 16, 22, 28) if L >= t)

def dex_assume(L):
    return 2 + sum(1 for t in (7, 19) if L >= t)

def skill_rank(L):
    # combat skill rank expectation
    for lv, r in ((26, 5), (19, 4), (13, 3), (7, 2), (3, 1)):
        if L >= lv:
            return r
    return 0

def tier_of(L):
    if L <= 5: return 1
    if L <= 11: return 2
    if L <= 17: return 3
    if L <= 23: return 4
    return 5

W_DMG = {1: (2, 5), 2: (5, 10), 3: (8, 16), 4: (12, 22), 5: (17, 29)}
A_DEF = {1: 1, 2: 3, 3: 5, 4: 7, 5: 9}
A_HP = {1: 0, 2: 5, 3: 10, 4: 15, 5: 20}
GRADE = {'일반': (1.0, 0, 0), '좋은': (1.15, 1, 1), '희귀': (1.3, 1, 2), '전설': (1.45, 2, 3)}
# grade: dmg mult, hit bonus, def bonus

def char(L, grade='일반'):
    t = tier_of(L)
    m, hb, db = GRADE[grade]
    s = main_stat(L)
    d = dex_assume(L)
    lo, hi = W_DMG[t]
    wavg = (lo + hi) / 2 * m
    dmg = wavg + s // 2
    ab = s + skill_rank(L) + hb
    ac = 10 + A_DEF[t] + db + d // 2
    hp = 20 + 4 * L + 3 * s + A_HP[t]
    return dict(t=t, ab=ab, ac=ac, hp=hp, dmg=dmg)

def enemy(L, kind='normal'):
    hp = 8 + 2.3 * L
    ac = 10 + L // 3
    hit = 2 + L // 3
    dlo = 1 + L // 6
    dhi = 2 + int(L / 2.5)
    if kind == 'elite':
        hp *= 2.5; hit += 2; dlo = math.ceil(dlo * 1.3); dhi = math.ceil(dhi * 1.3)
    if kind == 'boss':
        hp *= 5; ac += 2; hit += 3; dlo = math.ceil(dlo * 1.5); dhi = math.ceil(dhi * 1.5)
    return dict(hp=round(hp), ac=ac, hit=hit, dlo=dlo, dhi=dhi)

def p_hit(bonus, ac):
    need = ac - bonus
    p = (21 - need) / 20
    return min(0.95, max(0.05, p))

def coins(L):
    return round((3 + 1.5 * L) * 1.08 ** L)

print('== LEVEL TABLE ==')
cum = 0
cmin = 0.0
print('Lv | req | cumXP | min_at | age | rank | tier | HP | AB | AC | dmg')
for n in range(1, 31):
    c = char(n)
    age = START_AGE + cmin / MIN_PER_YEAR
    print(f'{n:2d} | {req(n) if n<30 else "-":>5} | {cum:6d} | {cmin:6.0f} | {age:4.1f} | {tier_of(n)} | HP {c["hp"]:3d} | AB {c["ab"]:2d} | AC {c["ac"]:2d} | dmg {c["dmg"]:.1f}')
    if n < 30:
        cum += req(n)
        cmin += target_min(n)

print()
print('== FIGHT CHECK (char L vs enemy L, normal grade gear) ==')
for L in (1, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30):
    c = char(L)
    e = enemy(L)
    ph = p_hit(c['ab'], e['ac'])
    rounds = e['hp'] / (c['dmg'] * ph)
    pe = p_hit(e['hit'], c['ac'])
    edmg = (e['dlo'] + e['dhi']) / 2
    loss = rounds * pe * edmg
    print(f'L{L:2d} hit {ph:.2f} rounds {rounds:.1f} enemyHit {pe:.2f} loss {loss:.1f} ({loss / c["hp"] * 100:.1f}% of {c["hp"]}) | enemy HP {e["hp"]} AC {e["ac"]} hit +{e["hit"]} dmg {e["dlo"]}-{e["dhi"]} | coins {coins(L)} xp {xp_encounter(L)}')

print()
print('== GOOD grade check ==')
for L in (10, 20, 28):
    c = char(L, '좋은')
    e = enemy(L)
    ph = p_hit(c['ab'], e['ac'])
    rounds = e['hp'] / (c['dmg'] * ph)
    pe = p_hit(e['hit'], c['ac'])
    loss = rounds * pe * (e['dlo'] + e['dhi']) / 2
    print(f'L{L} good: rounds {rounds:.1f} loss {loss / c["hp"] * 100:.1f}%')

print()
print('== ENEMY REGISTRY ==')
reg = [('EN01 여울 들쥐', 1, 'normal'), ('EN02 큰 들쥐', 4, 'normal'), ('EN03 여울 늑대', 8, 'normal'),
       ('EN04 잿빛 늑대', 15, 'normal'), ('EN05 종굴 박쥐', 7, 'normal'), ('EN06 쇳소리 박쥐', 15, 'normal'),
       ('EN07 그림자 박쥐', 23, 'normal'), ('EN08 폐광 코볼트', 10, 'normal'), ('EN09 코볼트 광부장', 18, 'normal'),
       ('EN10 녹슨 투구 코볼트', 26, 'normal'), ('EB01 코볼트 두목', 13, 'elite'), ('EB02 늙은 광부장', 21, 'elite'),
       ('EB03 부서진 종의 파수꾼', 29, 'boss')]
for name, L, k in reg:
    e = enemy(L, k)
    mult = {'normal': 1, 'elite': 2.5, 'boss': 10}[k]
    print(f'{name} L{L} {k}: HP {e["hp"]} AC {e["ac"]} 명중 +{e["hit"]} 피해 {e["dlo"]}~{e["dhi"]} XP {round(xp_encounter(L) * mult)} 동전 {round(coins(L) * mult)}')

print()
print('== income per minute (hunting, appropriate) ==')
for L in (1, 3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30):
    print(f'L{L}: coins/enc {coins(L)} -> ~{coins(L) * PROD_RATE:.0f}/min, xp/min {xp_encounter(L) * PROD_RATE:.0f}')


