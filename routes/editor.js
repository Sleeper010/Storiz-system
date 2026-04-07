import express from 'express';
import { getBookPages } from '../services/pageBuilderService.js';
import { supabase } from '../services/supabaseService.js';
import { runAutoPlacement } from '../services/placementService.js';
import { commitPhotos } from '../services/photoService.js';

const router = express.Router();

// GET normalized pages
router.get('/:albumId/pages', async (req, res) => {
  try {
    const pages = await getBookPages(req.params.albumId);
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pages', details: err.message });
  }
});

// PUT to save texts / placements from the unified editor
// Expects: { texts: [{target, content}], placements: [{ id, page_number, slot_index }] }
router.put('/:albumId/pages', async (req, res) => {
  const { albumId } = req.params;
  const { texts, placements } = req.body;
  
  try {
    // 1. Save Texts
    if (texts && texts.length > 0) {
      const textUpserts = texts.map(t => ({
        album_id: albumId,
        target: t.target,
        content: t.content,
        font_size: t.font_size || 36,
        text_align: t.text_align || 'center'
      }));
      
      const { error: txtErr } = await supabase
        .from('album_texts')
        .upsert(textUpserts, { onConflict: 'album_id, target' });
      if (txtErr) throw txtErr;
    }

    // 2. Save Placements
    if (placements && placements.length > 0) {
      const placementUpdates = placements.map(p => ({
        id: p.id,
        album_id: albumId,
        page_number: p.page_number,
        slot_index: p.slot_index
      }));
      
      const { error: pErr } = await supabase
        .from('album_photos')
        .upsert(placementUpdates, { onConflict: 'id' });
      if (pErr) throw pErr;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save book edits', details: err.message });
  }
});

// POST to auto-fill
router.post('/:albumId/auto', async (req, res) => {
  const { albumId } = req.params;
  const { photos, pageCount, layoutType } = req.body;

  try {
    // Use the existing placement auto logic
    await runAutoPlacement(albumId, photos, pageCount, layoutType);
    
    // Commit photos for this album since they are now placed
    try {
      await commitPhotos(albumId);
    } catch (commitErr) {
      console.warn('[Editor] Photo commit after auto-fill failed:', commitErr.message);
    }
    
    // Return the re-normalized pages immediately
    const pages = await getBookPages(albumId);
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ error: 'Auto placement failed', details: err.message });
  }
});

export default router;
