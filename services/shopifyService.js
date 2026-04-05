import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const shop = process.env.SHOPIFY_STORE_URL;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

console.log(`[ShopifyService] Initializing. Shop: ${shop}, Token: ${accessToken ? accessToken.substring(0, 10) + '...' : 'MISSING'}`);

/**
 * Fetch orders from Shopify Admin REST API
 */
export async function fetchOrders(params = {}) {
  const query = new URLSearchParams({
    status: 'any',
    limit: 50,
    ...params
  }).toString();

  const url = `https://${shop}/admin/api/2024-01/orders.json?${query}`;
  console.log(`[ShopifyService] Fetching orders: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Shopify API Error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return data.orders.map(formatOrder);
  } catch (error) {
    console.error('Error fetching Shopify orders:', error.message);
    throw error;
  }
}

/**
 * Fetch a single order by ID
 */
export async function fetchOrderById(id) {
  const url = `https://${shop}/admin/api/2024-01/orders/${id}.json`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Shopify API Error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return formatOrder(data.order);
  } catch (error) {
    console.error(`Error fetching Shopify order ${id}:`, error.message);
    throw error;
  }
}

/**
 * Helper to process Shopify order data into app-friendly format
 */
function formatOrder(order) {
  // Detect tier (Solo/Duo/Trio) from line items
  let tier = 'Solo';
  const allLineItems = order.line_items || [];
  
  const trioFound = allLineItems.some(li => li.title.toLowerCase().includes('trio') || li.variant_title?.toLowerCase().includes('trio'));
  const duoFound = allLineItems.some(li => li.title.toLowerCase().includes('duo') || li.variant_title?.toLowerCase().includes('duo'));
  
  if (trioFound) tier = 'Trio';
  else if (duoFound) tier = 'Duo';

  return {
    id: order.id,
    orderNumber: order.order_number || order.name,
    processedAt: order.processed_at,
    totalPrice: order.total_price,
    currency: order.currency,
    email: order.email,
    firstName: order.shipping_address?.first_name || order.billing_address?.first_name || 'N/A',
    lastName: order.shipping_address?.last_name || order.billing_address?.last_name || '',
    tier: tier,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    lineItems: allLineItems.map(li => ({
      title: li.title,
      quantity: li.quantity,
      variantTitle: li.variant_title,
      properties: li.properties
    })),
    raw: order // Keep raw data just in case
  };
}
