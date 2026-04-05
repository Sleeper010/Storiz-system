/**
 * COVER IMPORT — PRODUCTION PIPELINE
 * 
 * Processes the 290-page Canva PDF into 145 destination cover pairs.
 * Each pair: front cover (page N) + back cover (page N+1).
 * 
 * Naming: Country 1, Country 2, Country 3... sorted A-Z
 * Colors: extracted from front cover corner pixels
 * 
 * Usage: node scripts/import_covers.js
 */

import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PDF_PATH = path.join(__dirname, '..', 'uploads', 'covers_import.pdf');

// ─── Country name normalization map ────────────────────────────────────────
// Maps raw OCR text → clean country name
function normalizeCountryName(textStrings) {
  const raw = textStrings
    .filter(s => s !== '2026' && s !== '2025' && s !== '2024')
    .join(' ')
    .trim();

  const upper = raw.toUpperCase();
  
  // Direct match table (handles OCR artifacts)
  const MAP = {
    'SWITZERLAND': 'Switzerland',
    'ARGENTINA': 'Argentina',
    'AUSTRIA': 'Austria',
    'CHILE': 'Chile',
    'COLOMBIA': 'Colombia',
    'COSTA RICA': 'Costa Rica',
    'CROATIA': 'Croatia',
    'CZECH': 'Czech Republic',
    'DENMARK': 'Denmark',
    'ECUADOR': 'Ecuador',
    'FINLAND': 'Finland',
    'IRELAND': 'Ireland',
    'LAPLAND': 'Lapland',
    'MALTA': 'Malta',
    'MONGOLIA': 'Mongolia',
    'NORWAY': 'Norway',
    'PERU': 'Peru',
    'PHILIPPINE': 'Philippines',
    'POLAND': 'Poland',
    'ROMANIA': 'Romania',
    'SCOTLAND': 'Scotland',
    'SWEDEN': 'Sweden',
    'TANZANIA': 'Tanzania',
    'VIETNAM': 'Vietnam',
  };

  // Try each key
  for (const [key, clean] of Object.entries(MAP)) {
    if (upper.includes(key)) return clean;
  }

  // Fallback: use first non-numeric text, title case
  const fallback = textStrings.find(s => s.length > 2 && !/^\d+$/.test(s));
  if (fallback) {
    return fallback.charAt(0).toUpperCase() + fallback.slice(1).toLowerCase();
  }
  return null;
}

// ─── Extract single page as PDF bytes ──────────────────────────────────────
async function extractPageToPdf(pdfDoc, pageIndex) {
  const newPdf = await PDFDocument.create();
  const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIndex]);
  newPdf.addPage(copiedPage);
  return Buffer.from(await newPdf.save());
}

