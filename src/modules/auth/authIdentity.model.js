import { Schema, model } from "mongoose";

const authIdentitySchema = new Schema(
  {
    user: {
      type: Schema.Types.UUID,
      ref: "User",
      required: true,
      immutable: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ["google", "github"],
      required: true,
      immutable: true,
    },
    providerAccountId: {
      type: String,
      required: true,
      immutable: true,
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

authIdentitySchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true }
);

// Prevents linking a second Google account to the same user. Drop this
// index if you want to support linking multiple accounts per provider.
authIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });

const AuthIdentity = model("AuthIdentity", authIdentitySchema);

export default AuthIdentity;
