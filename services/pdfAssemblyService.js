import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { supabase } from './supabaseService.js';
import { getPlacements } from './placementService.js';
import { getAlbumTexts } from './textService.js';

// Constants for A4 at 300 DPI (approx 72 DPI points for pdf-lib)
// A4 = 595.28 x 841.89 points
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const BLEED = 9; // ~3mm bleed

/**
 * Generate a complete Photo Album PDF package
 */
export async function generateAlbum(config, photos) {
  console.log(`[PdfAssembly] Generating album for ${config.clientName}...`);
  
  const results = [];
  
  for (const album of config.albums) {
    const albumId = `album_${album.id}_${Date.now()}`;
    
    // Fetch DB data for placements and texts
    let placements = [];
    let texts = [];
    try {
      placements = await getPlacements(album.id);
      texts = await getAlbumTexts(album.id);
    } catch (e) {
      console.log('Failed to load DB config for album; using fallback data', e);
    }

    // 1. Generate Cover Render
    const coverPdf = await generateCover(album, texts);
    const coverPath = `generated/${config.orderNumber}_${albumId}_cover.pdf`;
    await saveLocalPdf(coverPdf, coverPath);

    // 2. Generate Interior Render
    // Pass DB placements and DB texts to the interior generator
    const interiorPdf = await generateInterior(album, placements, texts, config);
    const interiorPath = `generated/${config.orderNumber}_${albumId}_interior.pdf`;
    await saveLocalPdf(interiorPdf, interiorPath);

    results.push({
      albumName: `${album.destination.name} - ${config.clientName}`,
      coverUrl: getLocalUrl(coverPath),
      interiorUrl: getLocalUrl(interiorPath)
    });
  }

  return results;
}

/**
 * Generate the Hardcover Wrap PDF (Front + Spine + Back)
 */
async function generateCover(album, texts) {
  const getText = (target) => texts?.find(t => t.target === target)?.content || '';
  const pdfDoc = await PDFDocument.create();
  
  // Calculate Spine Width based on page count
  const spineWidth = album.pageCount === 100 ? 60 : 40;
  const totalWidth = (A4_WIDTH * 2) + spineWidth + (BLEED * 2);
  const totalHeight = A4_HEIGHT + (BLEED * 2);

  const page = pdfDoc.addPage([totalWidth, totalHeight]);
  const { background_color, name, cover_url, back_cover_url } = album.destination;
  const color = hexToRgb(background_color || '#000033');

  // 1. Background Fill
  page.drawRectangle({
    x: 0, y: 0, width: totalWidth, height: totalHeight,
    color: rgb(color.r/255, color.g/255, color.b/255)
  });

  // 2. Help embedding Front and Back covers
  try {
    if (cover_url) {
      const frontBytes = await (await fetch(cover_url)).arrayBuffer();
      const frontImg = await pdfDoc.embedPdf(frontBytes); // Assuming its a split PDF page
      page.drawPage(frontImg[0], {
        x: BLEED + A4_WIDTH + spineWidth,
        y: BLEED,
        width: A4_WIDTH,
        height: A4_HEIGHT
      });
    }
    
    if (back_cover_url) {
      const backBytes = await (await fetch(back_cover_url)).arrayBuffer();
      const backImg = await pdfDoc.embedPdf(backBytes);
      page.drawPage(backImg[0], {
        x: BLEED,
        y: BLEED,
        width: A4_WIDTH,
        height: A4_HEIGHT
      });
    }
  } catch (err) {
    console.error('[PdfAssembly] Error embedding covers:', err.message);
  }

  // 3. Draw Spine Text using Londrina Solid
  try {
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = fs.readFileSync(path.resolve('services', 'londrinasolid.ttf'));
    const londrinaFont = await pdfDoc.embedFont(fontBytes);
    
    // Position for spine is centered
    const centerX = BLEED + A4_WIDTH + (spineWidth / 2);
    
    const destText = getText('cover_spine_title') || name.replace(/\s+\d+$/, '').toUpperCase();
    const destSize = 36;
    const destWidth = londrinaFont.widthOfTextAtSize(destText, destSize);
    
    page.drawText(destText, {
      x: centerX - (destSize * 0.35),
      y: (totalHeight / 2) + (destWidth / 2),
      size: destSize,
      font: londrinaFont,
      color: rgb(1, 1, 1),
      rotate: { angle: -90, type: 'degrees' }
    });

    const yearText = getText('cover_spine_year') || `${album.year}`;
    const yearSize = 14;
    const yearWidth = londrinaFont.widthOfTextAtSize(yearText, yearSize);

    page.drawText(yearText, {
      x: centerX - (yearWidth / 2),
      y: 60,
      size: yearSize,
      font: londrinaFont,
      color: rgb(1, 1, 1)
    });
  } catch (err) {
    console.error('Spine font error:', err);
  }

  return await pdfDoc.save();
}

