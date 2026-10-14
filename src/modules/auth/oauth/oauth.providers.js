import * as oauth from "oauth4webapi";
import ApiError from "../../../utils/ApiError.js";
import { OAUTH_CONFIG } from "../../../config/config.js";

// ToDo: Use redis here
// Discovery responses barely ever change — cache them instead of hitting
// the well-known endpoint on every single login attempt.
const discoveryCache = new Map();

async function getGoogleAuthServer() {
  if (discoveryCache.has("google")) return discoveryCache.get("google");
  const issuer = new URL("https://accounts.google.com");
  const as = await oauth
    .discoveryRequest(issuer, { algorithm: "oidc" })
    .then((res) => oauth.processDiscoveryResponse(issuer, res));
  discoveryCache.set("google", as);
  return as;
}

// GitHub has no discovery document and isn't OIDC — build the AS shape by hand.
function getGithubAuthServer() {
  return {
    issuer: "https://github.com",
    authorization_endpoint: "https://github.com/login/oauth/authorize",
    token_endpoint: "https://github.com/login/oauth/access_token",
  };
}

const providers = {
  google: {
    type: "oidc",
    scope: "openid email profile",
    getAuthServer: getGoogleAuthServer,
    client: { client_id: OAUTH_CONFIG.google.clientId },
    clientAuth: oauth.ClientSecretPost(OAUTH_CONFIG.google.clientSecret),
    redirectUri: OAUTH_CONFIG.google.redirectURI,
  },
  github: {
    type: "oauth2",
    scope: "read:user user:email",
    getAuthServer: async () => getGithubAuthServer(),
    client: { client_id: OAUTH_CONFIG.github.clientId },
    clientAuth: oauth.ClientSecretPost(OAUTH_CONFIG.github.clientSecret),
    redirectUri: OAUTH_CONFIG.github.redirectURI,
  },
};

function getProvider(name) {
  const provider = providers[name];
  if (!provider) throw new ApiError(400, `Unsupported OAuth provider: ${name}`);
  return provider;
}

export { providers, getProvider };
