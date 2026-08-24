import { Schema, model } from "mongoose";
import { v7 as uuidv7 } from "uuid";
import generateWebAuthnUserId from "../../utils/webauthn.js";

const userSchema = new Schema(
  {
    _id: {
      type: Schema.Types.UUID,
      default: () => uuidv7(),
      immutable: true,
    },
    // publicId: {
    //   type: String,
    //   unique: true,
    //   immutable: true,
    //   index: true,
    //   default: () => uuidv7(),
    // },
    webAuthnUserId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      select: false,
      default: () => generateWebAuthnUserId(),
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // Only present for users who have local/password authentication.
    password: {
      type: String,
      select: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      select: false,
    },
    status: {
      type: String,
      // dropped "deleted" — deletedAt below already handles soft-delete state.
      // having two deletion signals (status="deleted" AND deletedAt) means
      // they can drift out of sync. deletedAt alone is cleaner:
      //   null  = not deleted
      //   Date  = soft-deleted at that timestamp (useful for purge jobs)
      enum: ["active", "suspended"],
      default: "active",
    },
    // --- Brute-force protection ---
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockoutUntil: {
      type: Date,
      default: null,
      select: false,
    },
    lockoutCount: {
      type: Number,
      default: 0,
      select: false,
    },
    lastFailedLoginAt: {
      type: Date,
      default: null,
      select: false,
    },
    // --- Session/token invalidation ---
    passwordChangedAt: {
      type: Date,
      select: false,
    },
    // Just in case the session needs to be invalidated, not in use rn.
    sessionsInvalidatedAt: {
      type: Date,
      select: false,
    },
    // --- Audit fields ---
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
      select: false,
    },
    // --- Soft delete ---
    deletedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.set("toJSON", {
  versionKey: false,

  transform(doc, ret) {
    // Expose MongoDB _id as the public API identifier.
    ret.id = ret._id;

    // Remove internal fields.
    delete ret._id;

    // These are already select:false for queries, but create()/save()
    // return the full document, so remove them here as a second safety net.
    delete ret.password;
    delete ret.emailVerifiedAt;
    delete ret.failedLoginAttempts;
    delete ret.lockoutUntil;
    delete ret.lastFailedLoginAt;
    delete ret.passwordChangedAt;
    delete ret.lastLoginIp;
    delete ret.deletedAt;

    return ret;
  },
});

userSchema.set("toObject", userSchema.get("toJSON"));

userSchema.index({ status: 1 });

const User = model("User", userSchema);

export default User;
