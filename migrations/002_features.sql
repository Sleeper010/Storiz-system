-- Migration 002: Features — Manual Orders, Photo Placement, Text Editing
-- Run against Supabase SQL Editor or via CLI

-- 1. Extend existing orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'shopify',
  ADD COLUMN IF NOT EXISTS shopify_raw JSONB,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'Solo',
  ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'MAD',
  ADD COLUMN IF NOT EXISTS financial_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT;

-- 2. Albums table
CREATE TABLE IF NOT EXISTS albums (
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
);
CREATE INDEX IF NOT EXISTS idx_albums_order ON albums(order_id);

-- 3. Album photos / placement table
CREATE TABLE IF NOT EXISTS album_photos (
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
);
CREATE INDEX IF NOT EXISTS idx_album_photos_album ON album_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_album_photos_page ON album_photos(album_id, page_number);

-- 4. Album texts table
CREATE TABLE IF NOT EXISTS album_texts (
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
);
CREATE INDEX IF NOT EXISTS idx_album_texts_album ON album_texts(album_id);
