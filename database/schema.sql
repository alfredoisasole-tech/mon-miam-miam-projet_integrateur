-- Schéma initial de Mon Miam Miam. Montants en FC, dates ISO 8601 UTC.
PRAGMA foreign_keys = ON;

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  logo_asset_id TEXT REFERENCES assets(id),
  primary_color TEXT NOT NULL DEFAULT '#cfbd97',
  secondary_color TEXT NOT NULL DEFAULT '#000000',
  font_family TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Africa/Kinshasa',
  created_at TEXT NOT NULL,
  default_mode TEXT NOT NULL DEFAULT 'light',
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE restaurant_settings (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  spend_per_point_fc INTEGER NOT NULL DEFAULT 3000,
  points_per_meal INTEGER NOT NULL DEFAULT 15,
  free_meal_cap_fc INTEGER NOT NULL DEFAULT 3000,
  points_validity_months INTEGER NOT NULL DEFAULT 12,
  delivery_enabled INTEGER NOT NULL DEFAULT 1,
  delivery_fee_fc INTEGER NOT NULL DEFAULT 0,
  delivery_communes TEXT NOT NULL DEFAULT '[]',
  opening_hours TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  commune TEXT,
  quartier TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  must_change_password INTEGER NOT NULL DEFAULT 0,
  referral_code TEXT,
  referred_by TEXT REFERENCES users(id),
  accepted_terms_at TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  loyalty_remainder_fc INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE TABLE platform_admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  description TEXT,
  price_fc INTEGER NOT NULL,
  category TEXT NOT NULL,
  is_available INTEGER NOT NULL DEFAULT 1,
  is_daily INTEGER NOT NULL DEFAULT 0,
  image_asset_id TEXT REFERENCES assets(id),
  position INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  kind TEXT NOT NULL,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_asset_id TEXT REFERENCES assets(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_number TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  subtotal_fc INTEGER NOT NULL,
  discount_fc INTEGER NOT NULL,
  delivery_fee_fc INTEGER NOT NULL,
  total_fc INTEGER NOT NULL,
  points_redeemed INTEGER NOT NULL DEFAULT 0,
  points_earned INTEGER NOT NULL DEFAULT 0,
  arrival_time TEXT,
  delivery_commune TEXT,
  delivery_quartier TEXT,
  delivery_address TEXT,
  delivery_landmark TEXT,
  delivery_phone TEXT,
  note TEXT,
  idempotency_key TEXT,
  comment TEXT,
  rating INTEGER,
  commented_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price_fc INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_fc INTEGER NOT NULL
);

CREATE TABLE order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  operator TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount_fc INTEGER NOT NULL,
  status TEXT NOT NULL,
  provider_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE points_ledger (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  points INTEGER NOT NULL,
  remaining INTEGER,
  expires_at TEXT,
  order_id TEXT REFERENCES orders(id),
  referral_id TEXT REFERENCES referrals(id),
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE referrals (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  referrer_id TEXT NOT NULL REFERENCES users(id),
  referee_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  reward_points INTEGER NOT NULL DEFAULT 0,
  rewarded_order_id TEXT REFERENCES orders(id),
  created_at TEXT NOT NULL,
  rewarded_at TEXT
);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  requested_points INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  proposed_decision TEXT,
  proposed_response TEXT,
  proposed_by TEXT REFERENCES users(id),
  decision TEXT,
  response TEXT,
  resolved_by TEXT REFERENCES users(id),
  manager_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_restaurant_role ON users (restaurant_id, role);
CREATE INDEX idx_memberships_restaurant ON memberships (restaurant_id);
CREATE INDEX idx_menu_restaurant ON menu_items (restaurant_id, deleted_at);
CREATE INDEX idx_orders_restaurant_status ON orders (restaurant_id, status, created_at);
CREATE INDEX idx_orders_user ON orders (user_id, created_at);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_events_order ON order_events (order_id, created_at);
CREATE INDEX idx_payments_order ON payments (order_id);
CREATE INDEX idx_ledger_user ON points_ledger (user_id, created_at);
CREATE INDEX idx_referrals_referrer ON referrals (referrer_id);
CREATE INDEX idx_claims_restaurant_status ON claims (restaurant_id, status);
