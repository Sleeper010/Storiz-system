import { Router } from 'express';
import {
  createPhoto,
  getPhotosByOrderAlbum,
  updatePhotoPositions,
  commitPhotos,
  deletePhoto
} from '../services/photoService.js';

const router = Router();

/**
 * GET /api/photos/:orderId/:albumId
 * List photos for a specific order + album, sorted by position
 */
router.get('/:orderId/:albumId', async (req, res) => {
  try {
    const photos = await getPhotosByOrderAlbum(req.params.orderId, req.params.albumId);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch photos', details: err.message });
  }
});

/**
 * POST /api/photos/register
 * Register an uploaded photo in the DB (called after frontend uploads to Supabase Storage)
 * Body: { orderId, albumId, storagePath, publicUrl, fileName, width, height, position }
 */
router.post('/register', async (req, res) => {
  const { orderId, albumId, storagePath, publicUrl, fileName, width, height, position } = req.body;

  if (!orderId || !storagePath || !publicUrl) {
    return res.status(400).json({ error: 'orderId, storagePath, and publicUrl are required' });
  }

  try {
    const photo = await createPhoto({
      orderId, albumId, storagePath, publicUrl, fileName,
      width: width || 0, height: height || 0, position: position || 0
    });
    res.json(photo);
  } catch (err) {
    res.status(500).json({ error: 'Failed to register photo', details: err.message });
  }
});

/**
 * PUT /api/photos/reorder
 * Update photo positions after drag-reorder
 * Body: { updates: [{ id, position }] }
 */
router.put('/reorder', async (req, res) => {
  const { updates } = req.body;
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'updates array is required' });
  }

  try {
    await updatePhotoPositions(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reorder photos', details: err.message });
  }
});

/**
 * POST /api/photos/commit/:albumId
 * Mark all pending photos for this album as committed (won't be auto-deleted)
 */
router.post('/commit/:albumId', async (req, res) => {
  try {
    await commitPhotos(req.params.albumId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to commit photos', details: err.message });
  }
});

/**
 * DELETE /api/photos/:photoId
 * Remove a single photo from DB + storage
 */
router.delete('/:photoId', async (req, res) => {
  try {
    await deletePhoto(req.params.photoId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo', details: err.message });
  }
});

export default router;
