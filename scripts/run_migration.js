import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('[Migration] Starting 002_features migration...');
  
  // We'll run each DDL statement individually via the Supabase REST API
  const statements = [
    // 1. Extend orders table
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'shopify'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS shopify_raw JSONB`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Solo'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS financial_status TEXT DEFAULT 'pending'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT`,
    
    // 2. Albums table
    `CREATE TABLE IF NOT EXISTS albums (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
      album_index INTEGER DEFAULT 0,
      destination_id UUID REFERENCES destinations(id),
      destination_snapshot JSONB,
      year TEXT DEFAULT '2026',
      page_count INTEGER DEFAULT 60,
      layout TEXT DEFAULT 'grid',
      custom_name TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // 3. Album photos table
    `CREATE TABLE IF NOT EXISTS album_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
      photo_url TEXT NOT NULL,
      photo_name TEXT,
      original_width INTEGER,
      original_height INTEGER,
      page_number INTEGER NOT NULL,
      slot_index INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    
    // 4. Album texts table
    `CREATE TABLE IF NOT EXISTS album_texts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
      target TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      font_size INTEGER DEFAULT 36,
      text_align TEXT DEFAULT 'center',
      x NUMERIC(8,2),
      y NUMERIC(8,2),
      max_width NUMERIC(8,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(album_id, target)
    )`,
  ];

  let ok = 0;
  let fail = 0;

  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { query: stmt });
      if (error) {
        // exec_sql might not exist — try a workaround via POST to /rest/v1/rpc
        console.log(`  ⚠️  RPC not available, statement requires Supabase SQL Editor`);
        console.log(`     ${stmt.substring(0, 80)}...`);
        fail++;
      } else {
        ok++;
        console.log(`  ✅ OK: ${stmt.substring(0, 60)}...`);
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n[Migration] Complete: ${ok} succeeded, ${fail} need manual SQL editor`);
  
  if (fail > 0) {
    console.log('\n📋 Please run the full SQL migration in Supabase SQL Editor:');
    console.log('   File: migrations/002_features.sql');
    console.log('   URL: https://supabase.com/dashboard/project/hamskbkgjfrmbqybgaxj/sql');
  }
}

runMigration();