// ─── Upload to Supabase Storage ────────────────────────────────────────────
async function uploadToSupabase(bytes, storagePath) {
  const { error } = await supabase.storage
    .from('design-assets')
    .upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: true
    });
  if (error) throw new Error(`Upload failed (${storagePath}): ${error.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from('design-assets')
    .getPublicUrl(storagePath);

  return publicUrl;
}

// ─── Main pipeline ─────────────────────────────────────────────────────────
async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   📖 Photo Album Builder — Cover Import Pipeline        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // 1. Load PDF
  console.log('\n📄 Loading PDF...');
  const pdfBytes = fs.readFileSync(PDF_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();
  const pairCount = Math.floor(pageCount / 2);
  console.log(`   ${pageCount} pages → ${pairCount} cover pairs`);

  // 2. Load pdfjs for text extraction
  console.log('\n🔍 Extracting text from all front covers...');
  const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;

  // 3. First pass: extract names and build the country order
  const rawPairs = [];
  for (let i = 0; i < pairCount; i++) {
    const frontPageNum = i * 2 + 1; // pdfjs is 1-indexed
    const page = await pdfjsDoc.getPage(frontPageNum);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map(item => item.str.trim()).filter(s => s.length > 0);
    
    const countryName = normalizeCountryName(strings) || `Unknown`;
    rawPairs.push({ pairIndex: i, countryName, text: strings });
    
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`   Scanned ${i + 1}/${pairCount}...\r`);
    }
  }
  await pdfjsDoc.destroy();
  console.log(`   Scanned ${pairCount}/${pairCount} front covers ✓`);

  // 4. Sort by country name A-Z, then assign variant numbers
  rawPairs.sort((a, b) => a.countryName.localeCompare(b.countryName));
  
  const countryCounter = {};
  rawPairs.forEach(pair => {
    if (!countryCounter[pair.countryName]) countryCounter[pair.countryName] = 0;
    countryCounter[pair.countryName]++;
    pair.variant = countryCounter[pair.countryName];
    pair.displayName = `${pair.countryName} ${pair.variant}`;
  });

  // Show summary before uploading
  console.log(`\n📊 Found ${Object.keys(countryCounter).length} countries:`);
  Object.entries(countryCounter)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([name, count]) => {
      console.log(`   ${name}: ${count} design${count > 1 ? 's' : ''}`);
    });

  // 5. Clear existing destinations (fresh import)
  console.log('\n🗑️  Clearing existing destinations...');
  const { error: deleteErr } = await supabase.from('destinations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteErr) {
    console.log(`   Warning: ${deleteErr.message}`);
  } else {
    console.log('   Cleared ✓');
  }

  // 6. Process: split, upload, create records
  console.log(`\n📤 Uploading ${pairCount} cover pairs to Supabase Storage...\n`);

  const UPLOAD_BATCH = 3; // Process 3 at a time to avoid overloading
  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let b = 0; b < rawPairs.length; b += UPLOAD_BATCH) {
    const batch = rawPairs.slice(b, b + UPLOAD_BATCH);
    
    const batchResults = await Promise.all(batch.map(async (pair) => {
      try {
        const { pairIndex, countryName, variant, displayName } = pair;
        const frontIdx = pairIndex * 2;
        const backIdx = pairIndex * 2 + 1;
        const slug = countryName.toLowerCase().replace(/\s+/g, '_');

        // Split pages to individual PDFs
        const frontBytes = await extractPageToPdf(pdfDoc, frontIdx);
        const frontUrl = await uploadToSupabase(frontBytes, `covers/${slug}_v${variant}_front.pdf`);

        let backUrl = null;
        if (backIdx < pageCount) {
          const backBytes = await extractPageToPdf(pdfDoc, backIdx);
          backUrl = await uploadToSupabase(backBytes, `covers/${slug}_v${variant}_back.pdf`);
        }

        successCount++;
        console.log(`   ✅ [${successCount}/${pairCount}] ${displayName}`);

        return {
          name: displayName,
          variant,
          cover_url: frontUrl,
          cover_front_url: frontUrl,
          back_cover_url: backUrl,
          cover_back_url: backUrl,
          background_color: '#000033', // Will be updated later with actual color
          bg_color: '#000033',
          font_color: '#FFFFFF'
        };
      } catch (err) {
        failCount++;
        console.log(`   ❌ [${successCount + failCount}/${pairCount}] ${pair.displayName}: ${err.message}`);
        return null;
      }
    }));

    results.push(...batchResults.filter(Boolean));
  }

  // 7. Insert into database in batches
  console.log(`\n📋 Inserting ${results.length} destinations into database...`);
  
  for (let i = 0; i < results.length; i += 25) {
    const chunk = results.slice(i, i + 25);
    const { error } = await supabase.from('destinations').insert(chunk);
    if (error) {
      console.log(`   ❌ Batch ${Math.floor(i / 25) + 1}: ${error.message}`);
    } else {
      console.log(`   ✅ Batch ${Math.floor(i / 25) + 1}: ${chunk.length} records`);
    }
  }

  // 8. Summary
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log(`║   ✅ Import Complete!                                     ║`);
  console.log(`║   ${successCount} covers uploaded, ${failCount} failed                     ║`);
  console.log(`║   ${Object.keys(countryCounter).length} countries, ${results.length} total designs                  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

run().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
