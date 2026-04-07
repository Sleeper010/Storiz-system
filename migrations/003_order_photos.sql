-- Migration 003: Order-scoped photos with position tracking and auto-expiry
-- Run against Supabase SQL Editor or via CLI

-- 1. Create order_photos table
CREATE TABLE IF NOT EXISTS order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_name TEXT,
  original_width INTEGER DEFAULT 0,
  original_height INTEGER DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | committed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_order_photos_order ON order_photos(order_id);
CREATE INDEX IF NOT EXISTS idx_order_photos_album ON order_photos(album_id);
CREATE INDEX IF NOT EXISTS idx_order_photos_expires ON order_photos(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_order_photos_position ON order_photos(order_id, album_id, position);
