import express from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { generateAlbum } from '../services/pdfAssemblyService.js';
import { commitPhotos } from '../services/photoService.js';

const router = express.Router();

// POST /api/generate
router.post('/', async (req, res) => {
  const { config, photos } = req.body;
  
  if (!config || !photos) {
    return res.status(400).json({ error: 'Config and Photos are required' });
  }

  try {
    const results = await generateAlbum(config, photos);
    
    // Commit photos for all albums after successful generation
    if (config.albums) {
      for (const album of config.albums) {
        try {
          if (album.id) await commitPhotos(album.id);
        } catch (commitErr) {
          console.warn('[GenerationRoute] Photo commit warning:', commitErr.message);
        }
      }
    }
    
    res.json({ success: true, results });
  } catch (err) {
    console.error('[GenerationRoute] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate PDF album', details: err.message });
  }
});

// POST /api/generate/download-zip
router.post('/download-zip', async (req, res) => {
  const { coverUrl, interiorUrl, orderId, clientName, albumName } = req.body;
  
  try {
    const coverFile = path.resolve('generated', coverUrl.split('/').pop());
    const interiorFile = path.resolve('generated', interiorUrl.split('/').pop());

    if (!fs.existsSync(coverFile) || !fs.existsSync(interiorFile)) {
      return res.status(404).json({ error: 'PDF files not found on server' });
    }

    const safeClientName = (clientName || 'Client').replace(/[^a-z0-9]/gi, '_');
    const safeAlbumName = (albumName || 'Album').replace(/[^a-z0-9]/gi, '_');
    const folderName = `${orderId}_${safeClientName}_${safeAlbumName}`;
    const zipName = `${folderName}.zip`;

    res.attachment(zipName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => { throw err; });
    archive.pipe(res);

    archive.file(coverFile, { name: `${folderName}/cover_${safeAlbumName}.pdf` });
    archive.file(interiorFile, { name: `${folderName}/interior_${safeAlbumName}.pdf` });

    await archive.finalize();
  } catch (err) {
    console.error('ZIP Error:', err);
    res.status(500).json({ error: 'Failed to create ZIP' });
  }
});

export default router;
