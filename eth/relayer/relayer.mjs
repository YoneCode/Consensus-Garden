// Consensus Garden — GenLayer -> Ethereum species relayer (keeper).
//
// Watches Planted(id, owner, seed, github) on the ETH ConsensusGarden contract,
// asks the GenLayer SpeciesOracle to forge the species from the builder's GitHub
// via AI consensus, then writes the agreed species onto the ETH NFT via reveal().
//
// ETH = body (the NFT). GenLayer = brain (the species decision). This script is
// the bridge. It is idempotent: it skips tokens already revealed on ETH, and
// caches species per GitHub handle on the oracle.
//
// Env (see .env): ETH_RPC, RELAYER_PRIVATE_KEY, GARDEN_ADDRESS,
//   GENLAYER_ORACLE_ADDRESS  (+ GENLAYER_RPC handled by genlayer-js chain)
//
// Run: node eth/relayer/relayer.mjs   (loops; or `--once` for a single pass)

import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, mainnet } from "viem/chains";

const CHAIN = process.env.ETH_CHAIN === "mainnet" ? mainnet : sepolia;

const ETH_RPC = process.env.ETH_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const GARDEN = process.env.GARDEN_ADDRESS;
const ORACLE = process.env.GENLAYER_ORACLE_ADDRESS;
const PK = (process.env.RELAYER_PRIVATE_KEY || "").startsWith("0x")
  ? process.env.RELAYER_PRIVATE_KEY
  : "0x" + process.env.RELAYER_PRIVATE_KEY;
const STATE = path.join(path.dirname(new URL(import.meta.url).pathname), "relayer.state.json");
const ONCE = process.argv.includes("--once");

if (!GARDEN || !ORACLE) {
  console.error("set GARDEN_ADDRESS and GENLAYER_ORACLE_ADDRESS");
  process.exit(1);
}

const GARDEN_ABI = parseAbi([
  "event Planted(uint256 indexed id, address indexed owner, uint256 seed, string github)",
  "function revealed(uint256) view returns (bool)",
  "function reveal(uint256 id, uint8 species)",
]);
const PLANTED = parseAbiItem(
  "event Planted(uint256 indexed id, address indexed owner, uint256 seed, string github)"
);

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: CHAIN, transport: http(ETH_RPC) });
const wallet = createWalletClient({ account, chain: CHAIN, transport: http(ETH_RPC) });

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { fromBlock: "0" }; }
}
function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s)); }

// --- GenLayer oracle (species from GitHub via AI consensus) ---
let gl = null;
async function genlayer() {
  if (gl) return gl;
  const { createClient, createAccount } = await import("genlayer-js");
  const { testnetBradbury } = await import("genlayer-js/chains");
  const { TransactionStatus } = await import("genlayer-js/types");
  let glpk = process.env.GENLAYER_PRIVATE_KEY || PK;
  if (glpk && !glpk.startsWith("0x")) glpk = "0x" + glpk;
  const acct = createAccount(glpk); // GenLayer account (pays consensus)
  const client = createClient({ chain: testnetBradbury, account: acct });
  await client.initializeConsensusSmartContract().catch(() => {});
  gl = { client, TS: TransactionStatus };
  return gl;
}

async function resolveSpecies(github) {
  const { client, TS } = await genlayer();
  // already cached on the oracle?
  let sp = Number(await client.readContract({ address: ORACLE, functionName: "species_of", args: [github] }));
  if (sp >= 0) return sp;
  // run consensus (write), then re-read
  const tx = await client.writeContract({ address: ORACLE, functionName: "resolve", args: [github], value: 0n });
  console.log(`    oracle.resolve(${github}) tx=${tx}`);
  await client.waitForTransactionReceipt({ hash: tx, status: TS.ACCEPTED, retries: 60, interval: 5000 }).catch(() => {});
  sp = Number(await client.readContract({ address: ORACLE, functionName: "species_of", args: [github] }));
  return sp; // -1 if still unresolved
}

async function pass() {
  const st = loadState();
  const latest = await pub.getBlockNumber();
  const from = BigInt(st.fromBlock || "0");
  const logs = await pub.getLogs({ address: GARDEN, event: PLANTED, fromBlock: from, toBlock: latest });
  console.log(`[relayer] scanning blocks ${from}..${latest} — ${logs.length} Planted event(s)`);

  for (const lg of logs) {
    const id = lg.args.id;
    const github = (lg.args.github || "").trim();
    if (!github) { console.log(`  #${id}: no github, leaving provisional`); continue; }
    const already = await pub.readContract({ address: GARDEN, abi: GARDEN_ABI, functionName: "revealed", args: [id] });
    if (already) { console.log(`  #${id}: already revealed, skip`); continue; }

    let sp;
    try { sp = await resolveSpecies(github); }
    catch (e) { console.log(`  #${id}: oracle error (${e.shortMessage || e.message}); retry next pass`); continue; }
    if (sp < 0) { console.log(`  #${id}: species not resolved yet (GenLayer pending); retry next pass`); continue; }

    try {
      const hash = await wallet.writeContract({ address: GARDEN, abi: GARDEN_ABI, functionName: "reveal", args: [id, sp] });
      await pub.waitForTransactionReceipt({ hash });
      console.log(`  #${id}: revealed species=${sp} (${github}) tx=${hash}`);
    } catch (e) {
      console.log(`  #${id}: reveal tx failed (${e.shortMessage || e.message}); retry next pass`);
    }
  }
  saveState({ fromBlock: (latest + 1n).toString() });
}

async function main() {
  console.log(`[relayer] garden=${GARDEN} oracle=${ORACLE} relayer=${account.address}`);
  if (ONCE) { await pass(); return; }
  for (;;) {
    try { await pass(); } catch (e) { console.error("[relayer] pass error:", e.shortMessage || e.message); }
    await new Promise((r) => setTimeout(r, 30000));
  }
}
main();
