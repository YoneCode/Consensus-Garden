// Post-deploy on-chain proof: mints a tree on the deployed Sepolia contract,
// reads renderSVG(id) from the live contract, and diffs it byte-for-byte
// against the ground-truth Python renderer for the same (seed, agePM, species).
// Proves the art is 1:1 on real Ethereum (not just in the forge harness).
//
// Env: ETH_RPC, DEPLOYER_PRIVATE_KEY (or RELAYER_PRIVATE_KEY), GARDEN_ADDRESS
// Run from eth/relayer:  node ../verify_onchain.mjs
import { execFileSync } from "node:child_process";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const ETH_RPC = process.env.ETH_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const GARDEN = process.env.GARDEN_ADDRESS;
let PK = process.env.DEPLOYER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY || "";
if (PK && !PK.startsWith("0x")) PK = "0x" + PK;
if (!GARDEN || !PK) { console.error("set GARDEN_ADDRESS + DEPLOYER_PRIVATE_KEY"); process.exit(1); }

const ABI = parseAbi([
  "function mint(string github) returns (uint256)",
  "function tokenOf(address) view returns (uint256)",
  "function seedOf(uint256) view returns (uint256)",
  "function agePMOf(uint256) view returns (uint256)",
  "function speciesView(uint256) view returns (uint8)",
  "function renderSVG(uint256) view returns (string)",
]);

const account = privateKeyToAccount(PK);
const pub = createPublicClient({ chain: sepolia, transport: http(ETH_RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(ETH_RPC) });

function pyRender(seed, agePM, sp) {
  // call the ground-truth renderer for a single case
  const code =
    `import sys; sys.path.insert(0,'ref');\n` +
    `from render_ref import _render\n` +
    `import sys\n` +
    `sys.stdout.write(_render(${seed}, ${agePM}, ${sp}))\n`;
  return execFileSync("python3", ["-c", code], { cwd: process.cwd().replace(/\/relayer$/, ""), maxBuffer: 1 << 24 }).toString();
}

const main = async () => {
  let id = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenOf", args: [account.address] });
  if (id === 0n) {
    console.log("minting a test tree...");
    const hash = await wallet.writeContract({ address: GARDEN, abi: ABI, functionName: "mint", args: ["yonecode"] });
    await pub.waitForTransactionReceipt({ hash });
    id = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenOf", args: [account.address] });
  }
  console.log("token id:", id.toString());
  const seed = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "seedOf", args: [id] });
  const agePM = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "agePMOf", args: [id] });
  const sp = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "speciesView", args: [id] });
  const onchain = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "renderSVG", args: [id] });

  const ref = pyRender(Number(seed), Number(agePM), Number(sp));
  const match = onchain === ref;
  console.log(`seed=${seed} agePM=${agePM} sp=${sp}`);
  console.log(`on-chain SVG bytes=${onchain.length}  reference bytes=${ref.length}`);
  console.log(match ? "✅ ON-CHAIN ART IS 1:1 IDENTICAL" : "❌ MISMATCH");
  if (!match) {
    for (let i = 0; i < Math.max(onchain.length, ref.length); i++) {
      if (onchain[i] !== ref[i]) { console.log(`first diff @${i}: on-chain='${onchain.slice(i, i + 40)}' ref='${ref.slice(i, i + 40)}'`); break; }
    }
    process.exit(1);
  }
};
main();
