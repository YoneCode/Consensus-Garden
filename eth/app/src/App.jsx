import React, { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createPublicClient, createWalletClient, custom, http, parseAbi } from "viem";
import { sepolia, mainnet } from "viem/chains";
const CHAIN = import.meta.env.VITE_CHAIN === "mainnet" ? mainnet : sepolia;

const GARDEN = import.meta.env.VITE_GARDEN;
const BACKEND = import.meta.env.VITE_BACKEND;          // e.g. http://localhost:8788
const RPC = import.meta.env.VITE_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
const VIEWER = "https://consensus-garden.pages.dev/nft/?id=";

const ABI = parseAbi([
  "function mint(string github, bytes signature) returns (uint256)",
  "function tokenOf(address) view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function CAP() view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
]);

const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) });

const C = {
  bg: "#070b0f", panel: "#0d141b", line: "#ffffff14", ink: "#eaf6ff",
  mut: "#8a98a8", grn: "#2f9e54", grn2: "#7ed957",
};

export default function App() {
  const { ready, authenticated, user, login, logout, getAccessToken, linkGithub, linkWallet } = usePrivy();
  const { wallets } = useWallets();
  const [supply, setSupply] = useState("—");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState(null);
  const [tokenId, setTokenId] = useState(null);
  const [owned, setOwned] = useState(0);

  const github = user?.github?.username || user?.github?.subject || null;
  const wallet = wallets?.[0] || null;

  useEffect(() => {
    (async () => {
      try {
        const [tm, cap] = await Promise.all([
          pub.readContract({ address: GARDEN, abi: ABI, functionName: "totalMinted" }),
          pub.readContract({ address: GARDEN, abi: ABI, functionName: "CAP" }),
        ]);
        setSupply(`${tm} / ${cap}`);
      } catch {}
    })();
  }, []);

  async function showToken(id) {
    try {
      const uri = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenURI", args: [id] });
      const json = JSON.parse(atob(uri.split(",")[1]));
      setArt(json.image);
      setTokenId(id.toString());
    } catch {}
  }

  useEffect(() => {
    (async () => {
      if (wallet?.address) {
        const id = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenOf", args: [wallet.address] });
        if (id > 0n) { setOwned(Number(id)); showToken(id); }
      }
    })();
  }, [wallet?.address]);

  async function doMint() {
    if (!wallet) { setMsg({ t: "Connect a wallet first.", ok: false }); return; }
    if (!github) { setMsg({ t: "Link your GitHub to mint.", ok: false }); return; }
    setBusy(true); setMsg({ t: "Verifying your GitHub…" });
    try {
      await wallet.switchChain(CHAIN.id);
      const token = await getAccessToken();
      const r = await fetch(BACKEND, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: wallet.address, privyToken: token }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "verification failed");

      setMsg({ t: `Verified ${data.github} (${data.ageDays}d old). Confirm the mint in your wallet…` });
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({ account: wallet.address, chain: CHAIN, transport: custom(provider) });
      const hash = await walletClient.writeContract({ address: GARDEN, abi: ABI, functionName: "mint", args: [data.github, data.signature] });
      setMsg({ t: `Planting… waiting for confirmation.` });
      await pub.waitForTransactionReceipt({ hash });
      const id = await pub.readContract({ address: GARDEN, abi: ABI, functionName: "tokenOf", args: [wallet.address] });
      setOwned(Number(id));
      setMsg({ t: `🌳 Planted tree #${id} — it's live on Ethereum now. GenLayer validators are reading your GitHub and reaching AI consensus on your species; it writes to your NFT automatically in a few minutes. Until then your tree shows a provisional species.`, ok: true });
      showToken(id);
    } catch (e) {
      setMsg({ t: "Mint failed: " + (e.shortMessage || e.message), ok: false });
    } finally { setBusy(false); }
  }

  const box = { background: "rgba(13,20,27,.74)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: `1px solid ${C.line}`, borderRadius: 18, padding: 22, boxShadow: "0 24px 70px rgba(0,0,0,.55)" };
  const btn = { width: "100%", border: 0, borderRadius: 11, padding: "13px 16px", fontSize: 15, fontWeight: 650, cursor: "pointer", background: `linear-gradient(160deg,${C.grn2},${C.grn})`, color: "#06140c", marginTop: 12 };
  const miniBtn = { border: 0, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: `linear-gradient(160deg,${C.grn2},${C.grn})`, color: "#06140c" };

  return (
    <div style={{ minHeight: "100vh", color: C.ink, fontFamily: "Inter,system-ui,sans-serif", position: "relative", overflow: "hidden" }}>
      <iframe src="/garden3d/?cinematic=1" title="Consensus Garden" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, background: "radial-gradient(900px 600px at 50% 36%, rgba(7,11,15,.42), rgba(7,11,15,.93))" }} />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 480, margin: "0 auto", padding: "44px 20px 72px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 14, letterSpacing: ".2px" }}>
          <span style={{ width: 24, height: 24, borderRadius: 7, background: `linear-gradient(160deg,${C.grn2},${C.grn})` }} /> Consensus Garden
        </div>
        <h1 style={{ fontSize: 34, margin: "18px 0 8px", letterSpacing: "-.5px", fontWeight: 700, lineHeight: 1.12 }}>Plant your <em style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: "italic", fontWeight: 600, color: C.grn2 }}>tree</em> on Ethereum</h1>
        <p style={{ color: C.mut, margin: "0 0 22px", fontSize: 14.5, lineHeight: 1.6 }}>
          A living, fully on-chain NFT. Your species is forged from your GitHub by GenLayer AI consensus. One per wallet, free (you pay only gas). Minting needs a connected GitHub at least 1 month old to keep bots out.
        </p>

        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", color: C.mut, fontSize: 13, marginBottom: 14 }}>
            <span>{supply} planted</span>
            <span>{authenticated && wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : "not connected"}</span>
          </div>

          {!ready && <div style={{ color: C.mut }}>loading…</div>}

          {ready && !authenticated && (
            <button style={btn} onClick={login}>Connect wallet + GitHub</button>
          )}

          {ready && authenticated && owned > 0 && (
            <>
              <div style={{ textAlign: "center", padding: "6px 0 2px" }}>
                <b style={{ color: C.grn2, fontSize: 16 }}>🌳 This wallet already planted tree #{owned}</b>
                <p style={{ color: C.mut, fontSize: 13, margin: "8px 0 0" }}>One tree per wallet — yours is below.</p>
              </div>
              <button style={{ ...btn, background: "transparent", border: `1px solid ${C.line}`, color: C.mut, fontWeight: 500 }} onClick={logout}>Disconnect</button>
            </>
          )}

          {ready && authenticated && owned === 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ color: C.mut, fontSize: 14 }}>1 · GitHub</span>
                {github
                  ? <b style={{ color: C.grn2 }}>{github} ✓</b>
                  : <button style={miniBtn} onClick={linkGithub}>Connect GitHub</button>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
                <span style={{ color: C.mut, fontSize: 14 }}>2 · Wallet</span>
                {wallet
                  ? <b style={{ color: C.grn2 }}>{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)} ✓</b>
                  : <button style={miniBtn} onClick={linkWallet}>Connect wallet</button>}
              </div>
              <button style={btn} disabled={busy || !github || !wallet} onClick={doMint}>
                {busy ? "Working…" : (!github && !wallet) ? "Connect GitHub + wallet" : !github ? "Connect your GitHub" : !wallet ? "Connect your wallet" : "Plant my tree"}
              </button>
              <button style={{ ...btn, background: "transparent", border: `1px solid ${C.line}`, color: C.mut, fontWeight: 500 }} onClick={logout}>Disconnect</button>
            </>
          )}

          {msg && (
            <div style={{ marginTop: 14, fontSize: 13, padding: "11px 13px", borderRadius: 10, background: "#0a120e", border: `1px solid ${C.line}`, color: msg.ok ? C.grn2 : msg.ok === false ? "#ff8080" : C.mut }}>
              {msg.t}
            </div>
          )}

          {art && (
            <div style={{ marginTop: 18, textAlign: "center" }}>
              <img src={art} alt="your tree" style={{ width: 260, borderRadius: 12, border: `1px solid ${C.line}`, background: "#000" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <a style={{ flex: 1, textAlign: "center", textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, color: C.ink, fontSize: 13 }} href={VIEWER + tokenId} target="_blank" rel="noopener">3D viewer</a>
                <a style={{ flex: 1, textAlign: "center", textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, color: C.ink, fontSize: 13 }} href={`${CHAIN.id===1?"https://opensea.io/assets/ethereum":"https://testnets.opensea.io/assets/sepolia"}/${GARDEN}/${tokenId}`} target="_blank" rel="noopener">OpenSea</a>
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.mut, lineHeight: 1.6 }}>
            <b style={{ color: C.ink }}>How it works:</b> your mint lands on <b style={{ color: C.ink }}>Ethereum</b> instantly. Then <b style={{ color: C.ink }}>GenLayer</b> validators read your GitHub and reach <b style={{ color: C.ink }}>AI consensus</b> on your tree's species, then write it back to your NFT — usually within a few minutes. Your tree is live the whole time; the species sharpens from provisional to GitHub-forged once consensus finalizes.
          </div>
        </div>
      </div>
    </div>
  );
}
