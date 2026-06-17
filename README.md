<div align="center">

<img src="garden-web/logo.svg" width="76" alt="Consensus Garden" />

# Consensus Garden

**2,000 living, fully on-chain NFTs — trees forged from a builder's real GitHub by decentralized AI consensus, grown over real time, and explorable in a walkable 3D world.**

A generative NFT dApp that is only possible on **GenLayer**.

[![Network](https://img.shields.io/badge/GenLayer-Testnet%20Bradbury-2f9e54?style=flat-square)](https://genlayer.com)
[![Chain ID](https://img.shields.io/badge/chain%20id-4221-2f9e54?style=flat-square)](https://genlayer.com)
[![Supply](https://img.shields.io/badge/supply-2%2C000-7ed957?style=flat-square)](#-on-chain)
[![Mint](https://img.shields.io/badge/mint-free%20%C2%B7%20gasless-7ed957?style=flat-square)](#-how-it-works)
[![Art](https://img.shields.io/badge/art-100%25%20on--chain-2f9e54?style=flat-square)](#-why-only-on-genlayer)
[![Identity](https://img.shields.io/badge/identity-AI%20consensus-2f9e54?style=flat-square)](#-why-only-on-genlayer)
[![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-555?style=flat-square)](#-license)

</div>

---

## 📊 On-chain

Every tree's species, its artwork, its growth, the live market prices and the world clock are all decided by **GenLayer validator consensus** — no oracle, no off-chain server, no IPFS.

| | |
|---|---|
| **ConsensusGarden** (NFT) | [`0xeA46E03C1c0aE3a1D3c93b98EF2d99915BD393A6`](https://explorer-bradbury.genlayer.com/address/0xeA46E03C1c0aE3a1D3c93b98EF2d99915BD393A6) |
| **Deploy transaction** | [`0x687f67a2…7e97a1dd`](https://explorer-bradbury.genlayer.com/tx/0x687f67a22431adc579951f18fefe12abccb536960b0ab1b4fc8b86ec7e97a1dd) |
| **WorldState** (prices + clock) | [`0xc96f863bb9C9e7C644F4a1b156A83c56740310D6`](https://explorer-bradbury.genlayer.com/address/0xc96f863bb9C9e7C644F4a1b156A83c56740310D6) |
| **Network** | GenLayer Testnet Bradbury · chain `4221` |
| **Supply** | 2,000 · one per wallet |
| **Mint** | Free · gasless (sponsor-paid) |

> Live mint count, owners and per-tree DNA are read directly from the contract through the dApp's `/api/stats` and `/api/tokens` endpoints.

---

## 🌳 What it is

Consensus Garden turns your work as a builder into a **living artifact**.

When you mint, GenLayer validators independently read your **public GitHub**, reach **AI consensus** on your "builder DNA", and that agreement sets your tree's **species**. The tree is then rendered **entirely inside the contract** as generative vector art, and it **grows over real time** — from seedling to a mature, blossoming tree — driven by GenLayer's on-chain clock. You can walk through the whole collection in a first-person 3D Japanese temple garden.

No AI image generation. No "AI slop". The artwork is a deterministic algorithm; AI is used **only to judge identity**, never to draw.

---

## ⚡ Why only on GenLayer

GenLayer's Intelligent Contracts can **fetch the live web** and **run AI**, then have validators reach **consensus** on the result — trustlessly. Consensus Garden uses every one of those superpowers on-chain:

- **AI consensus on identity** — validators read your GitHub and agree on your species. Fair: it reads identity, never a "score".
- **Consensus web access** — live ETH/BTC prices fetched and agreed on-chain, shown on the garden's billboards. No oracle.
- **Deterministic consensus clock** — a wall-clock time every validator agrees on, which both ages your tree and drives the garden's day/night cycle.
- **Fully on-chain generative art** — the SVG is computed in the contract; the NFT needs no external storage.

A normal EVM chain cannot do any of these on-chain.

---

## ✨ Features

- **Living, growing NFTs** — real-time growth from the on-chain clock; trees keep aging after you log off.
- **GitHub → species via AI consensus** — your identity, judged fairly by validators at mint.
- **100% on-chain art** — generative SVG rendered in the contract.
- **Walkable 3D garden** — temple, pagoda, koi pond, taiko bridge, real-time day/night, wildlife, and a 3D tree for every minted token.
- **Multiplayer** — see other builders live, global chat, presence count.
- **Real-world billboards** — consensus prices and a consensus UTC clock, in-world.
- **Free & gasless mint** — sponsor-paid, one per wallet, capped at 2,000.

---

## 🔭 How it works

1. **Paste your wallet** — open to everyone: builders, the GenLayer community and the public, until all 2,000 are planted.
2. **AI consensus reveals you** — validators read your GitHub and agree on your builder DNA → your tree's species.
3. **It grows forever** — your tree is planted on-chain and appears in the 3D garden, aging in real time.

---

## 🧱 Tech stack

| Layer | Tech |
|---|---|
| Smart contracts | GenLayer Intelligent Contracts (Python / GenVM) |
| On-chain AI + web | `gl.nondet.exec_prompt`, `gl.nondet.web.get`, validator consensus |
| 3D world & art | three.js (WebGL), procedural L-system trees, generative SVG |
| Multiplayer | Supabase Realtime (presence + chat) |
| Backend | Node.js — gasless sponsor-mint API + live on-chain reads |

---

## 📁 Repository

```
contracts/        GenLayer Intelligent Contracts
  consensus_garden.py   living-tree NFT: mint, AI reveal, on-chain SVG, growth
  world_state.py        consensus prices + deterministic on-chain clock
garden-web/       the dApp (static front-end)
  index.html            landing page (live cinematic garden hero + mint)
  garden3d/             walkable 3D multiplayer garden
  nft/                  per-token 3D NFT viewer
  mint/                 gasless mint page
deploy/           Node backend + scripts
  server.mjs            serves garden-web + gasless mint / live token APIs
  deploy_garden.mjs     deploy + mint + reveal the NFT contract
  deploy_world.mjs      deploy WorldState (prices + clock)
  reveal_keeper.mjs     auto-reveals new trees (GitHub → AI consensus)
  snapshot_*.mjs        cache on-chain tokens / world state for the front-end
```

The API: `GET /api/stats`, `GET /api/eligibility/:wallet`, `GET /api/tokens`, `GET /api/tokens/:wallet`, `POST /api/mint`. Minting submits the sponsor transaction and the page polls until the tree is planted; the species reveal (GitHub → AI consensus) is triggered automatically.

**Local development**

```bash
cd deploy && npm install
cp ../.env.example ../.env   # add your sponsor DEPLOYER_PRIVATE_KEY
node server.mjs              # serves the dApp + API on port 3000
```

---

## 🔒 License

© 2026 **YoneCode**. All rights reserved. This project and its artwork may not be copied, redistributed or reused without permission.

<div align="center">

[GitHub](https://github.com/YoneCode/Consensus-Garden) · [X](https://x.com/YoneCode) · [GenLayer](https://genlayer.com)

</div>
