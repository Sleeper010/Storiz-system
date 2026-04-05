/**
 * THUMBNAIL GENERATOR v3 — macOS qlmanage approach
 * 
 * 1. Splits each front cover to a temp PDF
 * 2. Uses macOS qlmanage to render a PNG thumbnail
 * 3. Uses sharp to extract the dominant background color
 * 4. Uploads PNG thumbnail to Supabase
 * 5. Updates destination record with thumbnail_url + real colors
 */

import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const PDF_PATH = path.join(__dirname, '..', 'uploads', 'covers_import.pdf');
const TMP_DIR = path.join(__dirname, '..', 'uploads', 'tmp_thumbs');

// Country name normalization
const MAP = {
  'SWITZERLAND': 'Switzerland', 'ARGENTINA': 'Argentina', 'AUSTRIA': 'Austria',
  'CHILE': 'Chile', 'COLOMBIA': 'Colombia', 'COSTA RICA': 'Costa Rica',
  'CROATIA': 'Croatia', 'CZECH': 'Czech Republic', 'DENMARK': 'Denmark',
  'ECUADOR': 'Ecuador', 'FINLAND': 'Finland', 'IRELAND': 'Ireland',
  'LAPLAND': 'Lapland', 'MALTA': 'Malta', 'MONGOLIA': 'Mongolia',
  'NORWAY': 'Norway', 'PERU': 'Peru', 'PHILIPPINE': 'Philippines',
  'POLAND': 'Poland', 'ROMANIA': 'Romania', 'SCOTLAND': 'Scotland',
  'SWEDEN': 'Sweden', 'TANZANIA': 'Tanzania', 'VIETNAM': 'Vietnam',
};

function normalizeCountryName(textStrings) {
  const upper = textStrings.filter(s => !/^20\d\d$/.test(s)).join(' ').toUpperCase();
  for (const [key, clean] of Object.entries(MAP)) {
    if (upper.includes(key)) return clean;
  }
  return null;
}

async function extractDominantColor(pngPath) {
  try {
    const { data, info } = await sharp(pngPath)
      .resize(10, 10, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Sample corners (top-left, top-right, bottom-left, bottom-right)
    const w = info.width;
    const h = info.height;
    const ch = info.channels;
    
    const corners = [
      [0, 0], [w-1, 0], [0, h-1], [w-1, h-1]
    ];
    
    let r = 0, g = 0, b = 0;
    for (const [x, y] of corners) {
      const idx = (y * w + x) * ch;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
    }
    r = Math.round(r / 4);
    g = Math.round(g / 4);
    b = Math.round(b / 4);
    
    const hex = `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const fontColor = brightness > 128 ? '#000000' : '#FFFFFF';
    
    return { bgColor: hex, fontColor };
  } catch {
    return { bgColor: '#000033', fontColor: '#FFFFFF' };
  }
}

async function run() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   🖼️  Thumbnail Generator v3 — macOS qlmanage             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Setup
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  // Load PDF
  console.log('📄 Loading PDF...');
  const pdfBytes = fs.readFileSync(PDF_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();
  const pairCount = Math.floor(pageCount / 2);
  console.log(`   ${pageCount} pages, ${pairCount} pairs\n`);

  // Text extraction for name matching
  console.log('🔗 Building page→name mapping...');
  const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
  const pairs = [];
  for (let i = 0; i < pairCount; i++) {
    const page = await pdfjsDoc.getPage(i * 2 + 1);
    const text = await page.getTextContent();
    const strings = text.items.map(item => item.str.trim()).filter(s => s.length > 0);
    pairs.push({ pairIndex: i, country: normalizeCountryName(strings) || 'Unknown' });
  }
  await pdfjsDoc.destroy();

  // Sort and assign variants
  pairs.sort((a, b) => a.country.localeCompare(b.country));
  const counter = {};
  pairs.forEach(p => {
    counter[p.country] = (counter[p.country] || 0) + 1;
    p.variant = counter[p.country];
    p.displayName = `${p.country} ${p.variant}`;
  });
  console.log('   Done ✓\n');

  // Get destinations from DB
  const { data: destinations } = await supabase.from('destinations').select('*').order('name');
  console.log(`   ${destinations.length} destinations in DB\n`);

  // Process each destination
  console.log('🖼️  Generating thumbnails...\n');
  let success = 0, fail = 0;

  for (const dest of destinations) {
    const pair = pairs.find(p => p.displayName === dest.name);
    if (!pair) {
      fail++;
      console.log(`   ⚠️ [${success + fail}/${destinations.length}] No match: "${dest.name}"`);
      continue;
    }

    try {
      const frontIdx = pair.pairIndex * 2;
      const slug = dest.name.toLowerCase().replace(/\s+/g, '_');
      const tmpPdfPath = path.join(TMP_DIR, `${slug}.pdf`);
      const tmpPngPath = path.join(TMP_DIR, `${slug}.pdf.png`);

      // 1. Extract front cover to temp PDF
      const singlePdf = await PDFDocument.create();
      const [copiedPage] = await singlePdf.copyPages(pdfDoc, [frontIdx]);
      singlePdf.addPage(copiedPage);
      fs.writeFileSync(tmpPdfPath, await singlePdf.save());

      // 2. Render thumbnail with qlmanage
      execSync(`qlmanage -t -s 400 -o "${TMP_DIR}" "${tmpPdfPath}" 2>/dev/null`, { timeout: 15000 });

      if (!fs.existsSync(tmpPngPath)) {
        throw new Error('qlmanage did not produce a PNG');
      }

      // 3. Extract colors from thumbnail
      const { bgColor, fontColor } = await extractDominantColor(tmpPngPath);

      // 4. Upload thumbnail to Supabase
      const pngBuffer = fs.readFileSync(tmpPngPath);
      const thumbPath = `thumbnails/${slug}.png`;
      
      const { error: upErr } = await supabase.storage
        .from('design-assets')
        .upload(thumbPath, pngBuffer, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('design-assets').getPublicUrl(thumbPath);

      // 5. Update DB
      const { error: updateErr } = await supabase
        .from('destinations')
        .update({ thumbnail_url: publicUrl, background_color: bgColor, bg_color: bgColor, font_color: fontColor })
        .eq('id', dest.id);
      if (updateErr) throw updateErr;

      // Cleanup temp files
      try { fs.unlinkSync(tmpPdfPath); } catch {}
      try { fs.unlinkSync(tmpPngPath); } catch {}

      success++;
      console.log(`   ✅ [${success + fail}/${destinations.length}] ${dest.name} (${bgColor})`);
    } catch (err) {
      fail++;
      console.log(`   ❌ [${success + fail}/${destinations.length}] ${dest.name}: ${err.message}`);
    }
  }

  // Cleanup tmp dir
  try { fs.rmSync(TMP_DIR, { recursive: true }); } catch {}

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   ✅ Done! ${success} thumbnails, ${fail} failed                     ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
}

run().catch(err => { console.error('💥', err); process.exit(1); });
