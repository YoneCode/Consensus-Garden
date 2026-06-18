// Shared helpers for the Consensus Garden Pages Functions (Cloudflare Workers runtime).
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import labels from "./_labels.json";

export const CONTRACT = "0x36d8223a5474041302e54a9fe81940a05B225be8";
export const SUPPLY = 2000;

// curated display label override (does NOT change on-chain data) — e.g. founder tree
export const withLabel = (t) => (t && labels[String(t.id)] ? { ...t, github: labels[String(t.id)] } : t);

export const isAddr = (s) => /^0x[0-9a-fA-F]{40}$/.test(s || "");

export function json(obj, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": cache },
  });
}

// reads need no signing — use a throwaway account
export function readClient() {
  return createClient({ chain: testnetBradbury, account: createAccount() });
}
export function writeClient(pk) {
  const k = pk.startsWith("0x") ? pk : `0x${pk}`;
  return createClient({ chain: testnetBradbury, account: createAccount(k) });
}
export const rd = (client, fn, args = []) =>
  client.readContract({ address: CONTRACT, functionName: fn, args });

// build one token record (6 reads)
export async function readToken(client, id) {
  const owner = await rd(client, "owner_of", [id]);
  if (!owner || owner === "") return null;
  const seed = Number(await rd(client, "seed_of", [id]));
  const mint = Number(await rd(client, "mint_ts", [id]));
  const sp = Number(await rd(client, "species_of", [id]));
  const gh = await rd(client, "github_of", [id]);
  const dna = await rd(client, "dna_of", [id]);
  return { id, owner, seed, mint_ts: mint, species: sp, github: gh, dna };
}

// fire-and-forget species reveal (GitHub → AI consensus); contract guards double-reveal
export async function submitReveal(env, id) {
  if (!env || !env.DEPLOYER_PRIVATE_KEY) return;
  try {
    const wc = writeClient(env.DEPLOYER_PRIVATE_KEY);
    await wc.writeContract({ address: CONTRACT, functionName: "reveal", args: [id], value: 0n });
  } catch (e) { /* already revealed / transient — ignore */ }
}
