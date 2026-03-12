/**
 * Seed Students from Excel
 * Reads Biometric _app.xlsx → Student sheet
 * Groups rows by email → builds { name, email, rollNumber, subjectCodes: [...] }
 * Upserts into Student collection (partial records, no password)
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");

const Student = require("../models/Student");

const EXCEL_PATH = path.resolve(__dirname, "../Biometric _app.xlsx");

async function seedStudents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Read Excel
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets["Student"];
    const rows = XLSX.utils.sheet_to_json(ws);

    console.log(`📄 Read ${rows.length} rows from Student sheet`);

    // Group by email
    const studentMap = {};
    for (const row of rows) {
      const email = (row["Email"] || "").trim().toLowerCase();
      const name = (row["Name "] || row["Name"] || "").trim();
      const rollNumber = (row["Roll No"] || "").trim().toUpperCase();
      const subjectCode = (row["Subject Code"] || "").trim().toUpperCase();

      if (!email || !subjectCode) continue;

      if (!studentMap[email]) {
        studentMap[email] = { name, email, rollNumber, subjectCodes: [] };
      }
      if (!studentMap[email].subjectCodes.includes(subjectCode)) {
        studentMap[email].subjectCodes.push(subjectCode);
      }
    }

    const students = Object.values(studentMap);
    console.log(`🎓 Found ${students.length} unique student(s)`);

    // Upsert each student
    let count = 0;
    for (const s of students) {
      await Student.findOneAndUpdate(
        { email: s.email },
        {
          $set: { name: s.name, email: s.email, rollNumber: s.rollNumber },
          $addToSet: { subjectCodes: { $each: s.subjectCodes } },
        },
        { upsert: true, new: true },
      );
      count++;
    }

    console.log(`\n✅ Student seeding complete! ${count} records upserted.`);
  } catch (error) {
    console.error("❌ Error seeding students:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedStudents();
