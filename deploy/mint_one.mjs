// Mint token #1 to YoneCode on ConsensusNFT, then read back owner + on-chain SVG.
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../.env") });
const pk = process.env.DEPLOYER_PRIVATE_KEY.trim();
const { address } = JSON.parse(readFileSync(path.resolve(__dirname, "deployed_nft.json")));
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });

const YC = "0x26882bea46545505db4e58f8cf21680193f336e6";
console.log("→ contract:", address, "| sponsor:", account.address);
console.log("→ minting token #1 to YoneCode (rank 7, 2490 pts, 4 projects, 6 contribs)…");

try {
  const tx = await client.writeContract({
    address, functionName: "mint",
    args: [YC, "YONECODE", 7, 2490, 4, 6], value: 0n,
  });
  console.log("  tx:", tx);
  const r = await client.waitForTransactionReceipt({ hash: tx, status: TransactionStatus.ACCEPTED, retries: 240, interval: 5000 });
  const exec = r?.txExecutionResultName ?? r?.statusName;
  if (String(exec).includes("ERROR")) { console.log("  ✗ exec error:", exec); process.exit(2); }
  console.log("  ✅ mint:", exec);

  const total = await client.readContract({ address, functionName: "total_minted", args: [] });
  const owner = await client.readContract({ address, functionName: "owner_of", args: [1] });
  const tokenOf = await client.readContract({ address, functionName: "token_of", args: [YC] });
  const svg = await client.readContract({ address, functionName: "token_uri", args: [1] });

  console.log("  total_minted:", total.toString());
  console.log("  owner_of(1):", owner);
  console.log("  token_of(YoneCode):", tokenOf.toString());
  console.log("  token_uri length:", (svg || "").length);

  mkdirSync(path.resolve(__dirname, "../app/public/nft-test"), { recursive: true });
  const out = path.resolve(__dirname, "../app/public/nft-test/yonecode.svg");
  writeFileSync(out, svg);
  console.log("  saved on-chain SVG →", out);
  console.log("  explorer:", `https://explorer-bradbury.genlayer.com/tx/${tx}`);
} catch (e) {
  console.error("✗ mint failed:", e?.message || e);
  process.exit(1);
}
