import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const shop = process.env.SHOPIFY_STORE_URL;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

async function getAccessToken() {
  console.log(`Fetching access token for ${shop}...`);
  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'read_orders,read_products,read_content'
      })
    });
    const data = await response.json();
    if (response.ok) {
      console.log('✅ Access Token received:', data.access_token);
      return data.access_token;
    } else {
      console.error('❌ Error fetching access token:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching access token:', error.message);
    return null;
  }
}

getAccessToken();
