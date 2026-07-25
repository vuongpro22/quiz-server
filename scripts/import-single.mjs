import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { ExamBundle } from "../src/models/ExamBundle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, "..");
const INPUT_FILE = path.join(SERVER_DIR, "question", "MLN111 - SP26 - FE.txt");
const EXAM_KEY = "MLN111 - SP26 - FE";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Set MONGODB_URI in quiz-web/quiz-server/.env");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  // Read the input file
  const content = await fs.readFile(INPUT_FILE, "utf8");
  
  // Split into questions and answers sections
  const parts = content.split(/Đáp án tham khảo/i);
  if (parts.length < 2) {
    console.error("Could not find 'Đáp án tham khảo' section in the file.");
    process.exit(1);
  }

  const questionsSection = parts[0];
  const answersSection = parts[1];

  // Parse questions
  const questionBlocksRaw = questionsSection
    .split(/^\s*(?=\d+\.\s+\(Choose\b)/m)
    .map(b => b.trim())
    .filter(Boolean);

  let questionsText = "";
  for (const block of questionBlocksRaw) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];
    const headerMatch = firstLine.match(/^(\d+)\.\s+\(Choose\s+(\d+)\s+answers?\)/i);
    if (!headerMatch) {
      console.warn("Could not match header in line:", firstLine);
      continue;
    }
    const qNum = parseInt(headerMatch[1], 10);
    const chooseCount = parseInt(headerMatch[2], 10);

    const questionLines = [];
    const options = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^[A-F]\.\s/i.test(line)) {
        options.push(line);
      } else {
        questionLines.push(line);
      }
    }

    const questionText = questionLines.join("\n").trim();
    const chooseWord = chooseCount === 1 ? "answer" : "answers";

    questionsText += `===== Q${qNum}.webp =====\n`;
    questionsText += `Question: ${qNum} ${questionText}\n`;
    questionsText += `(Choose ${chooseCount} ${chooseWord})\n`;
    options.forEach(opt => {
      questionsText += `${opt}\n`;
    });
    questionsText += `\n`;
  }

  // Parse answers
  const answerLines = answersSection.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let answersText = "";

  for (const line of answerLines) {
    const match = line.match(/^(\d+)\.\s*([A-F](?:\s*,\s*[A-F])*)/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const ans = match[2].toUpperCase().trim();
      answersText += `Q${qNum}: ${ans}\n`;
    }
  }

  // Upsert into MongoDB
  await ExamBundle.findOneAndUpdate(
    { examKey: EXAM_KEY },
    {
      examKey: EXAM_KEY,
      questionsText: questionsText.trim(),
      answersText: answersText.trim(),
      answersExtension: "txt",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Successfully imported exam bundle: ${EXAM_KEY}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("Error running import script:", e);
  process.exit(1);
});
