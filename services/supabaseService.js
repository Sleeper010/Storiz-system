import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing in .env');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Initialize buckets and tables
 */
export async function initializeDatabase() {
  console.log('[SupabaseService] Initializing storage buckets...');
  const buckets = ['design-assets', 'photos', 'generated-pdfs', 'system-assets'];
  
  for (const bucketName of buckets) {
    try {
      const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
      if (getError) {
        console.log(`[SupabaseService] Creating bucket: ${bucketName}...`);
        await supabase.storage.createBucket(bucketName, { public: true });
      } else {
        console.log(`[SupabaseService] Bucket existing: ${bucketName}`);
      }
    } catch (err) {
      console.error(`[SupabaseService] Error initializing bucket ${bucketName}:`, err.message);
    }
  }

  // destinations table creation via RPC or expected to exist
  console.log('[SupabaseService] Initialization complete.');
}
