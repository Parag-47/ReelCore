import { Schema, model } from "mongoose";
import { v7 as uuidv7 } from "uuid";

const userSchema = new Schema(
  {
    publicId: {
      type: String,
      unique: true,
      immutable: true,
      index: true,
      default: () => uuidv7(),
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
    password: {
      type: String,
      select: false,
      // required() kept intentionally simple — the controller already knows
      // which provider path it's on and guards this. a function-based required
      // using this.authProviders.includes() is unreliable during User.create()
      // because field ordering affects whether authProviders is set on `this`
      // at validation time.
    },
    authProviders: {
      type: [String],
      enum: ["local", "google"],
      default: ["local"], // was: [local] — unquoted identifier, ReferenceError at import
    },
    oauth: {
      google: {
        id: {
          type: String,
          unique: true,
          sparse: true, // allows multiple null values (accounts with no Google)
          select: false,
        },
      },
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: {
      type: Date,
      select: false,
    },
    // role: {
    //   type: String,
    //   enum: ["user", "admin"],
    //   default: "user",
    // },
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
    // --- Brute-force protection (OWASP: account-based, not IP-based) ---
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
    lastFailedLoginAt: {
      type: Date,
      default: null,
      select: false,
    },
    // --- Session/token invalidation ---
    // Used to invalidate sessions issued before a password change.
    // Not for forced rotation — OWASP discourages that pattern.
    passwordChangedAt: {
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
    // null = active; Date = deleted at that timestamp.
    // purge job candidate: deletedAt < (now - 30d) → hard delete.
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
    // Expose publicId as the API identifier.
    ret.id = ret.publicId;

    // Remove internal fields.
    delete ret._id;
    delete ret.publicId;
    delete ret.oauth;

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
// userSchema.index({ role: 1 });

export default model("User", userSchema);
