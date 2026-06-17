import { json, isAddr } from "../_lib.js";
import elig from "../_eligible.json";

export async function onRequestGet({ params }) {
  const w = (params.wallet || "").toLowerCase();
  if (!isAddr(w)) return json({ error: "bad wallet" }, 400);
  const b = elig[w];
  if (b) return json({ wallet: w, eligible: true, tier: "builder", github: b.github, name: b.name });
  // open mint — everyone is eligible
  return json({ wallet: w, eligible: true, tier: "public", github: "", name: "" });
}
