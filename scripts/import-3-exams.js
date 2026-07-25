import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import "dotenv/config";
import { ExamBundle } from "../src/models/ExamBundle.js";

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
      const match = cleanLine.match(/^(\d+)\s+([A-D\s,]+)$/i);
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
      const optMatch = line.match(/^([A-D])\.\s*(.*)$/i);
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

  const files = [
    {
      filePath: 'd:/tool linh tinh/toolMultipleChoice/quiz-web/quiz-server/question/MLN111 - SP26 - B5 - FE.txt',
      examKey: 'MLN111 - SP26 - B5 - FE'
    },
    {
      filePath: 'd:/tool linh tinh/toolMultipleChoice/quiz-web/quiz-server/question/MLN111 - SP26 - B5 - RE.txt',
      examKey: 'MLN111 - SP26 - B5 - RE'
    },
    {
      filePath: 'd:/tool linh tinh/toolMultipleChoice/quiz-web/quiz-server/question/MLN111 - SP26 - FE - RE.txt',
      examKey: 'MLN111 - SP26 - FE - RE'
    }
  ];

  for (const fileInfo of files) {
    const questions = parseQuestionFile(fileInfo.filePath);
    console.log(`Parsed ${questions.length} questions from ${path.basename(fileInfo.filePath)}`);

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
    console.log(`Upserted exam bundle in DB: ${fileInfo.examKey}`);
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
