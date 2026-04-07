import { supabase } from './supabaseService.js';

/**
 * Register a newly uploaded photo in the DB
 */
export async function createPhoto({ orderId, albumId, storagePath, publicUrl, fileName, width, height, position }) {
  const { data, error } = await supabase
    .from('order_photos')
    .insert([{
      order_id: orderId,
      album_id: albumId || null,
      storage_path: storagePath,
      public_url: publicUrl,
      file_name: fileName,
      original_width: width || 0,
      original_height: height || 0,
      position: position || 0,
      status: 'pending',
      // expires_at defaults to NOW() + 24h via default column
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get photos for a specific order + album, sorted by position
 */
export async function getPhotosByOrderAlbum(orderId, albumId) {
  let query = supabase
    .from('order_photos')
    .select('*')
    .eq('order_id', orderId)
    .order('position', { ascending: true });

  if (albumId) {
    query = query.eq('album_id', albumId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Update photo positions after drag-reorder
 * Expects: [{ id, position }]
 */
export async function updatePhotoPositions(updates) {
  // Batch update each photo's position
  for (const item of updates) {
    const { error } = await supabase
      .from('order_photos')
      .update({ position: item.position })
      .eq('id', item.id);
    if (error) throw error;
  }
  return true;
}

/**
 * Commit photos for an album — marks them as "committed" so they won't be auto-deleted
 */
export async function commitPhotos(albumId) {
  const { error } = await supabase
    .from('order_photos')
    .update({ status: 'committed', expires_at: null })
    .eq('album_id', albumId)
    .eq('status', 'pending');

  if (error) throw error;
  return true;
}

/**
 * Commit photos by order ID (all albums)
 */
export async function commitPhotosByOrder(orderId) {
  const { error } = await supabase
    .from('order_photos')
    .update({ status: 'committed', expires_at: null })
    .eq('order_id', orderId)
    .eq('status', 'pending');

  if (error) throw error;
  return true;
}

/**
 * Delete a single photo (DB + storage)
 */
export async function deletePhoto(photoId) {
  // 1. Get the photo to find storage_path
  const { data: photo, error: fetchErr } = await supabase
    .from('order_photos')
    .select('*')
    .eq('id', photoId)
    .single();

  if (fetchErr) throw fetchErr;
  if (!photo) throw new Error('Photo not found');

  // 2. Delete from storage
  if (photo.storage_path) {
    try {
      await supabase.storage.from('photos').remove([photo.storage_path]);
    } catch (e) {
      console.warn('[PhotoService] Storage delete failed (may already be removed):', e.message);
    }
  }

  // 3. Delete DB row
  const { error: delErr } = await supabase
    .from('order_photos')
    .delete()
    .eq('id', photoId);

  if (delErr) throw delErr;
  return true;
}

/**
 * Cleanup expired pending photos (called by cron)
 * Deletes storage files + DB rows where status = 'pending' AND now() > expires_at
 */
export async function cleanupExpiredPhotos() {
  const now = new Date().toISOString();

  // 1. Fetch expired pending photos
  const { data: expired, error: fetchErr } = await supabase
    .from('order_photos')
    .select('id, storage_path')
    .eq('status', 'pending')
    .lt('expires_at', now);

  if (fetchErr) {
    console.error('[PhotoService] Cleanup fetch error:', fetchErr.message);
    return { deleted: 0, errors: 1 };
  }

  if (!expired || expired.length === 0) {
    return { deleted: 0, errors: 0 };
  }

  console.log(`[PhotoService] Cleaning up ${expired.length} expired photo(s)...`);

  // 2. Delete storage files in batch
  const storagePaths = expired.map(p => p.storage_path).filter(Boolean);
  if (storagePaths.length > 0) {
    try {
      await supabase.storage.from('photos').remove(storagePaths);
    } catch (e) {
      console.warn('[PhotoService] Batch storage delete error:', e.message);
    }
  }

  // 3. Delete DB rows
  const ids = expired.map(p => p.id);
  const { error: delErr } = await supabase
    .from('order_photos')
    .delete()
    .in('id', ids);

  if (delErr) {
    console.error('[PhotoService] Cleanup DB delete error:', delErr.message);
    return { deleted: 0, errors: 1 };
  }

  console.log(`[PhotoService] ✅ Cleaned up ${ids.length} expired photo(s)`);
  return { deleted: ids.length, errors: 0 };
}
