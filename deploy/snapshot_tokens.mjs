// Read all minted tokens from ConsensusGarden -> app/public/garden_tokens.json
//   cd deploy && node snapshot_tokens.mjs
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as dotenvConfig } from "dotenv";
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, "../.env") });
const pk = process.env.DEPLOYER_PRIVATE_KEY.trim();
const { address } = JSON.parse(readFileSync(path.resolve(__dirname, "deployed_garden.json")));
const account = createAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const client = createClient({ chain: testnetBradbury, account });
const rd = (fn, args=[]) => client.readContract({ address, functionName: fn, args });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const tokens = [];
try {
  for (let id = 1; id <= 2100; id++) {
    const owner = await rd("owner_of", [id]); await sleep(350);
    if (!owner || owner === "") break;
    const seed = await rd("seed_of",[id]); await sleep(350);
    const mint = await rd("mint_ts",[id]); await sleep(350);
    const species = await rd("species_of",[id]); await sleep(350);
    const github = await rd("github_of",[id]); await sleep(350);
    const dna = await rd("dna_of",[id]); await sleep(350);
    const t = { id, owner, seed: Number(seed), mint_ts: Number(mint), species: Number(species), github, dna };
    tokens.push(t);
    console.log(`#${id}`, t.github, "sp", t.species, "seed", t.seed, "born", t.mint_ts);
  }
  const out = { contract: address, network: "testnetBradbury", count: tokens.length, tokens };
  writeFileSync(path.resolve(__dirname, "../garden-web/garden_tokens.json"), JSON.stringify(out, null, 2));
  console.log(`✅ wrote ${tokens.length} tokens → app/public/garden_tokens.json`);
} catch (e) { console.error("✗ snapshot failed:", e?.message || e); process.exit(1); }