/**
 * Generate Interior PDF with Branded Content and Photos
 */
async function generateInterior(album, placements, texts, config) {
  const getText = (target) => texts?.find(t => t.target === target)?.content || '';
  const pdfDoc = await PDFDocument.create();
  const targetPageCount = album.pageCount || 60;
  
  // 1. Prepend Branding PDF Pages 1 & 2
  try {
    const { data } = supabase.storage.from('system-assets').getPublicUrl('interior_branding.pdf');
    if (data?.publicUrl) {
      const resp = await fetch(data.publicUrl);
      if (resp.ok) {
        const brandingBytes = await resp.arrayBuffer();
        const brandingPdf = await PDFDocument.load(brandingBytes);
        
        // Copy ONLY Page 2 (The end-page is pages 3, 4)
        const firstTwo = await pdfDoc.copyPages(brandingPdf, [0, 1]);
        
        // 1. Synthesize a Pure Clean "Page 1"
        const page1 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        
        // Draw Clean Custom Text directly on a pristine white page
        pdfDoc.registerFontkit(fontkit);
        const fontBytes = fs.readFileSync(path.resolve('services', 'londrinasolid.ttf'));
        const londrinaFont = await pdfDoc.embedFont(fontBytes);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const destText = getText('interior_dest') || (album.destination.name || '').replace(/\s+\d+$/, '').toUpperCase();
        const yearText = getText('interior_year') || `[ ${album.year || new Date().getFullYear()} ]`;
        const nameText = getText('interior_name') || (album.customName || config.clientName || '').toUpperCase();
        const siteText = getText('interior_website') || 'storiz.ma';
        
        const destSize = 64;
        const yearSize = 28;
        const nameSize = 20;
        const siteSize = 16;
        
        const centerCol = A4_WIDTH / 2;
        
        page1.drawText(destText, {
          x: centerCol - (londrinaFont.widthOfTextAtSize(destText, destSize) / 2),
          y: A4_HEIGHT * 0.60,
          size: destSize,
          font: londrinaFont,
          color: rgb(0, 0, 0)
        });
        
        page1.drawText(yearText, {
          x: centerCol - (londrinaFont.widthOfTextAtSize(yearText, yearSize) / 2),
          y: A4_HEIGHT * 0.52,
          size: yearSize,
          font: londrinaFont,
          color: rgb(0, 0, 0)
        });

        page1.drawText(nameText, {
          x: centerCol - (fontBold.widthOfTextAtSize(nameText, nameSize) / 2),
          y: A4_HEIGHT * 0.20,
          size: nameSize,
          font: fontBold,
          color: rgb(0, 0, 0)
        });

        page1.drawText(siteText, {
          x: centerCol - (fontBold.widthOfTextAtSize(siteText, siteSize) / 2),
          y: A4_HEIGHT * 0.10,
          size: siteSize,
          font: fontBold,
          color: rgb(0, 0, 0)
        });

        const embeddedPage2 = await pdfDoc.embedPage(firstTwo[1]);
        const page2 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        page2.drawPage(embeddedPage2, {
          x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT
        });
        
        // Store Branding PDF temporarily to extract the last two pages later
        pdfDoc.__brandingPdf = brandingPdf;
      }
    }
  } catch (err) {
    console.log('[PdfAssembly] Branding PDF start skip:', err.message);
  }

  // 2. Add Photos — using defined placements
  const maxPages = album.pageCount || 60;
  
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const pagePlacements = placements
      .filter(p => p.page_number === pageNum)
      .sort((a,b) => a.slot_index - b.slot_index);
      
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    const count = pagePlacements.length;
    if (count === 0) continue;

    for (let i = 0; i < count; i++) {
      const placement = pagePlacements[i];
      try {
        const resp = await fetch(placement.photo_url);
        const rawBuffer = Buffer.from(await resp.arrayBuffer());

        let imgW = A4_WIDTH, imgH = A4_HEIGHT, x = 0, y = 0;
        if (count === 1) {
            imgW = A4_WIDTH; imgH = A4_HEIGHT; x = 0; y = 0;
        } else if (count === 2) {
            imgW = A4_WIDTH; imgH = A4_HEIGHT / 2;
            x = 0; y = i === 0 ? (A4_HEIGHT / 2) : 0;
        } else if (count === 3) {
            if (i === 0) {
                imgW = A4_WIDTH; imgH = A4_HEIGHT / 2;
                x = 0; y = A4_HEIGHT / 2;
            } else {
                imgW = A4_WIDTH / 2; imgH = A4_HEIGHT / 2;
                x = i === 1 ? 0 : (A4_WIDTH / 2);
                y = 0;
            }
        } else {
            imgW = A4_WIDTH / 2; imgH = A4_HEIGHT / 2;
            x = (i % 2) === 0 ? 0 : (A4_WIDTH / 2);
            // In PDF coordinate system, Y is measured from bottom-up!
            y = i < 2 ? (A4_HEIGHT / 2) : 0;
        }

        // Multiply points ~ 4x for 300DPI pixel-perfect cropping buffer!
        const sharpW = Math.round(imgW * 4);
        const sharpH = Math.round(imgH * 4);

        const croppedBuffer = await sharp(rawBuffer)
          .resize(sharpW, sharpH, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 90 })
          .toBuffer();

        const imagePdfObj = await pdfDoc.embedJpg(croppedBuffer);
        page.drawImage(imagePdfObj, { x, y, width: imgW, height: imgH });
        
      } catch (err) {
        console.error(`Error embedding photo ${placement.id}:`, err.message);
      }
    }
  }

  // 3. No empty page padding — PDF contains exactly as many pages as needed

  // 4. Append Branding PDF Pages 3 & 4
  if (pdfDoc.__brandingPdf) {
    const brandingPdf = pdfDoc.__brandingPdf;
    try {
      const pageCount = brandingPdf.getPageCount();
      if (pageCount >= 4) {
        const lastTwo = await pdfDoc.copyPages(brandingPdf, [pageCount - 2, pageCount - 1]);
        
        const embeddedEnd1 = await pdfDoc.embedPage(lastTwo[0]);
        const endPage1 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        endPage1.drawPage(embeddedEnd1, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
        
        const embeddedEnd2 = await pdfDoc.embedPage(lastTwo[1]);
        const endPage2 = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        endPage2.drawPage(embeddedEnd2, { x: 0, y: 0, width: A4_WIDTH, height: A4_HEIGHT });
      }
    } catch (err) {
      console.log('[PdfAssembly] Branding PDF end skip:', err.message);
    }
  }

  return await pdfDoc.save();
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 51 };
}

async function saveLocalPdf(bytes, storagePath) {
  // Ensure the generated directory exists
  const targetDir = path.resolve(path.dirname(storagePath));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  const fullPath = path.resolve(storagePath);
  fs.writeFileSync(fullPath, Buffer.from(bytes));
}

function getLocalUrl(storagePath) {
  const fileName = path.basename(storagePath);
  return `http://localhost:3001/generated/${fileName}`;
}
