<div align="center">

<img src="garden-web/logo.svg" width="76" alt="Consensus Garden" />

# Consensus Garden

**Living, fully on-chain tree NFTs on Ethereum. Your species is forged from your real GitHub by GenLayer AI consensus, your tree grows over real time, and the art is rendered inside the contract.**

[![Ethereum](https://img.shields.io/badge/Ethereum-mainnet-2f9e54?style=flat-square)](https://etherscan.io/address/0x96C1d7e87854d833e96E1cFfF4E4CF8E1896B828)
[![Mint](https://img.shields.io/badge/mint-free-7ed957?style=flat-square)](https://consensus-garden.pages.dev/eth)
[![Supply](https://img.shields.io/badge/supply-1%2C000-7ed957?style=flat-square)](#mint)
[![Art](https://img.shields.io/badge/art-100%25%20on--chain-2f9e54?style=flat-square)](#why-the-hybrid)
[![Species](https://img.shields.io/badge/species-GenLayer%20AI-2f9e54?style=flat-square)](#why-the-hybrid)
[![Anti-bot](https://img.shields.io/badge/anti--bot-GitHub%20gated-2f9e54?style=flat-square)](#anti-bot)

[**Mint on Ethereum →**](https://consensus-garden.pages.dev/eth)

</div>

---

## What it is

Connect your wallet, connect your GitHub, and plant a tree. **GenLayer** reads your public GitHub, reaches **AI consensus** on your dominant language, and that decides your tree's **species**. The tree is **rendered entirely on-chain** as generative SVG and **grows over real time** from seedling to a mature, blossoming tree. Every tree also lives in a walkable 3D garden.

- **Free mint on Ethereum** — one tree per wallet, you pay only gas (cents at current fees).
- **Species from your GitHub** — judged by GenLayer AI consensus, not a server. Fair: it reads identity, never a score.
- **100% on-chain art** — the SVG is computed inside the contract. No IPFS, no off-chain image.
- **Grows forever** — the tree keeps aging from `block.timestamp` after you log off.

## Mint

1. **Connect** your wallet and your GitHub (one click each, in any order).
2. **Plant** — the mint is free (you pay gas).
3. **GenLayer forges your species** from your GitHub and writes it to your NFT.

> Mint: https://consensus-garden.pages.dev/eth

## Why the hybrid

The NFT lives on **Ethereum** (stable, liquid, tradeable on every marketplace). The **brain** lives on **GenLayer** — the one chain whose contracts can fetch the live web and run AI with validator consensus, on-chain. Neither chain can do the other's job:

- **Ethereum** holds the token, the on-chain art, the real-time growth, and ownership.
- **GenLayer** reads your GitHub and reaches **trustless AI consensus** on your species.
- A relayer carries GenLayer's agreed result onto the Ethereum NFT.

A normal EVM contract cannot read GitHub or run AI on-chain. That decision is what GenLayer makes trustless — and what makes this collection only possible with both chains.

## Anti-bot

Minting requires a **connected GitHub account that is at least 1 month old**. A backend reads the OAuth-verified handle, checks the account age, and signs an EIP-712 attestation; the contract verifies that signature on mint. No real, aged GitHub → no signature → no mint. Combined with one-per-wallet, that keeps the garden human.

## On-chain

| | |
|---|---|
| **ConsensusGarden** (Ethereum) | [`0x96C1d7e87854d833e96E1cFfF4E4CF8E1896B828`](https://etherscan.io/address/0x96C1d7e87854d833e96E1cFfF4E4CF8E1896B828) |
| **SpeciesOracle** (GenLayer) | `0x6EdA972ebbf81adc4F76df8e7D17A935Bee5bEad` |
| **Supply** | 1,000 · one per wallet |
| **Mint** | Free (pay gas) |
| **Art** | 100% on-chain SVG + walkable 3D viewer |

## Tech stack

| Layer | Tech |
|---|---|
| NFT | Solidity ERC-721, on-chain generative SVG, real-time growth |
| Species brain | GenLayer Intelligent Contract — `gl.nondet.web.get` + `gl.nondet.exec_prompt` + validator consensus |
| Anti-bot | Privy (wallet + GitHub OAuth), EIP-712 signed mint, GitHub age gate |
| Relayer | Node keeper: watches `Planted` on Ethereum → resolves species on GenLayer → `reveal()` on Ethereum |
| Front-end | React + viem; 3D garden in three.js |

## Repository

```
eth/
  src/ConsensusGarden.sol    ERC-721: free mint, on-chain SVG, growth, signed-mint gate, relayer reveal
  src/TreeRenderer.sol       the on-chain renderer (byte-identical port, 960-case verified)
  app/                       Privy mint front-end (wallet + GitHub)
  backend/sign.mjs           local attestor (GitHub age check + EIP-712 sign)
  relayer/relayer.mjs        GenLayer -> Ethereum species relayer
  test/                      forge tests + 1:1 renderer verification
contracts/
  species_oracle.py          GenLayer: GitHub -> AI-consensus species
functions/api/sign-mint.js   the attestor as a Cloudflare Pages Function
garden-web/                  landing + walkable 3D garden (eth/ = the mint app)
```

## License

© 2026 **YoneCode**. All rights reserved.

<div align="center">

[GitHub](https://github.com/YoneCode/Consensus-Garden) · [X](https://x.com/YoneCode) · [GenLayer](https://genlayer.com)

</div>
