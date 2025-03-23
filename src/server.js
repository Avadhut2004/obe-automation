const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// Multer setup for file upload
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        cb(null, "uploaded.xlsx");
    },
});
const upload = multer({ storage });

// Process Excel file
app.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const filePath = path.join(__dirname, "uploads/uploaded.xlsx");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        // Log all sheet names
        const sheetNames = workbook.worksheets.map(sheet => sheet.name);
        console.log("Sheet Names:", sheetNames);

        const sheetName = " PO PSO SPPU ATT "; // Updated to include leading and trailing spaces
        const worksheet = workbook.getWorksheet(sheetName);

        if (!worksheet) {
            return res.status(400).json({ error: `Sheet '${sheetName}' not found. Available sheets: ${sheetNames.join(", ")}` });
        }

        // Identify student data range correctly
        let studentStartRow = null;
        let studentEndRow = null;

        worksheet.eachRow((row, rowNumber) => {
            const firstCellValue = row.getCell(1).value;
            if (typeof firstCellValue === "number" && studentStartRow === null) {
                studentStartRow = rowNumber; // First student row
            }
            if (studentStartRow !== null && (firstCellValue === null || firstCellValue === "")) {
                studentEndRow = rowNumber - 1; // Last student row before an empty row
            }
        });

        if (studentStartRow === null) {
            return res.status(400).json({ error: "No student data found" });
        }
        if (studentEndRow === null) {
            studentEndRow = worksheet.rowCount; // If no empty row is found, process till the last row
        }

        // Apply formula to calculate Theory Score in Column F (D + E) for student rows only
        for (let rowIndex = studentStartRow; rowIndex <= studentEndRow; rowIndex++) {
            const cell = worksheet.getCell(`F${rowIndex}`);
            cell.value = { formula: `D${rowIndex} + E${rowIndex}` };
        }

        // Ensure processed files directory exists
        const outputDir = path.join(__dirname, "processed_files");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        const outputPath = path.join(outputDir, "Processed_File.xlsx");
        await workbook.xlsx.writeFile(outputPath);

        res.json({ message: "File processed successfully", downloadPath: "/processed_files/Processed_File.xlsx" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve processed files
app.use("/processed_files", express.static(path.join(__dirname, "processed_files")));

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
