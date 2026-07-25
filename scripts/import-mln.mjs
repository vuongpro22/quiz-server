import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { ExamBundle } from "../src/models/ExamBundle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const QUESTION_FILE = path.join(SERVER_DIR, "questionMLN.json");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Set MONGODB_URI in quiz-web/quiz-server/.env");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  // Read questionMLN.json
  const fileContent = await fs.readFile(QUESTION_FILE, "utf8");
  const rawQuestions = JSON.parse(fileContent);
  console.log(`Loaded ${rawQuestions.length} questions from questionMLN.json.`);

  // Chunk questions into sets of 60
  const chunkSize = 60;
  const chunks = [];
  for (let i = 0; i < rawQuestions.length; i += chunkSize) {
    chunks.push(rawQuestions.slice(i, i + chunkSize));
  }
  console.log(`Split into ${chunks.length} exam bundles.`);

  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    const examIndex = chunkIdx + 1;
    const examKey = `MLN - Đề ${String(examIndex).padStart(2, "0")}`;

    let questionsText = "";
    let answersText = "";

    chunk.forEach((q, index) => {
      const qNum = index + 1;

      // Build question text block
      questionsText += `===== Q${qNum}.webp =====\n`;
      
      // Question header and text
      let qTextLine = `Question: ${qNum} ${q.question.trim()}`;
      if (q.notes && q.notes.length > 0) {
        // Append notes to the question text
        const notesStr = q.notes.map(n => n.trim()).join("\n");
        qTextLine += `\n${notesStr}`;
      }
      questionsText += `${qTextLine}\n`;

      // Answer choose hint
      const chooseCount = q.answer ? q.answer.length : 1;
      const chooseWord = chooseCount === 1 ? "answer" : "answers";
      questionsText += `(Choose ${chooseCount} ${chooseWord})\n`;

      // Options
      const optionKeys = Object.keys(q.options).sort();
      optionKeys.forEach(key => {
        questionsText += `${key}. ${q.options[key].trim()}\n`;
      });
      questionsText += `\n`;

      // Build answer text line (TXT format: Q1: A, B, C)
      const answerLetters = q.answer ? q.answer.split("").join(", ") : "";
      answersText += `Q${qNum}: ${answerLetters}\n`;
    });

    // Upsert into ExamBundle
    await ExamBundle.findOneAndUpdate(
      { examKey },
      {
        examKey,
        questionsText: questionsText.trim(),
        answersText: answersText.trim(),
        answersExtension: "txt",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Upserted bundle: ${examKey} (${chunk.length} questions)`);
  }

  console.log("All exam bundles have been successfully imported.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Error running import script:", e);
  process.exit(1);
});
