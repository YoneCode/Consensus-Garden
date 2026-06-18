// Consensus Garden — token list from the Ethereum mainnet contract, for the 3D
// garden and the NFT viewer. Reads totalSupply then per-token data via Multicall3.
// Env: GARDEN_ADDRESS, ETH_RPC (optional).
import { createPublicClient, http, parseAbi } from "viem";
import { mainnet } from "viem/chains";

const ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function seedOf(uint256) view returns (uint256)",
  "function mintTime(uint256) view returns (uint256)",
  "function speciesView(uint256) view returns (uint8)",
  "function githubOf(uint256) view returns (string)",
  "function ownerOf(uint256) view returns (address)",
]);

export async function onRequestGet(context) {
  const { env } = context;
  const G = env.GARDEN_ADDRESS || "0x96C1d7e87854d833e96E1cFfF4E4CF8E1896B828";
  const RPC = env.ETH_RPC || "https://ethereum-rpc.publicnode.com";
  try {
    const pub = createPublicClient({ chain: mainnet, transport: http(RPC) });
    const total = Number(await pub.readContract({ address: G, abi: ABI, functionName: "totalSupply" }));
    const calls = [];
    for (let id = 1; id <= total; id++) {
      const a = BigInt(id);
      calls.push(
        { address: G, abi: ABI, functionName: "seedOf", args: [a] },
        { address: G, abi: ABI, functionName: "mintTime", args: [a] },
        { address: G, abi: ABI, functionName: "speciesView", args: [a] },
        { address: G, abi: ABI, functionName: "githubOf", args: [a] },
        { address: G, abi: ABI, functionName: "ownerOf", args: [a] }
      );
    }
    const res = total > 0 ? await pub.multicall({ contracts: calls, allowFailure: true }) : [];
    const tokens = [];
    for (let i = 0; i < total; i++) {
      const o = i * 5;
      if (!res[o] || res[o].status !== "success") continue;
      tokens.push({
        id: i + 1,
        seed: Number(res[o].result),
        mint_ts: Number(res[o + 1].result),
        species: Number(res[o + 2].result),
        github: res[o + 3].result || "",
        owner: res[o + 4].result || "",
        dna: "",
      });
    }
    return new Response(JSON.stringify({ tokens, count: tokens.length, contract: G }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=30" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ tokens: [], error: e.message || "read failed" }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
}
