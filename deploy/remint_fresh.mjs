import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pk = readFileSync(path.resolve(__dirname, ".fresh_sponsor.key"), "utf8").trim();
const NEW = JSON.parse(readFileSync(path.resolve(__dirname, "deployed_garden_fresh.json"))).address;
const toks = JSON.parse(readFileSync(path.resolve(__dirname, "old_tokens.json")));
const account = createAccount(pk);
const client = createClient({ chain: testnetBradbury, account });
const rd = (fn, a = []) => client.readContract({ address: NEW, functionName: fn, args: a });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("gentle re-mint on", NEW);
for (const t of toks) {
  let cur = Number(await rd("token_of", [t.owner]));
  if (cur === 0) {
    try {
      await client.writeContract({ address: NEW, functionName: "mint", args: [t.owner, t.github || ""], value: 0n });
    } catch (e) { console.log(`  #${t.id} submit err: ${(e?.message||"").split("\n")[0].slice(0,40)}`); }
    // wait (poll) for it to land, up to ~120s, NO resubmits
    for (let j = 0; j < 8 && !cur; j++) { await sleep(12000); cur = Number(await rd("token_of", [t.owner])); }
  }
  console.log(`#${t.id} ${t.owner.slice(0,8)} gh=${t.github||"-"} -> token ${cur}${cur===t.id?" ✓":(cur?" ⚠":" (pending)")}`);
  await sleep(15000); // pace between tokens to stay under the rate limit
}
console.log("total_minted (new):", Number(await rd("total_minted")));
