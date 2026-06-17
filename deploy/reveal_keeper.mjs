// Reveal keeper — reveals any minted tokens that don't yet have DNA (species).
// Run on a timer (e.g., cron every few min) or: node deploy/reveal_keeper.mjs --loop
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../.env") });
const pk = process.env.DEPLOYER_PRIVATE_KEY.trim();
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });
const { address } = JSON.parse(readFileSync(path.resolve(__dirname, "deployed_garden.json")));
const rd = (fn, args = []) => client.readContract({ address, functionName: fn, args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pass() {
  let revealed = 0;
  for (let id = 1; id <= 2100; id++) {
    const o = await rd("owner_of", [id]); await sleep(250);
    if (!o || o === "") break;
    const dna = await rd("dna_of", [id]); await sleep(250);
    if (dna && dna !== "") continue;
    const gh = await rd("github_of", [id]); await sleep(250);
    console.log(`→ reveal #${id} (github=${gh || "—"})…`);
    try {
      const tx = await client.writeContract({ address, functionName: "reveal", args: [id], value: 0n });
      const r = await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.ACCEPTED, retries: 360, interval: 5000 });
      console.log(`  #${id} ${r?.txExecutionResultName ?? r?.statusName} · species ${(await rd("species_of",[id])).toString()}`);
      revealed++;
    } catch (e) { console.log(`  #${id} reveal failed: ${e?.message || e}`); }
  }
  return revealed;
}

if (process.argv.includes("--loop")) {
  (async () => { for (;;) { try { const n = await pass(); console.log(`pass done (${n} revealed)`); } catch (e) { console.error(e.message); } await sleep(120000); } })();
} else {
  pass().then((n) => console.log(`✅ revealed ${n} token(s)`)).catch((e) => { console.error(e); process.exit(1); });
}
