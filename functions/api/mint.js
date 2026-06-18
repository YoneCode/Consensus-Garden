import { readClient, writeClient, rd, json, isAddr, CONTRACT, SUPPLY } from "./_lib.js";
import elig from "./_eligible.json";

// Gasless sponsor mint. Submits the transaction and returns immediately
// (confirming on-chain can take longer than a serverless request is allowed
// to run); the front-end then polls /api/tokens/:wallet until the tree appears.
export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const wallet = body.wallet || "";
  if (!isAddr(wallet)) return json({ error: "bad wallet" }, 400);

  const pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return json({ error: "minting is not configured yet" }, 503);

  const w = wallet.toLowerCase();
  const b = elig[w];
  const github = b ? b.github : ""; // public minters mint with no GitHub

  const client = readClient();

  // already minted?
  let existing = 0;
  try { existing = Number(await rd(client, "token_of", [w])); } catch (e) {}
  if (existing > 0) return json({ already: true, tokenId: existing });

  // sold out?
  let minted = 0;
  try { minted = Number(await rd(client, "total_minted", [])); } catch (e) {}
  if (minted >= SUPPLY) return json({ soldOut: true, error: "Sold out — all 2,000 trees are planted." });

  // pace: ~1 mint per 18s across ALL requests (KV gate) so we never burst GenLayer's per-wallet rate limit
  try {
    const last = Number((await env.TOKENS.get("mint_gate")) || 0);
    const now = Date.now();
    if (now - last < 18000) return json({ busy: true, wait: Math.ceil((18000 - (now - last)) / 1000) });
    await env.TOKENS.put("mint_gate", String(now));
  } catch (e) {}

  // submit (do not wait for the receipt); retry once to absorb transient testnet reverts
  const wc = writeClient(pk);
  let tx, lastErr;
  for (let i = 0; i < 2; i++) {
    try { tx = await wc.writeContract({ address: CONTRACT, functionName: "mint", args: [wallet, github], value: 0n }); break; }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1500)); }
  }
  if (!tx) return json({ error: "mint_failed", retry: true }, 502);
  return json({ ok: true, pending: true, tx, tier: b ? "builder" : "public" });
}
