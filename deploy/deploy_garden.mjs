// Deploy ConsensusGarden, mint token #1 to YoneCode, verify on-chain render + growth.
//   cd deploy && node deploy_garden.mjs
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
const code = new Uint8Array(readFileSync(path.resolve(__dirname, "../contracts/consensus_garden.py")));
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });
const YC = "0x26882bea46545505db4e58f8cf21680193f336e6";
const outDir = path.resolve(__dirname, "../app/public/nft-test");
mkdirSync(outDir, { recursive: true });

try {
  await client.initializeConsensusSmartContract();
  console.log(`→ deploying consensus_garden.py (${code.length} bytes), sponsor ${account.address}`);
  const dtx = await client.deployContract({ code, args: [] });
  const dr = await client.waitForTransactionReceipt({ hash: dtx, status: TransactionStatus.ACCEPTED, retries: 240, interval: 5000 });
  const address = dr?.txDataDecoded?.contractAddress || dr?.recipient || dr?.data?.contract_address;
  console.log("✅ deployed:", address, "| exec:", dr?.txExecutionResultName ?? dr?.statusName);
  writeFileSync(path.resolve(__dirname, "deployed_garden.json"), JSON.stringify({ address, txHash: dtx, network: "testnetBradbury" }, null, 2));

  console.log("→ minting token #1 to YoneCode (github=yonecode)…");
  const mtx = await client.writeContract({ address, functionName: "mint", args: [YC, "yonecode"], value: 0n });
  const mr = await client.waitForTransactionReceipt({ hash: mtx, status: TransactionStatus.ACCEPTED, retries: 240, interval: 5000 });
  const mexec = mr?.txExecutionResultName ?? mr?.statusName;
  if (String(mexec).includes("ERROR")) { console.log("  ✗ mint exec error:", mexec); process.exit(2); }
  console.log("  ✅ mint:", mexec);

  const rd = (fn, args=[]) => client.readContract({ address, functionName: fn, args });
  console.log("  total_minted :", (await rd("total_minted")).toString());
  console.log("  owner_of(1)  :", await rd("owner_of",[1]));
  console.log("  token_of(YC) :", (await rd("token_of",[YC])).toString());
  console.log("  mint_ts(1)   :", (await rd("mint_ts",[1])).toString());
  console.log("  age_seconds  :", (await rd("age_seconds",[1])).toString());
  const seed = (await rd("seed_of",[1])).toString();
  console.log("  seed_of(1)   :", seed);

  console.log("→ reveal(1): GitHub fetch + AI consensus (may take a while)…");
  try {
    const rtx = await client.writeContract({ address, functionName: "reveal", args: [1], value: 0n });
    const rr = await client.waitForTransactionReceipt({ hash: rtx, status: TransactionStatus.ACCEPTED, retries: 360, interval: 5000 });
    console.log("  reveal exec  :", rr?.txExecutionResultName ?? rr?.statusName);
    console.log("  species_of(1):", (await rd("species_of",[1])).toString());
    console.log("  dna_of(1)    :", await rd("dna_of",[1]));
  } catch (e) { console.log("  reveal note:", e?.message || e); }

  // demo: a REAL github handle to prove AI species classification (torvalds -> C -> EMBER=3)
  const D2 = "0x000000000000000000000000000000000000dEaD";
  console.log("→ demo: mint #2 (github 'torvalds') + reveal to prove real classification…");
  try {
    const m2 = await client.writeContract({ address, functionName: "mint", args: [D2, "torvalds"], value: 0n });
    await client.waitForTransactionReceipt({ hash: m2, status: TransactionStatus.ACCEPTED, retries: 240, interval: 5000 });
    const r2 = await client.writeContract({ address, functionName: "reveal", args: [2], value: 0n });
    const rr2 = await client.waitForTransactionReceipt({ hash: r2, status: TransactionStatus.ACCEPTED, retries: 360, interval: 5000 });
    console.log("  #2 reveal exec:", rr2?.txExecutionResultName ?? rr2?.statusName);
    console.log("  #2 species_of :", (await rd("species_of",[2])).toString());
    console.log("  #2 dna_of     :", await rd("dna_of",[2]));
  } catch (e) { console.log("  demo note:", e?.message || e); }

  const live = await rd("token_uri",[1]);
  writeFileSync(path.join(outDir, "yonecode-live.svg"), live);
  console.log("  token_uri(1) live length:", (live||"").length, "→ saved yonecode-live.svg");

  // growth proof: render the SAME seed at increasing ages via debug_svg
  for (const [tag,t] of [["1h",3600],["1w",604800],["1mo",2592000],["6mo",15552000]]) {
    const svg = await rd("debug_svg",[Number(seed), t]);
    writeFileSync(path.join(outDir, `yonecode-${tag}.svg`), svg);
    console.log(`  debug_svg @ ${tag.padEnd(3)} : length ${(svg||"").length}`);
  }
  console.log("  explorer:", `https://explorer-bradbury.genlayer.com/tx/${mtx}`);
} catch (e) {
  console.error("✗ failed:", e?.message || e);
  process.exit(1);
}
