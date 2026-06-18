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
  bg: "#0a0f0c", panel: "#0f1713", line: "#1c2a22", ink: "#e8f0ea",
  mut: "#8aa294", grn: "#2f9e54", grn2: "#7ed957",
};

export default function App() {
  const { ready, authenticated, user, login, logout, getAccessToken, linkGithub, linkWallet } = usePrivy();
  const { wallets } = useWallets();
  const [supply, setSupply] = useState("—");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState(null);
  const [tokenId, setTokenId] = useState(null);

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
        if (id > 0n) { setMsg({ t: `You already have tree #${id}.`, ok: true }); showToken(id); }
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
      setMsg({ t: `🌳 Planted tree #${id}! GenLayer is forging your species now.`, ok: true });
      showToken(id);
    } catch (e) {
      setMsg({ t: "Mint failed: " + (e.shortMessage || e.message), ok: false });
    } finally { setBusy(false); }
  }

  const box = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 };
  const btn = { width: "100%", border: 0, borderRadius: 11, padding: "13px 16px", fontSize: 15, fontWeight: 650, cursor: "pointer", background: `linear-gradient(160deg,${C.grn2},${C.grn})`, color: "#06140c", marginTop: 12 };
  const miniBtn = { border: 0, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", background: `linear-gradient(160deg,${C.grn2},${C.grn})`, color: "#06140c" };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 700px at 50% -10%,#10231a 0%,${C.bg} 60%)`, color: C.ink, fontFamily: "ui-sans-serif,system-ui,sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 20px 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(160deg,${C.grn2},${C.grn})` }} /> Consensus Garden
        </div>
        <h1 style={{ fontSize: 30, margin: "26px 0 6px", letterSpacing: "-.5px" }}>Plant your tree on Ethereum</h1>
        <p style={{ color: C.mut, margin: "0 0 24px" }}>
          A living, fully on-chain NFT. Your species is forged from your GitHub by GenLayer AI consensus. One per wallet, free (you pay only gas). To keep bots out, minting requires a connected GitHub at least 1 month old.
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

          {ready && authenticated && (
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
        </div>
      </div>
    </div>
  );
}
