import "dotenv/config";
import mongoose from "mongoose";
import { ExamBundle } from "../src/models/ExamBundle.js";

const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  const doc = await ExamBundle.findOne().lean();
  if (doc) {
    console.log("Exam Key:", doc.examKey);
    console.log("QuestionsText Sample (first 500 chars):\n", doc.questionsText.slice(0, 500));
    console.log("\nAnswersText Sample (first 100 chars):\n", doc.answersText.slice(0, 100));
  } else {
    console.log("No document found in ExamBundle collection.");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
