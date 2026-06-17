import { readClient, rd, CONTRACT, SUPPLY } from "./_lib.js";

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/stats", request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  let minted = 0;
  try { minted = Number(await rd(readClient(), "total_minted", [])); } catch (e) {}

  const body = {
    supply: SUPPLY,
    minted,
    soldOut: minted >= SUPPLY,
    phaseOpen: true,
    contract: CONTRACT,
  };
  const res = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=30" },
  });
  await cache.put(key, res.clone());
  return res;
}
