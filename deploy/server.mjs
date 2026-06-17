// Consensus Garden backend — serves dist/ + gasless mint API. Holds the sponsor key.
//   node deploy/server.mjs        (replaces python http.server on :3000)
// Env (../.env): DEPLOYER_PRIVATE_KEY (sponsor), optional PHASE2_AT (unix secs; builders-only until then), PORT.
import http from "http";
import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../.env") });
const PORT = Number(process.env.PORT || 3000);
const DIST = path.resolve(__dirname, "../garden-web");
const PHASE2_AT = Number(process.env.PHASE2_AT || 0); // 0 = builders-only until set

const pk = process.env.DEPLOYER_PRIVATE_KEY.trim();
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });
const { address } = JSON.parse(readFileSync(path.resolve(__dirname, "deployed_garden.json")));
const rd = (fn, args = []) => client.readContract({ address, functionName: fn, args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── builders whitelist + wallet→github (self-contained; generated from the GenLayer builder portal) ──
const _eligPath = path.resolve(__dirname, "eligible.json");
const _profPath = existsSync(_eligPath) ? _eligPath : path.resolve(__dirname, "../app/src/data/profiles.json");
const profiles = JSON.parse(readFileSync(_profPath));
const builders = {};
for (const [w, r] of Object.entries(profiles)) builders[w.toLowerCase()] = { github: (r.github || "").trim(), name: r.name || "" };
console.log(`→ ${Object.keys(builders).length} builders whitelisted | contract ${address} | sponsor ${account.address}`);
console.log(`→ phase: ${PHASE2_AT > 0 ? "opens to all at " + new Date(PHASE2_AT * 1000).toISOString() : "BUILDERS-ONLY (set PHASE2_AT to open)"}`);

const isAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || "");
const phaseOpen = () => PHASE2_AT > 0 && Date.now() / 1000 >= PHASE2_AT;
function eligibility(wallet) {
  const w = (wallet || "").toLowerCase();
  const b = builders[w];
  if (b) return { eligible: true, tier: "builder", github: b.github, name: b.name };
  if (phaseOpen()) return { eligible: true, tier: "public", github: "", name: "" };
  return { eligible: false, tier: "none", reason: "Builders-only for now — opens to everyone soon." };
}

// ── live token cache (refreshed every 60s, also written to the static json) ──
let tokCache = { ts: 0, tokens: [] }, reading = false;
async function refreshTokens() {
  if (reading) return; reading = true;
  try {
    const toks = [];
    for (let id = 1; id <= 2100; id++) {
      const o = await rd("owner_of", [id]); await sleep(220);
      if (!o || o === "") break;
      const seed = Number(await rd("seed_of", [id])); await sleep(220);
      const mint = Number(await rd("mint_ts", [id])); await sleep(220);
      const sp = Number(await rd("species_of", [id])); await sleep(220);
      const gh = await rd("github_of", [id]); await sleep(220);
      const dna = await rd("dna_of", [id]); await sleep(220);
      toks.push({ id, owner: o, seed, mint_ts: mint, species: sp, github: gh, dna });
    }
    tokCache = { ts: Date.now(), tokens: toks };
    writeFileSync(path.resolve(DIST, "garden_tokens.json"), JSON.stringify({ contract: address, count: toks.length, tokens: toks }));
  } catch (e) { console.error("token refresh:", e.message); }
  reading = false;
}
refreshTokens(); setInterval(refreshTokens, 60000);

// ── serialized sponsor tx queue (one nonce at a time) ──
let q = Promise.resolve();
const enqueue = (fn) => { const r = q.then(fn, fn); q = r.catch(() => {}); return r; };
async function doMint(wallet, github) {
  const existing = Number(await rd("token_of", [wallet]));
  if (existing > 0) return { already: true, tokenId: existing };
  const tx = await client.writeContract({ address, functionName: "mint", args: [wallet, github || ""], value: 0n });
  await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.ACCEPTED, retries: 120, interval: 5000 });
  const tid = Number(await rd("token_of", [wallet]));
  return { tokenId: tid, tx };
}

// ── static serving ──
const CT = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".glb": "model/gltf-binary", ".ico": "image/x-icon", ".woff2": "font/woff2" };
function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  let fp = path.join(DIST, p);
  if (!fp.startsWith(DIST)) { res.writeHead(403); return res.end("no"); }
  if (!existsSync(fp) || statSync(fp).isDirectory()) {
    const idx = path.join(fp, "index.html");
    if (existsSync(idx)) fp = idx; else { res.writeHead(404); return res.end("not found"); }
  }
  res.writeHead(200, { "content-type": CT[path.extname(fp)] || "application/octet-stream" });
  res.end(readFileSync(fp));
}
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const u = req.url.split("?")[0];
  try {
    if (u.startsWith("/api/eligibility/")) {
      const w = u.split("/").pop();
      if (!isAddr(w)) return json(res, 400, { error: "bad wallet" });
      return json(res, 200, { wallet: w, ...eligibility(w) });
    }
    if (u === "/api/stats") return json(res, 200, { supply: 2000, minted: tokCache.tokens.length, builders: Object.keys(builders).length, phaseOpen: phaseOpen(), phase2At: PHASE2_AT, contract: address });
    if (u === "/api/tokens") return json(res, 200, { contract: address, count: tokCache.tokens.length, tokens: tokCache.tokens });
    if (u.startsWith("/api/tokens/")) {
      const w = (u.split("/").pop() || "").toLowerCase();
      return json(res, 200, { tokens: tokCache.tokens.filter((t) => (t.owner || "").toLowerCase() === w) });
    }
    if (u === "/api/mint" && req.method === "POST") {
      let body = ""; req.on("data", (c) => (body += c)); 
      req.on("end", async () => {
        try {
          const { wallet } = JSON.parse(body || "{}");
          if (!isAddr(wallet)) return json(res, 400, { error: "bad wallet" });
          const el = eligibility(wallet);
          if (!el.eligible) return json(res, 403, { error: el.reason });
          const r = await enqueue(() => doMint(wallet, el.github));
          refreshTokens();
          return json(res, 200, { ok: true, ...r, tier: el.tier });
        } catch (e) { return json(res, 500, { error: e?.message || "mint failed" }); }
      });
      return;
    }
    return serveStatic(req, res);
  } catch (e) { return json(res, 500, { error: e?.message || "error" }); }
});
server.listen(PORT, () => console.log(`✅ Consensus Garden server on http://0.0.0.0:${PORT}`));
