// Deploy WorldState, sync live ETH/BTC prices on-chain, read them back.
//   cd deploy && node deploy_world.mjs
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../.env") });
const pk = process.env.DEPLOYER_PRIVATE_KEY.trim();
const code = new Uint8Array(readFileSync(path.resolve(__dirname, "../contracts/world_state.py")));
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });
const rd = (a,fn) => client.readContract({ address:a, functionName:fn, args:[] });

try {
  await client.initializeConsensusSmartContract();
  console.log(`→ deploying world_state.py (${code.length} bytes)`);
  const dtx = await client.deployContract({ code, args: [] });
  const dr = await client.waitForTransactionReceipt({ hash: dtx, status: TransactionStatus.ACCEPTED, retries: 240, interval: 5000 });
  const address = dr?.txDataDecoded?.contractAddress || dr?.recipient || dr?.data?.contract_address;
  console.log("✅ deployed:", address, "| exec:", dr?.txExecutionResultName ?? dr?.statusName);
  writeFileSync(path.resolve(__dirname, "deployed_world.json"), JSON.stringify({ address, network:"testnetBradbury" }, null, 2));

  console.log("→ sync_prices(): fetch live ETH/BTC + consensus (retries)…");
  let eth = 0;
  for (let i = 0; i < 4 && eth === 0; i++) {
    if (i) await new Promise(r => setTimeout(r, 9000));
    try {
      const stx = await client.writeContract({ address, functionName:"sync_prices", args:[], value:0n });
      const sr = await client.waitForTransactionReceipt({ hash: stx, status: TransactionStatus.ACCEPTED, retries: 360, interval: 5000 });
      eth = Number(await rd(address,"get_eth"));
      console.log(`  attempt ${i+1}: ${sr?.txExecutionResultName ?? sr?.statusName} · ETH=$${eth}`);
    } catch (e) { console.log(`  attempt ${i+1} err: ${e?.message||e}`); }
  }
  console.log("  ETH = $" + (await rd(address,"get_eth")).toString());
  console.log("  BTC = $" + (await rd(address,"get_btc")).toString());
  console.log("  chain_now =", (await rd(address,"get_chain_now")).toString(), "(on-chain consensus time)");
} catch (e) { console.error("✗ failed:", e?.message || e); process.exit(1); }
