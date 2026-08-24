import { Schema, model } from "mongoose";

const passkeySchema = new Schema(
  {
    userId: {
      type: String, // matches User._id (uuidv7 string), not ObjectId
      ref: "User",
      required: true,
      immutable: true,
      // This alone covers "list my passkeys" lookups — no need for a
      // second explicit schema.index({ userId: 1 }) below.
      index: true,
    },
    // WebAuthn credential ID. SimpleWebAuthn exposes this as Base64URL.
    credentialId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    // Public key returned by WebAuthn registration.
    publicKey: {
      type: Buffer,
      required: true,
    },
    // WebAuthn signature counter, for clone detection.
    counter: {
      type: Number,
      required: true,
      default: 0,
    },
    // How the authenticator can talk to the browser.
    transports: {
      type: [String],
      default: [],
      // Deliberately not enum-restricted — WebAuthn has added new
      // transport values over time, and rejecting an unrecognized one
      // would break registration on newer browsers/authenticators.
    },
    // "singleDevice" or "multiDevice"
    deviceType: {
      type: String,
      enum: ["singleDevice", "multiDevice"],
      required: true,
    },
    // Whether the credential is backed up/synced across devices.
    backedUp: {
      type: Boolean,
      required: true,
      default: false,
    },
    // Authenticator Attestation GUID — identifies the authenticator
    // model (1Password, iCloud Keychain, YubiKey 5, etc). Use it to
    // auto-generate a sensible default name/icon instead of forcing
    // the user to type one at registration time.
    aaguid: {
      type: String,
    },
    // User-friendly name: "MacBook", "iPhone", "YubiKey", etc.
    name: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Passkey = model("Passkey", passkeySchema);

export default Passkey;
