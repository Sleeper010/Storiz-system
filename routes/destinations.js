import express from 'express';
import multer from 'multer';
import { getDestinations, splitAndUploadPdf, createDestination, deleteDestination } from '../services/designImportService.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// GET /api/destinations
router.get('/', async (req, res) => {
  try {
    const destinations = await getDestinations();
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch destinations', details: err.message });
  }
});

// POST /api/destinations
router.post('/', async (req, res) => {
  try {
    // Strip any fields that don't exist in the schema to avoid silent failures
    const { name, cover_url, back_cover_url, background_color } = req.body;
    const result = await createDestination({ name, cover_url, back_cover_url, background_color });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create destination', details: err.message });
  }
});

// DELETE /api/destinations/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteDestination(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete destination', details: err.message });
  }
});

// POST /api/destinations/import
router.post('/import', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });
  
  try {
    const pages = await splitAndUploadPdf(req.file.path, 'canva_import');
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: 'Failed to split PDF', details: err.message });
  }
});

export default router;
