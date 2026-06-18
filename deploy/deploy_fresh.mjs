import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pk = readFileSync(path.resolve(__dirname, ".fresh_sponsor.key"), "utf8").trim();
const code = new Uint8Array(readFileSync(path.resolve(__dirname, "../contracts/consensus_garden.py")));
const account = createAccount(pk);
const client = createClient({ chain: testnetBradbury, account });

try {
  await client.initializeConsensusSmartContract();
  console.log(`→ deploying from fresh sponsor ${account.address} (${code.length} bytes)`);
  const dtx = await client.deployContract({ code, args: [] });
  console.log("deploy tx:", dtx);
  const dr = await client.waitForTransactionReceipt({ hash: dtx, status: TransactionStatus.ACCEPTED, retries: 120, interval: 5000 });
  const address = dr?.txDataDecoded?.contractAddress || dr?.recipient || dr?.data?.contract_address;
  console.log("✅ DEPLOYED:", address, "| exec:", dr?.txExecutionResultName ?? dr?.statusName);
  if (address) writeFileSync(path.resolve(__dirname, "deployed_garden_fresh.json"), JSON.stringify({ address, txHash: dtx, sponsor: account.address, network: "testnetBradbury" }, null, 2));
} catch (e) {
  console.log("✗ deploy failed:", (e?.message || "").split("\n")[0]);
}
