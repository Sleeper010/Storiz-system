import express from 'express';
import { createManualOrder, getOrderWithAlbums, getManualOrders } from '../services/orderService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const orders = await getManualOrders();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch manual orders', details: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await getOrderWithAlbums(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order', details: err.message });
  }
});

router.post('/', async (req, res) => {
  const { order, albums } = req.body;
  if (!order || !order.client_name) {
    return res.status(400).json({ error: 'Client name is required' });
  }

  try {
    const newOrder = await createManualOrder(order, albums);
    res.json(newOrder);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create manual order', details: err.message });
  }
});

// Sync order to DB (useful for Shopify orders to get DB UUIDs)
router.post('/sync', async (req, res) => {
  const { order, albums } = req.body;
  const { supabase } = await import('../services/supabaseService.js');
  
  try {
    // 1. Upsert Order
    const { data: dbOrder, error: orderErr } = await supabase
      .from('orders')
      .upsert({
        shopify_order_id: order.id ? String(order.id) : null,
        source: order.source || 'shopify',
        order_number: order.orderNumber,
        client_name: `${order.firstName || ''} ${order.lastName || ''}`.trim(),
        email: order.email || null,
        phone: order.phone || null,
        tier: order.tier || 'Solo',
        total_price: order.totalPrice || 0,
        currency: order.currency || 'MAD',
        financial_status: order.financialStatus || 'pending',
        fulfillment_status: order.fulfillmentStatus || 'unfulfilled',
        shopify_raw: order
      }, { onConflict: 'shopify_order_id', ignoreDuplicates: false })
      .select().single();

    if (orderErr) throw orderErr;

    // 2. Clear old draft albums for this order, then re-insert
    await supabase.from('albums').delete().eq('order_id', dbOrder.id).eq('status', 'draft');

    const albumsToCreate = (albums || []).map((album, index) => ({
      order_id: dbOrder.id,
      album_index: index,
      destination_id: album.destination?.id || null,
      destination_snapshot: album.destination || null,
      year: album.year || new Date().getFullYear().toString(),
      page_count: album.pageCount || 60,
      layout: album.layout || 'grid',
      custom_name: album.customName || null,
      status: 'draft'
    }));

    const { data: dbAlbums, error: albumsErr } = await supabase
      .from('albums')
      .insert(albumsToCreate)
      .select();

    if (albumsErr) throw albumsErr;

    res.json({ ...dbOrder, albums: dbAlbums });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync order', details: err.message });
  }
});

export default router;
