/**
 * Seed Teachers from Excel
 * Reads Biometric _app.xlsx → Teacher sheet
 * Groups rows by email → builds { name, email, subjectCodes: [...] }
 * Upserts into Teacher collection (partial records, no password)
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");

const Teacher = require("../models/Teacher");

const EXCEL_PATH = path.resolve(__dirname, "../Biometric _app.xlsx");

async function seedTeachers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Read Excel
    const wb = XLSX.readFile(EXCEL_PATH);
    const ws = wb.Sheets["Teacher"];
    const rows = XLSX.utils.sheet_to_json(ws);

    console.log(`📄 Read ${rows.length} rows from Teacher sheet`);

    // Group by email
    const teacherMap = {};
    for (const row of rows) {
      const email = (row["Email"] || "").trim().toLowerCase();
      const name = (row["Name"] || "").trim();
      const subjectCode = (row["Subject Code"] || "").trim().toUpperCase();

      if (!email || !subjectCode) continue;

      if (!teacherMap[email]) {
        teacherMap[email] = { name, email, subjectCodes: [] };
      }
      if (!teacherMap[email].subjectCodes.includes(subjectCode)) {
        teacherMap[email].subjectCodes.push(subjectCode);
      }
    }

    const teachers = Object.values(teacherMap);
    console.log(`👨‍🏫 Found ${teachers.length} unique teacher(s)`);

    // Upsert each teacher
    for (const t of teachers) {
      const result = await Teacher.findOneAndUpdate(
        { email: t.email },
        {
          $set: { name: t.name, email: t.email },
          $addToSet: { subjectCodes: { $each: t.subjectCodes } },
        },
        { upsert: true, new: true },
      );
      console.log(
        `  ✓ ${result.name} (${result.email}) — ${result.subjectCodes.length} subjects`,
      );
    }

    console.log("\n✅ Teacher seeding complete!");
  } catch (error) {
    console.error("❌ Error seeding teachers:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedTeachers();
