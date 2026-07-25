import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 128,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    role: {
      type: String,
      default: "Học viên",
      maxlength: 64,
    },
    loginHistory: [
      {
        ip: String,
        device: String,
        location: String,
        loginTime: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
