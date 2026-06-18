// Consensus Garden — backend mint attestor (anti-bot signer).
//
// Flow: the frontend logs the user in with Privy (wallet + GitHub OAuth) and
// POSTs { wallet, privyToken } here. We:
//   1) verify the Privy token and read the user's VERIFIED GitHub login,
//   2) fetch the GitHub profile and require the account to be >= 1 month old,
//   3) EIP-712 sign Mint(wallet, github) with SIGNER_PRIVATE_KEY.
// The contract's mint() recovers this signer and reverts otherwise, so a bot
// with no real, OAuth-verified, >=1-month-old GitHub simply cannot mint.
//
// Env:
//   SIGNER_PRIVATE_KEY   (the address set as `signer` in the contract)
//   GARDEN_ADDRESS       (verifyingContract for EIP-712)
//   CHAIN_ID             (default 11155111 Sepolia)
//   PRIVY_APP_ID, PRIVY_APP_SECRET   (prod GitHub verification)
//   MIN_ACCOUNT_AGE_DAYS (default 30)
//   GATE_DEV=1           (DEV ONLY: trust posted `github` without Privy — never in prod)
//   PORT                 (default 8788)
import http from "node:http";
import { privateKeyToAccount } from "viem/accounts";

const SIGNER_PK = (process.env.SIGNER_PRIVATE_KEY || "").startsWith("0x") ? process.env.SIGNER_PRIVATE_KEY : "0x" + process.env.SIGNER_PRIVATE_KEY;
const GARDEN = process.env.GARDEN_ADDRESS;
const CHAIN_ID = Number(process.env.CHAIN_ID || 11155111);
const MIN_AGE_DAYS = Number(process.env.MIN_ACCOUNT_AGE_DAYS || 30);
const PORT = Number(process.env.PORT || 8788);
const DEV = process.env.GATE_DEV === "1";

if (!SIGNER_PK || !GARDEN) { console.error("set SIGNER_PRIVATE_KEY and GARDEN_ADDRESS"); process.exit(1); }
const signer = privateKeyToAccount(SIGNER_PK);

const DOMAIN = { name: "Consensus Garden", version: "1", chainId: CHAIN_ID, verifyingContract: GARDEN };
const TYPES = { Mint: [{ name: "wallet", type: "address" }, { name: "github", type: "string" }] };

// --- verify the user's GitHub identity via Privy (prod) ---
async function githubFromPrivy(token) {
  const { PrivyClient } = await import("@privy-io/server-auth");
  const privy = new PrivyClient(process.env.PRIVY_APP_ID, process.env.PRIVY_APP_SECRET);
  const claims = await privy.verifyAuthToken(token);          // throws if invalid/expired
  const user = await privy.getUser(claims.userId);
  const gh = (user.linkedAccounts || []).find((a) => a.type === "github_oauth");
  if (!gh || !gh.username) throw new Error("no GitHub linked to this Privy account");
  return gh.username;
}

// --- require the GitHub account to be at least MIN_AGE_DAYS old ---
async function checkGithubAge(login) {
  const r = await fetch("https://api.github.com/users/" + encodeURIComponent(login), {
    headers: { "User-Agent": "consensus-garden", ...(process.env.GITHUB_TOKEN ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN } : {}) },
  });
  if (r.status === 404) throw new Error("GitHub user not found");
  if (!r.ok) throw new Error("GitHub API error " + r.status);
  const p = await r.json();
  const ageDays = (Date.now() - new Date(p.created_at).getTime()) / 86400000;
  if (ageDays < MIN_AGE_DAYS) throw new Error(`GitHub account too new (${Math.floor(ageDays)}d < ${MIN_AGE_DAYS}d)`);
  return { login: p.login, ageDays: Math.floor(ageDays) };
}

async function handleSign(body) {
  const wallet = (body.wallet || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("bad wallet");
  let login;
  if (DEV) {
    if (!body.github) throw new Error("dev mode: provide github");
    login = body.github.trim().replace(/^@/, "");
  } else {
    if (!body.privyToken) throw new Error("missing privyToken");
    login = await githubFromPrivy(body.privyToken);
  }
  const info = await checkGithubAge(login);
  const signature = await signer.signTypedData({ domain: DOMAIN, types: TYPES, primaryType: "Mint", message: { wallet, github: info.login } });
  return { wallet, github: info.login, ageDays: info.ageDays, signature, signer: signer.address };
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method === "GET" && req.url === "/health") { res.writeHead(200); return res.end(JSON.stringify({ ok: true, signer: signer.address, dev: DEV })); }
  if (req.method !== "POST" || req.url !== "/sign") { res.writeHead(404); return res.end("not found"); }
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", async () => {
    try {
      const out = await handleSign(JSON.parse(data || "{}"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    } catch (e) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});
server.listen(PORT, () => console.log(`[attestor] :${PORT} signer=${signer.address} dev=${DEV} minAge=${MIN_AGE_DAYS}d`));
