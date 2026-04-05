/**
 * Quick test: extract text from page 1 and color from page 1 of the covers PDF
 */
import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
  const filePath = path.join(__dirname, '..', 'uploads', 'covers_import.pdf');
  console.log('Loading PDF for quick test...');
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  
  // Test: extract page 1 as standalone PDF
  console.log('\n--- Test: Extract page 1 ---');
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [0]);
  newPdf.addPage(copiedPage);
  const singlePageBytes = await newPdf.save();
  const outPath = path.join(__dirname, '..', 'uploads', 'test_page1.pdf');
  fs.writeFileSync(outPath, singlePageBytes);
  console.log(`Saved test_page1.pdf (${(singlePageBytes.length / 1024).toFixed(0)} KB)`);
  
  // Test: try pdfjs-dist for text extraction
  console.log('\n--- Test: pdfjs-dist text extraction ---');
  try {
    // Try different import paths
    let pdfjsLib;
    try {
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      console.log('Using pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      try {
        pdfjsLib = await import('pdfjs-dist');
        console.log('Using pdfjs-dist (default)');
      } catch (e2) {
        console.log('pdfjs-dist import failed:', e2.message);
        return;
      }
    }
    
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    console.log(`pdfjs loaded: ${doc.numPages} pages`);
    
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => item.str.trim()).filter(s => s.length > 0);
    console.log(`Page 1 text (${strings.length} items):`, strings.slice(0, 20));
    
    // Page 3 (should be a different country)
    const page3 = await doc.getPage(3);
    const text3 = await page3.getTextContent();
    const strings3 = text3.items.map(item => item.str.trim()).filter(s => s.length > 0);
    console.log(`Page 3 text (${strings3.length} items):`, strings3.slice(0, 20));
    
    // Page 5
    const page5 = await doc.getPage(5);
    const text5 = await page5.getTextContent();
    const strings5 = text5.items.map(item => item.str.trim()).filter(s => s.length > 0);
    console.log(`Page 5 text (${strings5.length} items):`, strings5.slice(0, 20));
    
    // Page 7
    const page7 = await doc.getPage(7);
    const text7 = await page7.getTextContent();
    const strings7 = text7.items.map(item => item.str.trim()).filter(s => s.length > 0);
    console.log(`Page 7 text (${strings7.length} items):`, strings7.slice(0, 20));

    // Page 9
    const page9 = await doc.getPage(9);
    const text9 = await page9.getTextContent();
    const strings9 = text9.items.map(item => item.str.trim()).filter(s => s.length > 0);
    console.log(`Page 9 text (${strings9.length} items):`, strings9.slice(0, 20));

    await doc.destroy();
  } catch (err) {
    console.error('pdfjs-dist error:', err.message);
  }
}

test().catch(console.error);
