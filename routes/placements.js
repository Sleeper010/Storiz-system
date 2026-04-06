import express from 'express';
import { getPlacements, runAutoPlacement, bulkUpsertPlacements } from '../services/placementService.js';

const router = express.Router();

// GET /api/placements/:albumId
router.get('/:albumId', async (req, res) => {
  try {
    const placements = await getPlacements(req.params.albumId);
    res.json(placements);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch placements', details: err.message });
  }
});

// POST /api/placements/:albumId/auto
router.post('/:albumId/auto', async (req, res) => {
  const { photos, pageCount, layoutType } = req.body;
  if (!photos || !Array.isArray(photos)) {
    return res.status(400).json({ error: 'Photos array is required' });
  }

  try {
    const placements = await runAutoPlacement(req.params.albumId, photos, pageCount || 60, layoutType || 'grid');
    res.json(placements);
  } catch (err) {
    res.status(500).json({ error: 'Auto placement failed', details: err.message });
  }
});

// PUT /api/placements/:albumId
router.put('/:albumId', async (req, res) => {
  const { placements } = req.body;
  if (!Array.isArray(placements)) {
    return res.status(400).json({ error: 'Placements array is required' });
  }

  try {
    await bulkUpsertPlacements(req.params.albumId, placements);
    const updated = await getPlacements(req.params.albumId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update placements', details: err.message });
  }
});

export default router;
