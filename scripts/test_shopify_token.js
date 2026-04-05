import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const shop = process.env.SHOPIFY_STORE_URL;
const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

async function testToken() {
  const versions = ['2024-01', '2024-04'];
  const authStringSecret = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const authStringToken = Buffer.from(`${clientId}:${accessToken}`).toString('base64');
  
  const headers = [
    { 'X-Shopify-Access-Token': accessToken },
    { 'Authorization': `Bearer ${accessToken}` },
    { 'Authorization': `Basic ${authStringSecret}` },
    { 'Authorization': `Basic ${authStringToken}` }
  ];

  for (const v of versions) {
    for (const h of headers) {
      const headerName = Object.keys(h)[0];
      const headerValue = h[headerName].substring(0, 15) + '...';
      console.log(`Testing version ${v} with header ${headerName} / ${headerValue}`);
      try {
        const response = await fetch(`https://${shop}/admin/api/${v}/shop.json`, {
          method: 'GET',
          headers: {
            ...h,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        if (response.ok) {
          console.log(`✅ SUCCESS! Version ${v} and header ${headerName} worked! Shop:`, data.shop.name);
          return true;
        } else {
          console.error(`❌ FAILED for ${v}/${headerName}:`, data.errors || data);
        }
      } catch (err) {
        console.error(`❌ ERROR for ${v}/${headerName}:`, err.message);
      }
    }
  }
  return false;
}

testToken();
