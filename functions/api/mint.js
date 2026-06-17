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

  // submit (do not wait for the receipt)
  try {
    const wc = writeClient(pk);
    const tx = await wc.writeContract({ address: CONTRACT, functionName: "mint", args: [wallet, github], value: 0n });
    return json({ ok: true, pending: true, tx, tier: b ? "builder" : "public" });
  } catch (e) {
    return json({ error: e?.message || "mint failed" }, 500);
  }
}
