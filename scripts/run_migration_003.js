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
  console.log('[Migration] Starting 003_order_photos migration...');
  
  const migrationPath = path.join(__dirname, '..', 'migrations', '003_order_photos.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // Supabase doesn't expose a raw SQL endpoint easily via @supabase/supabase-js without rpc
  // We'll try the rpc wrapper if it exists, otherwise tell the user.
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let ok = 0;
  let fail = 0;

  for (const stmt of statements) {
    try {
      console.log(`Executing: ${stmt.substring(0, 50)}...`);
      const { error } = await supabase.rpc('exec_sql', { query: stmt });
      if (error) {
        console.warn(`  ⚠️ RPC Error: ${error.message}`);
        fail++;
      } else {
        ok++;
        console.log(`  ✅ OK`);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n[Migration] Summary: ${ok} succeeded, ${fail} failed.`);
  if (fail > 0) {
    console.log('\n📋 RPC direct execution failed (this is common for Supabase security).');
    console.log('Please copy the contents of "migrations/003_order_photos.sql" and');
    console.log('paste them into the Supabase SQL Editor:');
    console.log('URL: https://supabase.com/dashboard/project/hamskbkgjfrmbqybgaxj/sql');
  } else {
      console.log('\n🚀 Migration applied successfully!');
  }
}

runMigration();
