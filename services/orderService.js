import { supabase } from './supabaseService.js';

export async function createManualOrder(orderData, albumsConfig) {
  // 1. Create order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert([{
      source: 'manual',
      order_number: `MANUAL-${Date.now()}`,
      client_name: orderData.client_name,
      email: orderData.email || null,
      phone: orderData.phone || null,
      tier: orderData.tier || 'Solo',
      status: 'pending',
    }])
    .select()
    .single();

  if (orderErr) throw new Error('Order creation failed: ' + orderErr.message);

  // 2. Create initialized albums
  const albumsToCreate = (albumsConfig || []).map((album, index) => ({
    order_id: order.id,
    album_index: index,
    destination_id: album.destination_id || null,
    year: album.year || new Date().getFullYear().toString(),
    page_count: album.page_count || 60,
    layout: album.layout || 'grid',
    status: 'draft'
  }));

  if (albumsToCreate.length > 0) {
    const { error: albumsErr } = await supabase
      .from('albums')
      .insert(albumsToCreate);
      
    if (albumsErr) throw new Error('Album creation failed: ' + albumsErr.message);
  }

  return order;
}

export async function getOrderWithAlbums(orderId) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      albums (*)
    `)
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}

export async function getManualOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('source', 'manual')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
