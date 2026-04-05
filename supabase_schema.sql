-- 1. Create destinations table
CREATE TABLE IF NOT EXISTS destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,            -- e.g. "Argentina 1", "Paris 2"
  variant INTEGER DEFAULT 1,     -- design variant number
  cover_front_url TEXT NOT NULL,  -- front cover image/PDF
  cover_back_url TEXT,            -- back cover image/PDF
  bg_color TEXT,                  -- extracted hex color for spine generation
  font_color TEXT,                -- text color from cover (for spine text)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create orders table for internal tracking (Optional but recommended)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_order_id TEXT UNIQUE,
  order_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS (Optional, since we're using service_role for this private internal tool)
-- ALTER TABLE destinations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
