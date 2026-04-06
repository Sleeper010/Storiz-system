import { supabase } from './supabaseService.js';

export async function getAlbumTexts(albumId) {
  const { data, error } = await supabase
    .from('album_texts')
    .select('*')
    .eq('album_id', albumId);
  if (error) throw error;
  return data;
}

export async function bulkUpsertTexts(albumId, textArray) {
  // Upsert on UNIQUE(album_id, target)
  const toUpsert = textArray.map(t => ({
    album_id: albumId,
    target: t.target,
    content: t.content,
    font_size: t.font_size || 36,
    text_align: t.text_align || 'center'
  }));

  const { error } = await supabase
    .from('album_texts')
    .upsert(toUpsert, { onConflict: 'album_id, target' });

  if (error) throw error;
  return true;
}

export async function initializeDefaultTexts(albumId, orderContext, albumContext) {
  const destName = (albumContext?.destination?.name || '').replace(/\s+\d+$/, '').toUpperCase();
  const yearText = `[ ${albumContext?.year || new Date().getFullYear()} ]`;
  const nameText = (albumContext?.customName || orderContext?.clientName || '').toUpperCase();
  
  const defaults = [
    { target: 'cover_spine_title', content: destName, font_size: 36 },
    { target: 'cover_spine_year', content: albumContext?.year || new Date().getFullYear().toString(), font_size: 14 },
    { target: 'interior_dest', content: destName, font_size: 64 },
    { target: 'interior_year', content: yearText, font_size: 28 },
    { target: 'interior_name', content: nameText, font_size: 20 },
    { target: 'interior_website', content: 'storiz.ma', font_size: 16 }
  ];

  await bulkUpsertTexts(albumId, defaults);
  return getAlbumTexts(albumId);
}
