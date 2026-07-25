import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    examKey: {
      type: String,
      required: true,
      trim: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ["quiz", "flashcard", "study", "similar"],
    },
    highestScore: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    completedCount: {
      type: Number,
      default: 0,
    },
    wrongQuestions: {
      type: [Number],
      default: [],
    },
    lastAttempt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness of progress per user, exam, and mode
progressSchema.index({ userId: 1, examKey: 1, mode: 1 }, { unique: true });

export const Progress = mongoose.model("Progress", progressSchema);
