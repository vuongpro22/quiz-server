import express from "express";
import { Progress } from "../models/Progress.js";
import { authMiddleware } from "../middleware/auth.js";

export const progressRouter = express.Router();

// Save or update exam progress
progressRouter.post("/save", authMiddleware, async (req, res, next) => {
  try {
    const { examKey, mode, score, totalQuestions, wrongQuestions } = req.body ?? {};
    if (!examKey || !mode) {
      res.status(400).json({ error: "examKey and mode are required" });
      return;
    }

    const userId = req.user.id;
    const finalScore = Number(score) || 0;
    const finalTotal = Number(totalQuestions) || 0;
    const finalWrong = Array.isArray(wrongQuestions) ? wrongQuestions : [];

    // Find if progress already exists
    let progress = await Progress.findOne({ userId, examKey, mode });

    if (progress) {
      progress.highestScore = Math.max(progress.highestScore, finalScore);
      progress.totalQuestions = finalTotal;
      progress.completedCount += 1;
      progress.wrongQuestions = finalWrong;
      progress.lastAttempt = new Date();
    } else {
      progress = new Progress({
        userId,
        examKey,
        mode,
        highestScore: finalScore,
        totalQuestions: finalTotal,
        completedCount: 1,
        wrongQuestions: finalWrong,
        lastAttempt: new Date(),
      });
    }

    await progress.save();
    res.json(progress);
  } catch (e) {
    next(e);
  }
});

// Fetch progress summary for the logged-in user
progressRouter.get("/summary", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const summary = await Progress.find({ userId }).lean();
    res.json(summary);
  } catch (e) {
    next(e);
  }
});
