import { supabase } from './supabaseService.js';

// A4 base logic relative units (can be scaled)
export const A4_W = 595.28;
export const A4_H = 841.89;

/**
 * Fetch and construct standard book pages
 * 
 * Page Map (for a 60 page album):
 * - Page 0: Cover Spine / Wrap  (Type: 'cover')
 * - Page 1: Inner blank cover (Type: 'inner_cover')
 * - Page 2: Title Page (Type: 'title')
 * - Page 3: Blank Left Page (Type: 'blank')
 * - Pages 4 to 4+(N-1): Photos (Type: 'photo_grid')
 * - End Blank Pages up to max (e.g. 60)
 * - Page 60+1: End Blank
 * - Page 60+2: End Cover
 */
export async function getBookPages(albumId) {
  // 1. Fetch Album Data
  const { data: album, error: albumErr } = await supabase
    .from('albums')
    .select(`
      *,
      album_texts (*),
      album_photos (*)
    `)
    .eq('id', albumId)
    .single();

  if (albumErr) throw albumErr;

  const dest = album.destination_snapshot || { name: 'Album' };
  const bgColor = dest.background_color || dest.bg_color || '#000033';
  const fontColor = dest.font_color || '#ffffff';
  const coverUrl = dest.cover_url || dest.cover_front_url || null;
  const backCoverUrl = dest.back_cover_url || dest.cover_back_url || null;

  const texts = album.album_texts || [];
  const photos = album.album_photos || [];
  const maxPages = album.page_count || 60;

  const getText = (target) => texts.find(t => t.target === target) || { content: '', target };

  const pages = [];

  // P1: Cover (we treat front/back as a 1-page spread for the editor preview)
  pages.push({
    id: `page_${album.id}_cover`,
    type: 'cover',
    pageNumber: 0,
    background: { color: bgColor, fontColor, front: coverUrl, back: backCoverUrl },
    slots: [],
    texts: [
      { ...getText('cover_spine_title'), defaultContent: dest.name },
      { ...getText('cover_spine_year'), defaultContent: album.year }
    ]
  });

  // P2: Inner Cover
  pages.push({ id: `page_${album.id}_inner`, type: 'inner_cover', pageNumber: 0.1, background: { color: bgColor }, slots: [], texts: [] });

  // P3: Title Page (Right Page)
  pages.push({
    id: `page_${album.id}_title`,
    type: 'title',
    pageNumber: 0.2,
    background: { color: '#ffffff' },
    slots: [],
    texts: [
      { ...getText('interior_dest'), defaultContent: dest.name },
      { ...getText('interior_year'), defaultContent: album.year },
      { ...getText('interior_name'), defaultContent: album.custom_name },
      { ...getText('interior_website'), defaultContent: 'storiz.ma' }
    ]
  });

  // P4: Blank Left
  pages.push({ id: `page_${album.id}_blank`, type: 'blank', pageNumber: 0.3, background: { color: '#ffffff' }, slots: [], texts: [] });

  // P5..PN: Photos — sorted by page_number then slot_index then sort_order
  for (let i = 1; i <= maxPages; i++) {
    const pagePhotos = photos
      .filter(p => p.page_number === i)
      .sort((a, b) => (a.slot_index - b.slot_index) || (a.sort_order - b.sort_order));
    pages.push({
      id: `page_${album.id}_p${i}`,
      type: 'photo_grid',
      pageNumber: i,
      background: { color: '#ffffff' },
      slots: pagePhotos.map(p => ({
        id: p.id,
        placementId: p.id,
        url: p.photo_url,
        name: p.photo_name,
        slotIndex: p.slot_index
      })),
      texts: []
    });
  }

  // P_END: End pages
  pages.push({ id: `page_${album.id}_end_blank`, type: 'blank', pageNumber: maxPages + 1, background: { color: '#ffffff' }, slots: [], texts: [] });
  pages.push({ id: `page_${album.id}_end_cover`, type: 'end_cover', pageNumber: maxPages + 2, background: { color: bgColor }, slots: [], texts: [] });

  // POST-PROCESSING: Normalize to exact strictly-typed schema for the Split Architecture
  const normalizedPages = pages.map((p, i) => {
    // Math logic based on 0-index where 0 is Front Cover (Right Side)
    // 0: Spread 0 (Right)
    // 1: Spread 1 (Left), 2: Spread 1 (Right)
    const position = i;
    const page_side = (i % 2 === 0) ? 'right' : 'left';
    const spread_index = Math.floor((i + 1) / 2);

    let page_type = 'interior';
    if (p.type === 'cover') page_type = 'front_cover';
    else if (p.type === 'end_cover') page_type = 'back_cover';

    const text_elements = p.texts ? p.texts.map(t => ({
      id: t.id || `text_${t.target}`,
      field_name: t.target,
      content: t.content || t.defaultContent || '',
      font: t.target.includes('year') ? 'system-ui' : 'Londrina Solid',
      font_size: t.target.includes('dest') ? 44 : t.target.includes('name') ? 22 : 18,
      color: p.background.fontColor || '#000000',
      alignment: 'center'
    })) : [];

    const image_slots = p.slots ? p.slots.map((s, sIdx) => ({
      slot_id: s.id || `slot_${i}_${sIdx}`,
      position: s.slotIndex !== undefined ? s.slotIndex : sIdx,
      assigned_image_id: s.placementId || null,
      image_url: s.url || null
    })) : [];

    return {
      id: p.id,
      album_id: album.id,
      original_type: p.type, // keep for backward compatibility during migration
      page_type,
      spread_index,
      page_side,
      position,
      background: p.background,
      image_slots,
      text_elements,
      render_metadata: { width_mm: 210, height_mm: 297, bleed_mm: 3 }
    };
  });

  return normalizedPages;
}
