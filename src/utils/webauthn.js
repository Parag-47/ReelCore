import { randomBytes } from "node:crypto";

function generateWebAuthnUserId() {
  return randomBytes(32).toString("base64url");
}

export default generateWebAuthnUserId;
