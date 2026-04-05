import express from 'express';
import fs from 'fs';
import path from 'path';
import { fetchOrders, fetchOrderById } from '../services/shopifyService.js';

const router = express.Router();

function checkGeneratedFiles(orderNumber) {
  const generatedDir = path.resolve('generated');
  if (!fs.existsSync(generatedDir)) return { hasGeneratedPdf: false, results: [] };
  
  try {
    const files = fs.readdirSync(generatedDir);
    const cleanNum = orderNumber.toString().replace('#', '');
    const interiorFiles = files.filter(f => f.startsWith(`${cleanNum}_`) && f.endsWith('_interior.pdf'));
    
    if (interiorFiles.length > 0) {
      const results = interiorFiles.map(interiorFile => {
        const parts = interiorFile.split('_');
        const albumIdx = parts[2] !== undefined ? parseInt(parts[2]) : 0;
        const coverFile = interiorFile.replace('_interior.pdf', '_cover.pdf');
        
        return {
          albumName: `Album ${albumIdx + 1}`,
          coverUrl: `http://localhost:3001/generated/${coverFile}`,
          interiorUrl: `http://localhost:3001/generated/${interiorFile}`
        };
      });
      return { hasGeneratedPdf: true, results };
    }
  } catch (err) {
    console.warn('Error checking generated files:', err.message);
  }
  return { hasGeneratedPdf: false, results: [] };
}

// GET /api/shopify/orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await fetchOrders(req.query);
    const ordersWithGen = orders.map(order => {
      const genStatus = checkGeneratedFiles(order.orderNumber);
      return { ...order, ...genStatus };
    });
    res.json(ordersWithGen);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Shopify orders', details: err.message });
  }
});

// GET /api/shopify/orders/:id
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await fetchOrderById(req.params.id);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch Shopify order ${req.params.id}`, details: err.message });
  }
});

export default router;
