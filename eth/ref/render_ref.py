#!/usr/bin/env python3
# Ground-truth renderer: EXACT copy of the on-chain pure functions from
# contracts/consensus_garden.py. Used only to verify the Solidity port is 1:1.
import json, sys

SIN90 = [0,17,35,52,70,87,105,122,139,156,174,191,208,225,242,259,276,292,309,326,
342,358,375,391,407,423,438,454,469,485,500,515,530,545,559,574,588,602,616,629,
643,656,669,682,695,707,719,731,743,755,766,777,788,799,809,819,829,839,848,857,
866,875,883,891,899,906,914,921,927,934,940,946,951,956,961,966,970,974,978,982,
985,988,990,993,995,996,998,999,999,1000,1000]


def _isin(a: int) -> int:
    a = a % 360
    if a <= 90:  return SIN90[a]
    if a <= 180: return SIN90[180 - a]
    if a <= 270: return -SIN90[a - 180]
    return -SIN90[360 - a]


def _icos(a: int) -> int:
    return _isin(a + 90)


PAL = [
 {"n":"MAPLE","tr":"#5b3a22","l1":"#2f9e54","l2":"#7ed957","fl":"#ff6b9d","s0":"#0e1626","s1":"#1b2d3a","pot":"#3a2a20"},
 {"n":"SAKURA","tr":"#5b3a2a","l1":"#7fb069","l2":"#a7d98a","fl":"#ffd1e8","s0":"#1a1322","s1":"#2a1f33","pot":"#3a2a24"},
 {"n":"PINE","tr":"#42301e","l1":"#1f7a4d","l2":"#39a06a","fl":"#eaf6c8","s0":"#08130f","s1":"#10231a","pot":"#2e251b"},
 {"n":"EMBER","tr":"#4a2a1a","l1":"#e0843a","l2":"#f5b454","fl":"#ffe08a","s0":"#1a0f0a","s1":"#2a160d","pot":"#33231a"},
 {"n":"FROST","tr":"#3a4a55","l1":"#5fd3d8","l2":"#9af0e6","fl":"#eaffff","s0":"#0a1420","s1":"#13212e","pot":"#243038"},
]

_BP = [(0,0),(3600,120),(86400,300),(604800,550),(2592000,800),(15552000,1000)]


def _growth_pm(t: int) -> int:
    if t <= 0:
        return 0
    i = 1
    while i < len(_BP):
        if t < _BP[i][0]:
            t0 = _BP[i-1][0]; p0 = _BP[i-1][1]; t1 = _BP[i][0]; p1 = _BP[i][1]
            return p0 + (p1 - p0) * (t - t0) // (t1 - t0)
        i += 1
    return 1000


def _seed(wallet: str) -> int:
    try:
        return (int(wallet, 16) & 0xFFFFFFFF) or 1
    except Exception:
        s = 0
        for ch in wallet:
            s = (s * 131 + ord(ch)) & 0xFFFFFFFF
        return s or 1


