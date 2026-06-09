CREATE TABLE fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT DEFAULT 'other',
  quantity TEXT,
  expiry_date DATE NOT NULL,
  price NUMERIC(10,2) DEFAULT 0,
  icon TEXT DEFAULT '📦',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  category TEXT DEFAULT '🛒',
  created_at TIMESTAMPTZ DEFAULT now()
);