// GitHub OAuth callback. Exchanges the code for the user's verified GitHub
// login, requires the account to be >= MIN_ACCOUNT_AGE_DAYS old, then EIP-712
// signs Mint(wallet, github) with SIGNER_PRIVATE_KEY and redirects back to /eth
// with the signature. The signature is bound to the wallet (passed in `state`),
// so it is only usable by that wallet's owner.
// Env: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SIGNER_PRIVATE_KEY,
//      GARDEN_ADDRESS, CHAIN_ID, MIN_ACCOUNT_AGE_DAYS
import { privateKeyToAccount } from "viem/accounts";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const back = (params) =>
    Response.redirect(url.origin + "/eth/?" + new URLSearchParams(params).toString(), 302);
  try {
    const code = url.searchParams.get("code");
    const wallet = (url.searchParams.get("state") || "").toLowerCase();
    if (!code) return back({ error: "no code" });
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) return back({ error: "bad wallet" });

    // exchange code -> access token
    const tr = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: url.origin + "/api/github-callback",
      }),
    });
    const tj = await tr.json();
    if (!tj.access_token) return back({ error: "github authorization failed" });

    // verified GitHub identity
    const ur = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + tj.access_token, "User-Agent": "consensus-garden", Accept: "application/vnd.github+json" },
    });
    if (!ur.ok) return back({ error: "github user lookup failed" });
    const u = await ur.json();
    const login = u.login;
    const minAge = Number(env.MIN_ACCOUNT_AGE_DAYS || 30);
    const ageDays = Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000);
    if (ageDays < minAge) return back({ error: "github_too_new", github: login, ageDays: String(ageDays) });

    // EIP-712 sign Mint(wallet, github)
    let pk = env.SIGNER_PRIVATE_KEY || "";
    if (!pk.startsWith("0x")) pk = "0x" + pk;
    const signer = privateKeyToAccount(pk);
    const signature = await signer.signTypedData({
      domain: { name: "Consensus Garden", version: "1", chainId: Number(env.CHAIN_ID || 1), verifyingContract: env.GARDEN_ADDRESS },
      types: { Mint: [{ name: "wallet", type: "address" }, { name: "github", type: "string" }] },
      primaryType: "Mint",
      message: { wallet, github: login },
    });

    return back({ github: login, wallet, sig: signature, ageDays: String(ageDays) });
  } catch (e) {
    return back({ error: (e.message || "verification failed").slice(0, 100) });
  }
}
