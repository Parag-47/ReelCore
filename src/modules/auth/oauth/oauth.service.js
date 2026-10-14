import * as oauth from "oauth4webapi";
import { getProvider } from "./oauth.providers.js";
import AuthIdentity from "../authIdentity.model.js";
import User from "../../user/user.model.js";
// import attempt from "../../../utils/attempt.js";
import ApiError from "../../../utils/ApiError.js";
import { OAUTH_SESSION_KEY, OAUTH_FLOW_TTL_MS } from "../auth.constants.js";

async function buildAuthorizationUrl(req, providerName) {
  const provider = getProvider(providerName);
  const as = await provider.getAuthServer();

  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
  const state = oauth.generateRandomState();
  const nonce =
    provider.type === "oidc" ? oauth.generateRandomNonce() : undefined;

  // Bound to this browser's session (Redis-backed, httpOnly cookie) — this is
  // what actually protects against login CSRF, not the state param alone.
  req.session[OAUTH_SESSION_KEY] = {
    provider: providerName,
    codeVerifier,
    state,
    nonce,
    createdAt: Date.now(),
  };

  const url = new URL(as.authorization_endpoint);
  url.searchParams.set("client_id", provider.client.client_id);
  url.searchParams.set("redirect_uri", provider.redirectUri);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scope);
  url.searchParams.set("state", state);

  // GitHub doesn't support PKCE on its classic OAuth Apps flow — only attach
  // challenge params for providers that can use them (Google does).
  if (provider.type === "oidc") {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("nonce", nonce);
  }

  return url.href;
}

async function handleCallback(req, callbackUrl) {
  const pending = req.session[OAUTH_SESSION_KEY];

  if (!pending)
    throw new ApiError(400, "OAuth flow expired or was never started");

  // Single-use: consume immediately regardless of outcome below
  delete req.session[OAUTH_SESSION_KEY];

  if (Date.now() - pending.createdAt > OAUTH_FLOW_TTL_MS) {
    throw new ApiError(400, "OAuth flow expired");
  }

  const provider = getProvider(pending.provider);
  const as = await provider.getAuthServer();
  const client = provider.client;

  const params = oauth.validateAuthResponse(
    as,
    client,
    callbackUrl,
    pending.state
  );

  const tokenResponse = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    provider.clientAuth,
    params,
    provider.redirectUri,
    pending.codeVerifier
  );

  let profile;

  if (provider.type === "oidc") {
    const result = await oauth.processAuthorizationCodeResponse(
      as,
      client,
      tokenResponse,
      {
        expectedNonce: pending.nonce,
        requireIdToken: true,
      }
    );
    const claims = oauth.getValidatedIdTokenClaims(result);
    profile = {
      providerAccountId: claims.sub,
      email: claims.email,
      emailVerified: Boolean(claims.email_verified),
      name: claims.name,
      avatarUrl: claims.picture,
    };
  } else {
    const result = await oauth.processAuthorizationCodeResponse(
      as,
      client,
      tokenResponse
    );
    profile = await fetchGithubProfile(result.access_token);
  }

  return findOrCreateUserFromProfile(pending.provider, profile);
}

async function fetchGithubProfile(accessToken) {
  const userRes = await oauth.protectedResourceRequest(
    accessToken,
    "GET",
    new URL("https://api.github.com/user")
  );
  const user = await userRes.json();

  const emailsRes = await oauth.protectedResourceRequest(
    accessToken,
    "GET",
    new URL("https://api.github.com/user/emails")
  );
  const emails = await emailsRes.json();
  const primary = emails.find((e) => e.primary) ?? emails[0];

  return {
    providerAccountId: String(user.id),
    email: primary?.email,
    emailVerified: Boolean(primary?.verified),
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
  };
}

async function findOrCreateUserFromProfile(providerName, profile) {
  const existingIdentity = await AuthIdentity.findOne({
    provider: providerName,
    providerAccountId: profile.providerAccountId,
  }).populate("user");

  if (existingIdentity) return existingIdentity.user;

  // Only auto-link to an existing password/passkey account when the provider
  // has itself confirmed the email — otherwise an attacker who controls an
  // unverified email at the provider could hijack an existing account.
  let user = profile.emailVerified
    ? await User.findOne({ email: profile.email })
    : null;

  if (!user) {
    user = await User.create({
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      // no password field set — this account is OAuth-only until they set one
    });
  }

  // ToDo: this bypasses the error log chain so use attempt util here of the higher order fun which calls it
  await AuthIdentity.create({
    user: user._id,
    provider: providerName,
    providerAccountId: profile.providerAccountId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    profile: { name: profile.name, avatarUrl: profile.avatarUrl },
  });

  return user;
}

export { buildAuthorizationUrl, handleCallback };
