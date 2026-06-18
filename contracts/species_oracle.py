# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def _extract_int(d: dict, *keys: str) -> int:
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return int(round(float(str(d[k]).strip())))
            except (ValueError, TypeError):
                continue
    raise gl.vm.UserError("LLM response missing numeric field")


def _safe(s: str) -> str:
    return str(s).replace('"', "").replace("\\", "").replace("\n", " ")[:32]


def _count_langs(text: str) -> dict:
    """Tally `"language":"X"` occurrences in a /repos JSON body without a JSON
    parser. Null languages use no quotes, so they are naturally skipped."""
    counts: dict = {}
    needle = '"language":"'
    i = 0
    while True:
        j = text.find(needle, i)
        if j < 0:
            break
        k = text.find('"', j + len(needle))
        if k < 0:
            break
        lang = text[j + len(needle):k]
        if lang:
            counts[lang] = counts.get(lang, 0) + 1
        i = k + 1
    return counts


# Consensus Garden — GenLayer SPECIES ORACLE for the Ethereum hybrid.
# A relayer/keeper watches Planted(id, owner, seed, github) events on the ETH
# NFT, asks this contract to forge the builder's SPECIES from their public
# GitHub via AI consensus, then writes the agreed species onto the ETH NFT via
# reveal(id, species). This is the GenLayer "brain"; ETH is the "body".
# Species is IDENTITY only (kind of tree), never a score; size is time-only on ETH.

class SpeciesOracle(gl.Contract):
    # github handle (lowercased) -> species+1  (0 = not yet resolved)
    results: TreeMap[str, u256]
    # github handle -> compact DNA json (lang/archetype) for display
    dna: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.write
    def resolve(self, github: str) -> int:
        """Forge a FAIR builder species (0-4) from a public GitHub profile via
        strict categorical AI consensus. Caches by handle so the relayer pays
        the consensus cost once per builder."""
        handle = github.strip()
        if handle == "":
            raise gl.vm.UserError("empty handle")
        key = handle.lower()
        url = "https://api.github.com/users/" + handle

        def leader_fn():
            prof = ""
            try:
                prof = gl.nondet.web.get(url).body.decode("utf-8")[:1500]
            except Exception:
                prof = ""
            if prof == "" or ("Not Found" in prof and '"message"' in prof):
                return {"species": 4, "lang": "unknown", "archetype": "explorer"}
            repos_txt = ""
            try:
                repos_txt = gl.nondet.web.get(
                    "https://api.github.com/users/" + handle + "/repos?per_page=100&sort=pushed"
                ).body.decode("utf-8")[:120000]
            except Exception:
                repos_txt = ""
            counts = _count_langs(repos_txt)
            top = sorted(counts.items(), key=lambda kv: -kv[1])[:8]
            lang_summary = ", ".join(str(k) + ": " + str(v) for k, v in top) if top else "no public repo languages found"
            prompt = f"""You are forging a FAIR "builder DNA" for a living-tree NFT from a public GitHub profile.
This decides the tree's SPECIES and character only — it is an IDENTITY, never a score or ranking.
Every builder gets an equally beautiful, equally growing tree; only the KIND differs.

GitHub handle: {handle}
Public repository language usage, most-used first (repo counts): {lang_summary}
Short profile JSON (for bio/context): {prof}

Pick the species from the builder's DOMINANT repository language:
0 = MAPLE  (Python / data / AI / ML / notebooks)
1 = SAKURA (JavaScript / TypeScript / Vue / Svelte / frontend / design)
2 = PINE   (Rust / Go / C# / systems / protocol / infra / devops)
3 = EMBER  (Solidity / C / C++ / Cairo / Move / smart contracts / low-level)
4 = FROST  (no clear dominant language / polyglot / community / docs / unknown)

Weight by the repo language counts above. If one language clearly leads, choose its species.
Only use FROST (4) when there is genuinely no dominant language.

Respond ONLY as JSON:
{{"species": <int 0-4>, "lang": "<dominant language or 'unknown'>", "archetype": "<one or two words>"}}"""
            try:
                out = gl.nondet.exec_prompt(prompt, response_format="json")
                sp = _clamp(_extract_int(out, "species"), 0, 4)
                return {"species": sp, "lang": _safe(out.get("lang", "unknown")), "archetype": _safe(out.get("archetype", ""))}
            except Exception:
                return {"species": 4, "lang": "unknown", "archetype": "explorer"}

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            mine = leader_fn()
            leader = leaders_res.calldata
            if not isinstance(leader, dict) or "species" not in leader:
                return False
            return int(mine["species"]) == int(leader["species"])

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        sp = int(result["species"])
        self.results[key] = u256(sp + 1)
        self.dna[key] = ('{"species":' + str(sp) + ',"lang":"' + _safe(result.get("lang", ""))
                         + '","archetype":"' + _safe(result.get("archetype", "")) + '"}')
        return sp

    @gl.public.view
    def species_of(self, github: str) -> int:
        v = int(self.results.get(github.strip().lower(), u256(0)))
        return (v - 1) if v > 0 else -1  # -1 = not resolved yet

    @gl.public.view
    def dna_of(self, github: str) -> str:
        return self.dna.get(github.strip().lower(), "")
