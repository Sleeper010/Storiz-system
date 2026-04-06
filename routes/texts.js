import express from 'express';
import { getAlbumTexts, bulkUpsertTexts, initializeDefaultTexts } from '../services/textService.js';

const router = express.Router();

// GET /api/texts/:albumId
router.get('/:albumId', async (req, res) => {
  try {
    const texts = await getAlbumTexts(req.params.albumId);
    res.json(texts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch text fields', details: err.message });
  }
});

// PUT /api/texts/:albumId
router.put('/:albumId', async (req, res) => {
  const { texts } = req.body;
  if (!Array.isArray(texts)) {
    return res.status(400).json({ error: 'Texts array is required' });
  }

  try {
    await bulkUpsertTexts(req.params.albumId, texts);
    const updated = await getAlbumTexts(req.params.albumId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update text fields', details: err.message });
  }
});

// POST /api/texts/:albumId/defaults
router.post('/:albumId/defaults', async (req, res) => {
  const { orderContext, albumContext } = req.body;
  try {
    const texts = await initializeDefaultTexts(req.params.albumId, orderContext, albumContext);
    res.json(texts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate default texts', details: err.message });
  }
});

export default router;
