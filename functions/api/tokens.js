import { json, CONTRACT } from "./_lib.js";

// Public token list for the 3D garden: static snapshot (seed) merged with the
// KV list that grows as minters poll their freshly-planted trees.
export async function onRequestGet({ env, request }) {
  const byId = new Map();

  // 1) static snapshot committed with the site
  try {
    const r = await fetch(new URL("/garden_tokens.json", request.url).toString());
    if (r.ok) { const d = await r.json(); for (const t of (d.tokens || [])) byId.set(t.id, t); }
  } catch (e) {}

  // 2) live additions from KV (override by id)
  if (env.TOKENS) {
    try {
      const raw = await env.TOKENS.get("list");
      if (raw) for (const t of JSON.parse(raw)) byId.set(t.id, t);
    } catch (e) {}
  }

  const tokens = [...byId.values()].sort((a, b) => a.id - b.id);
  return json({ contract: CONTRACT, count: tokens.length, tokens }, 200, "public, max-age=20");
}
