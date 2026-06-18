// Seed the founding builders on mainnet via ownerMint (owner pays gas, each gets
// their own tree by their address). Reads deploy/old_tokens.json.
// DRY_RUN=1 prints the plan without sending. Run from eth/relayer (has viem).
//
// Env: ETH_RPC, DEPLOYER_PRIVATE_KEY, GARDEN_ADDRESS, DRY_RUN
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

const RPC = process.env.ETH_RPC || "https://ethereum-rpc.publicnode.com";
const GARDEN = process.env.GARDEN_ADDRESS;
let PK = process.env.DEPLOYER_PRIVATE_KEY || "";
if (PK && !PK.startsWith("0x")) PK = "0x" + PK;
const DRY = process.env.DRY_RUN === "1";

const founders = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "../../deploy/old_tokens.json"), "utf8"));
const BURN = new Set(["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"]);

const ABI = parseAbi([
  "function ownerMint(address to, string github) returns (uint256)",
  "function tokenOf(address) view returns (uint256)",
  "function totalMinted() view returns (uint256)",
]);

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: mainnet, transport: http(RPC) });

const main = async () => {
  console.log(`founders seed | garden=${GARDEN} owner=${account.address} DRY_RUN=${DRY}`);
  console.log(`current totalMinted: ${await pub.readContract({ address: GARDEN, abi: ABI, functionName: "totalMinted" })}`);
  for (const f of founders) {
    const to = (f.owner || "").toLowerCase();
    const tag = `#${f.id} ${f.owner} ${f.github || "(no github)"}`;
    if (!/^0x[0-9a-f]{40}$/.test(to)) { console.log(`SKIP ${tag} — invalid address`); continue; }
    if (BURN.has(to)) { console.log(`SKIP ${tag} — burn/zero address`); continue; }
    if (!f.github || !f.github.trim()) { console.log(`SKIP ${tag} — no github handle`); continue; }
    const existing = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenOf", args: [f.owner] });
    if (existing > 0n) { console.log(`SKIP ${tag} — already has tree #${existing}`); continue; }
    if (DRY) { console.log(`WOULD MINT ${tag}`); continue; }
    const hash = await wallet.writeContract({ address: GARDEN, abi: ABI, functionName: "ownerMint", args: [f.owner, f.github || ""] });
    await pub.waitForTransactionReceipt({ hash });
    const id = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenOf", args: [f.owner] });
    console.log(`MINTED ${tag} -> token #${id} tx=${hash}`);
  }
  console.log(`final totalMinted: ${await pub.readContract({ address: GARDEN, abi: ABI, functionName: "totalMinted" })}`);
};
main();
