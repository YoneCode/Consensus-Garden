// Starts GitHub OAuth. Frontend hits /api/github-login?wallet=0x... after the
// user connects their wallet. We redirect to GitHub with the wallet in `state`
// so the callback can sign a mint attestation bound to that wallet.
// Env: GITHUB_CLIENT_ID
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const wallet = (url.searchParams.get("wallet") || "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) return new Response("bad wallet", { status: 400 });
  const origin = url.origin;
  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  auth.searchParams.set("redirect_uri", origin + "/api/github-callback");
  auth.searchParams.set("scope", "read:user");
  auth.searchParams.set("state", wallet);
  auth.searchParams.set("allow_signup", "false");
  return Response.redirect(auth.toString(), 302);
}
