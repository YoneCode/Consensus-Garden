# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from datetime import datetime, timezone
import json
import time

# WorldState — GenLayer brings the REAL world on-chain for the garden billboard.
#   sync_prices(): fetch live ETH/BTC (USD) via web + validator consensus (price
#                  agreement within a tolerance band).
#   sync_event(url, question): fetch a public page and AI-extract a one-line
#                  headline (e.g. a World Cup score). Best-effort, never throws.
# The billboard reads these and shows "ETH $X · verified on-chain by GenLayer".


class WorldState(gl.Contract):
    owner: Address
    eth_usd: u256
    btc_usd: u256
    headline: str
    updated: u256

    def __init__(self):
        self.owner = gl.message.sender_address
        self.eth_usd = u256(0)
        self.btc_usd = u256(0)
        self.headline = ""
        self.updated = u256(0)

    @gl.public.write
    def sync_prices(self) -> None:
        url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd"

        def leader_fn():
            try:
                resp = gl.nondet.web.get(url)
                data = resp.body.decode("utf-8")[:2000]
                j = json.loads(data)
                return {"ok": True, "eth": int(round(float(j["ethereum"]["usd"]))), "btc": int(round(float(j["bitcoin"]["usd"])))}
            except Exception:
                return {"ok": False, "eth": 0, "btc": 0}

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            mine = leader_fn()
            leader = leaders_res.calldata
            if not isinstance(leader, dict):
                return False
            if not leader.get("ok") or not mine.get("ok"):
                return bool(leader.get("ok")) == bool(mine.get("ok"))
            le = int(leader.get("eth", 0)); lb = int(leader.get("btc", 0))
            oke = abs(mine["eth"] - le) <= max(1, le * 3 // 100)
            okb = abs(mine["btc"] - lb) <= max(1, lb * 3 // 100)
            return oke and okb

        r = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        if r.get("ok"):
            self.eth_usd = u256(int(r["eth"]))
            self.btc_usd = u256(int(r["btc"]))
            self.updated = u256(int(datetime.now(timezone.utc).timestamp()))

    @gl.public.write
    def sync_event(self, url: str, question: str) -> None:
        def leader_fn():
            data = ""
            try:
                resp = gl.nondet.web.get(url)
                data = resp.body.decode("utf-8")[:6000]
            except Exception:
                data = ""
            if data == "":
                return {"line": ""}
            prompt = f"""From the page content below, answer in ONE short headline (max 70 chars), no preamble.
Question: {question}
Content:
{data}
Respond ONLY as JSON: {{"line": "<headline>"}}"""
            try:
                out = gl.nondet.exec_prompt(prompt, response_format="json")
                return {"line": str(out.get("line", "")).replace('"', "").replace("\\", "")[:70]}
            except Exception:
                return {"line": ""}

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            return isinstance(leaders_res.calldata, dict)

        r = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        self.headline = r.get("line", "")
        self.updated = u256(int(datetime.now(timezone.utc).timestamp()))

    @gl.public.view
    def get_eth(self) -> u256:
        return self.eth_usd

    @gl.public.view
    def get_btc(self) -> u256:
        return self.btc_usd

    @gl.public.view
    def get_headline(self) -> str:
        return self.headline

    @gl.public.view
    def get_updated(self) -> u256:
        return self.updated

    @gl.public.view
    def get_chain_now(self) -> u256:
        # GenLayer's deterministic clock — every validator independently agrees on
        # this value. A consensus-verified on-chain clock: impossible on a normal chain.
        return u256(int(time.time()))
