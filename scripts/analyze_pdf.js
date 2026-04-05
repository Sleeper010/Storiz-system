import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyze() {
  const filePath = path.join(__dirname, '..', 'uploads', 'covers_import.pdf');
  console.log(`📄 Loading PDF: ${filePath}`);
  console.log(`   File size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB`);
  
  const bytes = fs.readFileSync(filePath);
  console.log('   Parsing PDF structure...');
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  
  const pageCount = pdfDoc.getPageCount();
  console.log(`\n📊 Total pages: ${pageCount}`);
  console.log(`   Estimated destinations: ${Math.floor(pageCount / 2)} (front + back pairs)\n`);
  
  // Get page dimensions for first few pages
  for (let i = 0; i < Math.min(10, pageCount); i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    console.log(`   Page ${i + 1}: ${width.toFixed(0)} x ${height.toFixed(0)} pts`);
  }
}

analyze().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
