// Read WorldState -> app/public/world_state.json   (cd deploy && node snapshot_world.mjs)
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../.env") });
const pk = process.env.DEPLOYER_PRIVATE_KEY.trim();
const { address } = JSON.parse(readFileSync(path.resolve(__dirname, "deployed_world.json")));
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });
const rd = (fn) => client.readContract({ address, functionName: fn, args: [] });
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

try {
  const eth = Number(await rd("get_eth")); await sleep(350);
  const btc = Number(await rd("get_btc")); await sleep(350);
  const headline = await rd("get_headline"); await sleep(350);
  const updated = Number(await rd("get_updated")); await sleep(350);
  const chain_now = Number(await rd("get_chain_now"));
  const out = { contract: address, eth, btc, headline, updated, chain_now, read_at: Math.floor(Date.now()/1000) };
  writeFileSync(path.resolve(__dirname, "../garden-web/world_state.json"), JSON.stringify(out, null, 2));
  console.log("✅ world_state.json:", JSON.stringify(out));
} catch (e) { console.error("✗", e?.message || e); process.exit(1); }
