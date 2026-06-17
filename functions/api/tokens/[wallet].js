import { readClient, rd, readToken, json, isAddr, submitReveal, withLabel } from "../_lib.js";

// Live per-wallet read. Used by the mint flow to poll until the tree appears.
// Side effects (best-effort): cache the token into KV so the public garden picks
// it up, and trigger the AI species reveal once (only for builders with a GitHub).
export async function onRequestGet(context) {
  const { params, env, request } = context;
  const w = (params.wallet || "").toLowerCase();
  if (!isAddr(w)) return json({ tokens: [] });

  const client = readClient();
  let id = 0;
  try { id = Number(await rd(client, "token_of", [w])); } catch (e) {}
  if (!id) return json({ tokens: [] });

  let tok = null;
  try { tok = await readToken(client, id); } catch (e) {}
  if (!tok) return json({ tokens: [] });

  // upsert into the KV list for the public garden
  if (env.TOKENS) {
    try {
      const raw = await env.TOKENS.get("list");
      const list = raw ? JSON.parse(raw) : [];
      const i = list.findIndex((t) => t.id === tok.id);
      if (i >= 0) list[i] = tok; else list.push(tok);
      await env.TOKENS.put("list", JSON.stringify(list));
    } catch (e) {}
  }

  // trigger species reveal AT MOST ONCE per token (KV flag) — never on every poll
  if (tok.github && (!tok.dna || tok.dna === "") && env.TOKENS) {
    try {
      const done = await env.TOKENS.get("rv:" + tok.id);
      if (!done) { await env.TOKENS.put("rv:" + tok.id, "1"); context.waitUntil(submitReveal(env, tok.id)); }
    } catch (e) {}
  }

  return json({ tokens: [withLabel(tok)] });
}