def _render(seed: int, agePM: int, sp: int) -> str:
    s = [(seed & 0xFFFFFFFF) or 1]

    def rnd():
        s[0] = (s[0] * 1103515245 + 12345) & 0x7FFFFFFF
        return s[0] % 1000

    P = PAL[sp % 5]
    spread = 22 + rnd() * 20 // 1000
    rnd()
    lean = (rnd() - 500) * 18 // 1000
    flowering = (sp == 1) or (rnd() < 550)
    depth = 2 + agePM * 5 // 1000
    trunk_len = 16 + agePM * 95 // 1000
    trunk_w = 30 + agePM * 120 // 1000
    leaf_sz = 20 + agePM * 42 // 1000
    segs = []
    leaves = []

    def br(x, y, ang, length, w, d):
        if len(segs) >= 420:
            return
        if d <= 0 or length < 4:
            if agePM > 60 and len(leaves) < 520:
                k = 2 + rnd() * 3 // 1000
                j = 0
                while j < k:
                    lx = x + (rnd() - 500) * leaf_sz * 3 // 1000 // 10
                    ly = y + (rnd() - 500) * leaf_sz * 3 // 1000 // 10
                    fl = flowering and agePM > 550 and rnd() < 500
                    col = P["fl"] if fl else (P["l1"] if rnd() < 600 else P["l2"])
                    leaves.append((lx, ly, max(2, leaf_sz // 10), col, fl))
                    j += 1
            return
        x2 = x + _isin(ang) * length // 1000
        y2 = y - _icos(ang) * length // 1000
        segs.append((x, y, x2, y2, max(1, w // 10)))
        i = 0
        while i < 2:
            off = spread * (2 * i - 1) + (rnd() - 500) * 16 // 1000
            br(x2, y2, ang + off + lean * 4 // 10, length * 74 // 100, max(10, w * 7 // 10), d - 1)
            i += 1

    o = []
    o.append('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520">')
    o.append('<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'
             + P["s0"] + '"/><stop offset="1" stop-color="' + P["s1"] + '"/></linearGradient>'
             '<linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.35"/>'
             '<stop offset="0.5" stop-color="' + P["tr"] + '"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient></defs>')
    o.append('<rect width="420" height="520" fill="url(#s)"/>')
    o.append('<ellipse cx="210" cy="452" rx="150" ry="20" fill="#000" opacity="0.30"/>')
    if agePM <= 50:
        o.append('<circle cx="205" cy="416" r="3" fill="' + P["l1"] + '"/><circle cx="215" cy="414" r="3" fill="' + P["l2"] + '"/>')
    else:
        br(210, 416, lean, trunk_len * 2, trunk_w, depth)
        for seg in segs:
            o.append('<line x1="' + str(seg[0]) + '" y1="' + str(seg[1]) + '" x2="' + str(seg[2]) + '" y2="' + str(seg[3])
                     + '" stroke="url(#t)" stroke-width="' + str(seg[4]) + '" stroke-linecap="round"/>')
        for lf in leaves:
            if lf[4]:
                o.append('<circle cx="' + str(lf[0]) + '" cy="' + str(lf[1]) + '" r="' + str(lf[2] + 1) + '" fill="' + lf[3] + '"/>'
                         '<circle cx="' + str(lf[0]) + '" cy="' + str(lf[1]) + '" r="' + str(max(1, lf[2] // 2)) + '" fill="#ffe08a"/>')
            else:
                o.append('<ellipse cx="' + str(lf[0]) + '" cy="' + str(lf[1]) + '" rx="' + str(lf[2]) + '" ry="' + str(lf[2] + lf[2] // 2) + '" fill="' + lf[3] + '"/>')
    o.append('<path d="M165,452 L255,452 L243,500 L177,500 Z" fill="' + P["pot"] + '"/>')
    o.append('<rect x="159" y="442" width="102" height="12" rx="3" fill="' + P["pot"] + '"/>')
    o.append('<text x="20" y="34" fill="' + P["l2"] + '" font-family="monospace" font-size="13" letter-spacing="2" opacity="0.85">'
             + P["n"] + ' \u00b7 ' + str(agePM * 170 // 1000) + 'MO</text>')
    o.append('</svg>')
    return "".join(o)


if __name__ == "__main__":
    seeds = [1, 2, 7, 42, 255, 1000, 65535, 287454020, 1309375808, 2482190054,
             3000000000, 4116849636, 0xFFFFFFFF, 1103515245, 999999999, 123456789]
    ages = [0, 30, 50, 51, 60, 61, 120, 300, 550, 551, 800, 1000]
    cases = []
    for sd in seeds:
        for ag in ages:
            for sp in range(5):
                cases.append({"seed": sd, "agePM": ag, "sp": sp,
                              "svg": _render(sd, ag, sp)})
    json.dump(cases, sys.stdout)
