/**
 * Extract all unique text combos from front covers (odd page indices: 0, 2, 4, ...)
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function scanAll() {
  const filePath = path.join(__dirname, '..', 'uploads', 'covers_import.pdf');
  const pdfBytes = fs.readFileSync(filePath);
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  
  console.log(`Scanning ${doc.numPages} pages (front covers on odd pages)...\n`);
  
  const allNames = [];
  
  for (let i = 1; i <= doc.numPages; i += 2) { // Front covers only
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => item.str.trim()).filter(s => s.length > 0);
    
    // Build a name from the text
    // Pattern seems to be: COUNTRY, CITY, YEAR
    const filtered = strings.filter(s => s !== '2026' && s !== '2025' && s !== '2024');
    const name = filtered.join(' - ');
    
    allNames.push({
      pageIdx: i,
      rawText: strings,
      name: name || `Unnamed Page ${i}`
    });
    
    if (i % 20 === 1) {
      process.stdout.write(`  Scanned ${Math.floor(i/2) + 1}/${Math.floor(doc.numPages/2)} front covers...\r`);
    }
  }
  
  console.log(`\n\n📋 All ${allNames.length} front covers:\n`);
  
  // Group by name and count
  const nameCount = {};
  allNames.forEach(({ name }) => {
    if (!nameCount[name]) nameCount[name] = 0;
    nameCount[name]++;
  });
  
  // Print sorted
  allNames.sort((a, b) => a.name.localeCompare(b.name));
  allNames.forEach(({ pageIdx, rawText, name }, i) => {
    console.log(`  ${String(i+1).padStart(3)}. Page ${String(pageIdx).padStart(3)}: ${rawText.join(' | ')}`);
  });

  // Country summary
  console.log(`\n\n📊 Unique design names: ${Object.keys(nameCount).length}`);
  console.log('   Names with multiple designs:');
  Object.entries(nameCount)
    .filter(([, count]) => count > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, count]) => {
      console.log(`     ${name}: ${count}x`);
    });

  await doc.destroy();
}

scanAll().catch(console.error);
