import sharp from 'sharp';
import fs from 'fs';

async function testPdfRead() {
  const pdfPath = 'C:\\Users\\sleeper\\Downloads\\Editable photobook covers2.pdf';
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF file not found at:', pdfPath);
    return;
  }

  console.log('Testing sharp PDF read for page 0...');
  try {
    const info = await sharp(pdfPath, { page: 0 })
      .toBuffer({ resolveWithObject: true });
    
    console.log('✅ Sharp successfully read the PDF page!');
    console.log('Info:', info.info);
    
    // Test color extraction (sampling top-left corner)
    const { data, info: imgInfo } = await sharp(pdfPath, { page: 0 })
      .extract({ left: 10, top: 10, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const hex = `#${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`;
    console.log('Extracted Background Color (sample):', hex);
    
  } catch (err) {
    console.error('❌ Sharp PDF read failed:', err.message);
    console.log('Note: Sharp requires libvips with poppler/ghostscript to read PDFs.');
  }
}

testPdfRead();
