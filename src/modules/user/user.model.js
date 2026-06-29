import { Schema, module } from "mongoose";

const userSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
      require: true,
    },
    // Moving this to profile for now.
    // firstName: {
    //   type: String,
    //   trim: true,
    //   default: "Unknown",
    // },
    // lastName: {
    //   type: String,
    //   trim: true,
    // },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      // required() {
      //   return (
      //     !this.oauth ||
      //     !Object.values(this.oauth).some((provider) => provider.email)
      //   );
      // },
      // unique() {
      //   return !!this.email;
      // },
    },
    userName: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      required: true,
    },
    // phone: {
    //   type: String,
    //   trim: true,
    // },
    password: {
      type: String,
      private: true,
      required() {
        return this.isNew && this.provider === "EMAIL" && !this.invitationToken;
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "banned", "blocked"],
      default: "inactive",
    },
    invitationToken: {
      type: String,
      select: false,
    },
    lastLogin: {
      type: Date,
    },
    // profile: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Profile",
    // },
    providers: {
      type: [String],
      enum: ["GOOGLE", "EMAIL"],
      default: ["EMAIL"],
    },
    oauth: {
      google: {
        googleId: {
          type: String,
        },
        email: {
          type: String,
          trim: true,
          lowercase: true,
        },
      },
    },
    // metadata: {
    //   createdBy: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
    //   updatedBy: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
    // },
  },
  {
    timestamps: true,
  }
);

userSchema.index({
  email: 1,
  firstName: 1,
  lastName: 1,
  userName: 1,
  status: 1,
});

const User = model("User", userSchema);

export default User;
