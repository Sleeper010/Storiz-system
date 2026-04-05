import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function setup() {
  console.log('🔧 Setting up destinations table via Supabase...\n');

  // Try to query first to see if table exists
  const { data: existing, error: checkErr } = await supabase
    .from('destinations')
    .select('id')
    .limit(1);

  if (!checkErr) {
    console.log('✅ destinations table already exists with', existing?.length || 0, 'rows');
    
    // Also check for the orders table
    const { error: ordersErr } = await supabase.from('orders').select('id').limit(1);
    if (ordersErr) {
      console.log('⚠️  orders table does not exist (non-critical for now)');
    } else {
      console.log('✅ orders table exists');
    }
    return;
  }

  console.log('❌ destinations table not found:', checkErr.message);
  console.log('\n⚠️  You need to create the table in Supabase Dashboard.');
  console.log('   Go to: https://supabase.com/dashboard/project/hamskbkgjfrmbqybgaxj/sql');
  console.log('   And run this SQL:\n');
  console.log(`
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  variant INTEGER DEFAULT 1,
  cover_url TEXT,
  back_cover_url TEXT,
  background_color TEXT DEFAULT '#000033',
  font_color TEXT DEFAULT '#FFFFFF',
  cover_front_url TEXT,
  cover_back_url TEXT,
  bg_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public access for the internal tool
ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON destinations FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id TEXT UNIQUE,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON orders FOR ALL USING (true) WITH CHECK (true);
  `);
}

setup().catch(console.error);
