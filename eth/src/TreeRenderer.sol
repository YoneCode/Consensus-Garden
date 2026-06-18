// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/// @title TreeRenderer
/// @notice 1:1 Solidity port of the on-chain GenLayer renderer
/// (contracts/consensus_garden.py `_render`). Integer-only, deterministic.
/// Python `//` (floor) and `%` (sign-of-divisor) are reproduced via fdiv/pmod.
library TreeRenderer {
    // SIN90: 91 entries, 2 bytes each (big-endian uint16).
    bytes constant SIN =
        hex"0000001100230034004600570069007a008b009c00ae00bf00d000e100f2010301140124013501460156016601770187019701a701b601c601d501e501f4020302120221022f023e024c025a0268027502830290029d02aa02b702c302cf02db02e702f302fe03090314031f03290333033d0347035003590362036b0373037b0383038a03920399039f03a603ac03b203b703bc03c103c603ca03ce03d203d603d903dc03de03e103e303e403e603e703e703e803e8";

    struct Ctx {
        uint256 lcg;
        int256 spread;
        int256 lean;
        int256 leafSz;
        bool flowering;
        int256 agePM;
        uint256 sp;
        int256[5][] segs; // x1,y1,x2,y2,sw
        uint256 segN;
        int256[5][] leaves; // x,y,r,colIdx(0=fl,1=l1,2=l2),fl(0/1)
        uint256 leafN;
    }

    struct Buf {
        bytes data;
        uint256 len;
    }

    // ---- integer helpers (match Python) ----
    function _s90(uint256 i) private pure returns (int256) {
        uint256 o = i * 2;
        return int256(uint256(uint8(SIN[o])) << 8 | uint256(uint8(SIN[o + 1])));
    }

    function pmod(int256 a, int256 m) internal pure returns (int256 r) {
        r = a % m;
        if (r < 0) r += m;
    }

    function fdiv(int256 a, int256 b) internal pure returns (int256 q) {
        q = a / b;
        if ((a % b != 0) && ((a < 0) != (b < 0))) q -= 1;
    }

    function isin(int256 a) internal pure returns (int256) {
        a = pmod(a, 360);
        if (a <= 90) return _s90(uint256(a));
        if (a <= 180) return _s90(uint256(180 - a));
        if (a <= 270) return -_s90(uint256(a - 180));
        return -_s90(uint256(360 - a));
    }

    function icos(int256 a) internal pure returns (int256) {
        return isin(a + 90);
    }

    function rnd(Ctx memory c) internal pure returns (int256) {
        c.lcg = (c.lcg * 1103515245 + 12345) & 0x7FFFFFFF;
        return int256(c.lcg % 1000);
    }

    function imax(int256 a, int256 b) internal pure returns (int256) {
        return a > b ? a : b;
    }

    // ---- string helpers ----
    function itoa(int256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        bool neg = v < 0;
        uint256 x = neg ? uint256(-v) : uint256(v);
        bytes memory tmp = new bytes(78);
        uint256 i = 78;
        while (x != 0) {
            i--;
            tmp[i] = bytes1(uint8(48 + (x % 10)));
            x /= 10;
        }
        bytes memory out = new bytes(78 - i + (neg ? 1 : 0));
        uint256 j = 0;
        if (neg) {
            out[0] = "-";
            j = 1;
        }
        for (uint256 k = i; k < 78; k++) {
            out[j++] = tmp[k];
        }
        return string(out);
    }

    function app(Buf memory b, bytes memory s) internal pure {
        uint256 n = s.length;
        if (n == 0) return;
        bytes memory d = b.data;
        uint256 L = b.len;
        assembly {
            mcopy(add(add(d, 0x20), L), add(s, 0x20), n)
        }
        b.len = L + n;
    }

    function appI(Buf memory b, int256 v) internal pure {
        app(b, bytes(itoa(v)));
    }

    // ---- palette ----
    // returns [n,tr,l1,l2,fl,s0,s1,pot]
    function pal(uint256 sp) internal pure returns (string[8] memory p) {
        uint256 i = sp % 5;
        if (i == 0) {
            p = ["MAPLE", "#5b3a22", "#2f9e54", "#7ed957", "#ff6b9d", "#0e1626", "#1b2d3a", "#3a2a20"];
        } else if (i == 1) {
            p = ["SAKURA", "#5b3a2a", "#7fb069", "#a7d98a", "#ffd1e8", "#1a1322", "#2a1f33", "#3a2a24"];
        } else if (i == 2) {
            p = ["PINE", "#42301e", "#1f7a4d", "#39a06a", "#eaf6c8", "#08130f", "#10231a", "#2e251b"];
        } else if (i == 3) {
            p = ["EMBER", "#4a2a1a", "#e0843a", "#f5b454", "#ffe08a", "#1a0f0a", "#2a160d", "#33231a"];
        } else {
            p = ["FROST", "#3a4a55", "#5fd3d8", "#9af0e6", "#eaffff", "#0a1420", "#13212e", "#243038"];
        }
    }

    // ---- recursive branch (mirrors Python `br`) ----
    function br(Ctx memory c, int256 x, int256 y, int256 ang, int256 length, int256 w, int256 d) internal pure {
        if (c.segN >= 420) return;
        if (d <= 0 || length < 4) {
            if (c.agePM > 60 && c.leafN < 520) {
                int256 k = 2 + fdiv(rnd(c) * 3, 1000);
                int256 j = 0;
                while (j < k) {
                    int256 lx = x + fdiv(fdiv((rnd(c) - 500) * c.leafSz * 3, 1000), 10);
                    int256 ly = y + fdiv(fdiv((rnd(c) - 500) * c.leafSz * 3, 1000), 10);
                    bool fl = c.flowering && c.agePM > 550 && rnd(c) < 500;
                    int256 colIdx;
                    if (fl) {
                        colIdx = 0;
                    } else {
                        colIdx = rnd(c) < 600 ? int256(1) : int256(2);
                    }
                    c.leaves[c.leafN] = [lx, ly, imax(2, fdiv(c.leafSz, 10)), colIdx, fl ? int256(1) : int256(0)];
                    c.leafN++;
                    j++;
                }
            }
            return;
        }
        int256 x2 = x + fdiv(isin(ang) * length, 1000);
        int256 y2 = y - fdiv(icos(ang) * length, 1000);
        c.segs[c.segN] = [x, y, x2, y2, imax(1, fdiv(w, 10))];
        c.segN++;
        int256 i = 0;
        while (i < 2) {
            int256 off = c.spread * (2 * i - 1) + fdiv((rnd(c) - 500) * 16, 1000);
            br(c, x2, y2, ang + off + fdiv(c.lean * 4, 10), fdiv(length * 74, 100), imax(10, fdiv(w * 7, 10)), d - 1);
            i++;
        }
    }

    function render(uint256 seed, int256 agePM, uint256 sp) internal pure returns (string memory) {
        Ctx memory c;
        c.lcg = (seed & 0xFFFFFFFF);
        if (c.lcg == 0) c.lcg = 1;
        c.agePM = agePM;
        c.sp = sp;
        c.segs = new int256[5][](421);
        c.leaves = new int256[5][](530);

        string[8] memory P = pal(sp);

        c.spread = 22 + fdiv(rnd(c) * 20, 1000);
        rnd(c);
        c.lean = fdiv((rnd(c) - 500) * 18, 1000);
        c.flowering = (sp == 1) || (rnd(c) < 550);
        int256 depth = 2 + fdiv(agePM * 5, 1000);
        int256 trunkLen = 16 + fdiv(agePM * 95, 1000);
        int256 trunkW = 30 + fdiv(agePM * 120, 1000);
        c.leafSz = 20 + fdiv(agePM * 42, 1000);

        Buf memory b = Buf(new bytes(131072), 0);
        app(b, '<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520">');
        app(b, '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="');
        app(b, bytes(P[5]));
        app(b, '"/><stop offset="1" stop-color="');
        app(b, bytes(P[6]));
        app(b, '"/></linearGradient><linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="0.5" stop-color="');
        app(b, bytes(P[1]));
        app(b, '"/><stop offset="1" stop-color="#000" stop-opacity="0.25"/></linearGradient></defs>');
        app(b, '<rect width="420" height="520" fill="url(#s)"/>');
        app(b, '<ellipse cx="210" cy="452" rx="150" ry="20" fill="#000" opacity="0.30"/>');

        if (agePM <= 50) {
            app(b, '<circle cx="205" cy="416" r="3" fill="');
            app(b, bytes(P[2]));
            app(b, '"/><circle cx="215" cy="414" r="3" fill="');
            app(b, bytes(P[3]));
            app(b, '"/>');
        } else {
            br(c, 210, 416, c.lean, trunkLen * 2, trunkW, depth);
            for (uint256 s = 0; s < c.segN; s++) {
                int256[5] memory g = c.segs[s];
                app(b, '<line x1="');
                appI(b, g[0]);
                app(b, '" y1="');
                appI(b, g[1]);
                app(b, '" x2="');
                appI(b, g[2]);
                app(b, '" y2="');
                appI(b, g[3]);
                app(b, '" stroke="url(#t)" stroke-width="');
                appI(b, g[4]);
                app(b, '" stroke-linecap="round"/>');
            }
            for (uint256 l = 0; l < c.leafN; l++) {
                int256[5] memory lf = c.leaves[l];
                string memory col = lf[3] == 0 ? P[4] : (lf[3] == 1 ? P[2] : P[3]);
                if (lf[4] == 1) {
                    app(b, '<circle cx="');
                    appI(b, lf[0]);
                    app(b, '" cy="');
                    appI(b, lf[1]);
                    app(b, '" r="');
                    appI(b, lf[2] + 1);
                    app(b, '" fill="');
                    app(b, bytes(col));
                    app(b, '"/><circle cx="');
                    appI(b, lf[0]);
                    app(b, '" cy="');
                    appI(b, lf[1]);
                    app(b, '" r="');
                    appI(b, imax(1, fdiv(lf[2], 2)));
                    app(b, '" fill="#ffe08a"/>');
                } else {
                    app(b, '<ellipse cx="');
                    appI(b, lf[0]);
                    app(b, '" cy="');
                    appI(b, lf[1]);
                    app(b, '" rx="');
                    appI(b, lf[2]);
                    app(b, '" ry="');
                    appI(b, lf[2] + fdiv(lf[2], 2));
                    app(b, '" fill="');
                    app(b, bytes(col));
                    app(b, '"/>');
                }
            }
        }

        app(b, '<path d="M165,452 L255,452 L243,500 L177,500 Z" fill="');
        app(b, bytes(P[7]));
        app(b, '"/>');
        app(b, '<rect x="159" y="442" width="102" height="12" rx="3" fill="');
        app(b, bytes(P[7]));
        app(b, '"/>');
        app(b, '<text x="20" y="34" fill="');
        app(b, bytes(P[3]));
        app(b, '" font-family="monospace" font-size="13" letter-spacing="2" opacity="0.85">');
        app(b, bytes(P[0]));
        app(b, unicode" \u00b7 ");
        appI(b, fdiv(agePM * 170, 1000));
        app(b, "MO</text>");
        app(b, "</svg>");

        bytes memory d = b.data;
        uint256 fin = b.len;
        assembly {
            mstore(d, fin)
        }
        return string(d);
    }
}
