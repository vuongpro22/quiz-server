import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import "dotenv/config";
import { ExamBundle } from "../src/models/ExamBundle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTION_DIR = path.join(__dirname, "..", "question");

function parseQuestionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  
  const questions = [];
  let currentQuestion = null;
  let inAnswersSection = false;
  const answersMap = new Map();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('câu') && (lowerLine.includes('đáp án') || lowerLine.includes('đa') || lowerLine.includes('đáp'))) {
      inAnswersSection = true;
      continue;
    }
    
    if (inAnswersSection) {
      const cleanLine = line.replace(/\|/g, ' ').trim();
      const match = cleanLine.match(/^(\d+)\s+([A-F\s,]+)$/i);
      if (match) {
        const qNum = parseInt(match[1], 10);
        const ans = match[2].replace(/[\s,]+/g, '').toUpperCase();
        answersMap.set(qNum, ans);
      }
      continue;
    }
    
    const qMatch = line.match(/^Question\s+(\d+)\s*:?$/i);
    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        number: parseInt(qMatch[1], 10),
        textLines: [],
        options: []
      };
      continue;
    }
    
    if (currentQuestion) {
      const optMatch = line.match(/^([A-F])\.\s*(.*)$/i);
      if (optMatch) {
        currentQuestion.options.push({
          letter: optMatch[1].toUpperCase(),
          text: optMatch[2].trim()
        });
      } else {
        currentQuestion.textLines.push(line);
      }
    }
  }
  
  if (currentQuestion) {
    questions.push(currentQuestion);
  }
  
  questions.forEach(q => {
    q.text = q.textLines.join(' ').trim();
    q.answer = answersMap.get(q.number) || '';
  });
  
  return questions;
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB.");

  // Recursively find all txt files under QUESTION_DIR, excluding .backup_questions
  const filesToImport = [];
  function scan(dir) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (item === ".backup_questions") continue;
        scan(fullPath);
      } else if (stat.isFile() && item.toLowerCase().endsWith(".txt")) {
        // examKey is the filename without extension
        const examKey = item.slice(0, -4);
        filesToImport.push({ filePath: fullPath, examKey });
      }
    }
  }
  scan(QUESTION_DIR);

  console.log(`Found ${filesToImport.length} files to import.`);

  for (const fileInfo of filesToImport) {
    const questions = parseQuestionFile(fileInfo.filePath);
    console.log(`\nParsed ${questions.length} questions from: ${fileInfo.examKey}`);

    let questionsText = "";
    let answersText = "";

    questions.forEach((q, index) => {
      const qNum = index + 1;
      questionsText += `===== Q${qNum}.webp =====\n`;
      questionsText += `Question: ${qNum} ${q.text}\n`;

      const chooseCount = q.answer ? q.answer.length : 1;
      const chooseWord = chooseCount === 1 ? "answer" : "answers";
      questionsText += `(Choose ${chooseCount} ${chooseWord})\n`;

      q.options.forEach(opt => {
        questionsText += `${opt.letter}. ${opt.text}\n`;
      });
      questionsText += `\n`;

      const answerLetters = q.answer ? q.answer.split("").join(", ") : "";
      answersText += `Q${qNum}: ${answerLetters}\n`;
    });

    await ExamBundle.findOneAndUpdate(
      { examKey: fileInfo.examKey },
      {
        examKey: fileInfo.examKey,
        questionsText: questionsText.trim(),
        answersText: answersText.trim(),
        answersExtension: 'txt'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  Successfully upserted exam bundle in DB: ${fileInfo.examKey}`);
  }

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
