// Consensus Garden — mint attestor (Cloudflare Pages Function).
// Verifies the user's Privy-linked GitHub, requires it to be >= 1 month old,
// then EIP-712 signs Mint(wallet, github). The contract's mint() recovers this
// signer and reverts otherwise, so bots without a real, OAuth-verified,
// 1-month-old GitHub cannot mint.
//
// Cloudflare env (Settings -> Environment variables):
//   PRIVY_APP_ID, PRIVY_APP_SECRET (secret), SIGNER_PRIVATE_KEY (secret),
//   GARDEN_ADDRESS, CHAIN_ID (1), MIN_ACCOUNT_AGE_DAYS (30)
import { PrivyClient } from "@privy-io/server-auth";
import { privateKeyToAccount } from "viem/accounts";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { wallet, privyToken } = await request.json();
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet || "")) return json({ error: "bad wallet" }, 400);
    if (!privyToken) return json({ error: "missing privyToken" }, 400);

    // 1) verify the Privy session and read the VERIFIED GitHub login
    const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);
    const claims = await privy.verifyAuthToken(privyToken);
    const user = await privy.getUser(claims.userId);
    const gh = (user.linkedAccounts || []).find((a) => a.type === "github_oauth");
    if (!gh || !gh.username) return json({ error: "no GitHub linked to this account" }, 400);

    // 2) require the GitHub account to be at least MIN_ACCOUNT_AGE_DAYS old
    const r = await fetch("https://api.github.com/users/" + encodeURIComponent(gh.username), {
      headers: { "User-Agent": "consensus-garden", Accept: "application/vnd.github+json" },
    });
    if (r.status === 404) return json({ error: "GitHub user not found" }, 400);
    if (!r.ok) return json({ error: "GitHub API error " + r.status }, 502);
    const p = await r.json();
    const minAge = Number(env.MIN_ACCOUNT_AGE_DAYS || 30);
    const ageDays = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86400000);
    if (ageDays < minAge) return json({ error: `GitHub account too new (${ageDays}d < ${minAge}d)` }, 403);

    // 3) EIP-712 sign Mint(wallet, github)
    let pk = env.SIGNER_PRIVATE_KEY || "";
    if (!pk.startsWith("0x")) pk = "0x" + pk;
    const signer = privateKeyToAccount(pk);
    const signature = await signer.signTypedData({
      domain: { name: "Consensus Garden", version: "1", chainId: Number(env.CHAIN_ID || 1), verifyingContract: env.GARDEN_ADDRESS },
      types: { Mint: [{ name: "wallet", type: "address" }, { name: "github", type: "string" }] },
      primaryType: "Mint",
      message: { wallet, github: p.login },
    });

    return json({ wallet, github: p.login, ageDays, signature });
  } catch (e) {
    return json({ error: e.message || "verification failed" }, 400);
  }
}
