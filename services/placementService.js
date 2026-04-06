import { supabase } from './supabaseService.js';

export async function getPlacements(albumId) {
  const { data, error } = await supabase
    .from('album_photos')
    .select('*')
    .eq('album_id', albumId)
    .order('page_number', { ascending: true })
    .order('slot_index', { ascending: true });

  if (error) throw error;
  return data;
}

export async function runAutoPlacement(albumId, photos, pageCount, layoutType) {
  // Clear existing placements
  await supabase.from('album_photos').delete().eq('album_id', albumId);

  const N = photos.length;
  if (N === 0) return [];

  // Re-use logic from pdfAssemblyService for distribution
  const P = N <= pageCount ? N : pageCount;
  let capacities = [];
  
  if (layoutType === 'single' || N <= P) {
    capacities = Array.from({ length: N }, () => 1);
  } else {
    capacities = Array(P).fill(1);
    let remaining = N - P;
    let maxIter = P * 20;
    while (remaining > 0 && maxIter-- > 0) {
      const idx = Math.floor(Math.random() * P);
      if (capacities[idx] < 4) {
        const space = 4 - capacities[idx];
        const add = Math.min(remaining, Math.floor(Math.random() * space) + 1);
        capacities[idx] += add;
        remaining -= add;
      }
    }
  }

  const placements = [];
  let photoIdx = 0;
  // page_number starts at 1, but keep in mind Branding takes pages 1,2 initially.
  // We'll use page_number for the *photos* section (1 to P).
  for (let i = 0; i < P; i++) {
    const count = capacities[i] || 0;
    for (let slot = 0; slot < count; slot++) {
      if (photoIdx < N) {
        const photo = photos[photoIdx++];
        placements.push({
          album_id: albumId,
          photo_url: photo.url || photo.preview, // Needs to be actual uploaded URL
          photo_name: photo.name,
          original_width: photo.width || 0,
          original_height: photo.height || 0,
          page_number: i + 1, // 1-indexed
          slot_index: slot,
          sort_order: placements.length
        });
      }
    }
  }

  // Bulk insert
  if (placements.length > 0) {
    const { error } = await supabase.from('album_photos').insert(placements);
    if (error) throw error;
  }

  return getPlacements(albumId);
}

export async function bulkUpsertPlacements(albumId, placements) {
  // Clear first, then insert (easy way to handle deletes/moves)
  await supabase.from('album_photos').delete().eq('album_id', albumId);
  
  if (placements.length > 0) {
    const toInsert = placements.map((p, idx) => ({
      album_id: albumId,
      photo_url: p.photo_url,
      photo_name: p.photo_name,
      original_width: p.original_width || 0,
      original_height: p.original_height || 0,
      page_number: p.page_number,
      slot_index: p.slot_index || 0,
      sort_order: p.sort_order || idx
    }));

    const { error } = await supabase.from('album_photos').insert(toInsert);
    if (error) throw error;
  }
  return true;
}
