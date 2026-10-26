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
  default_mode TEXT NOT NULL DEFAULT 'light' CHECK (default_mode IN ('light', 'dark', 'system')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE (slug)
);

CREATE TABLE restaurant_settings (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  spend_per_point_fc INTEGER NOT NULL DEFAULT 3000 CHECK (spend_per_point_fc > 0),
  points_per_meal INTEGER NOT NULL DEFAULT 15 CHECK (points_per_meal > 0),
  free_meal_cap_fc INTEGER NOT NULL DEFAULT 3000 CHECK (free_meal_cap_fc >= 0),
  points_validity_months INTEGER NOT NULL DEFAULT 12 CHECK (points_validity_months > 0),
  delivery_enabled INTEGER NOT NULL DEFAULT 1 CHECK (delivery_enabled IN (0, 1)),
  delivery_fee_fc INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_fc >= 0),
  delivery_communes TEXT NOT NULL DEFAULT '[]',
  opening_hours TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  role TEXT NOT NULL CHECK (role IN ('student', 'employee', 'manager', 'admin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  commune TEXT,
  quartier TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deleted')),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  referral_code TEXT UNIQUE,
  referred_by TEXT REFERENCES users(id),
  accepted_terms_at TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  UNIQUE (phone)
);
CREATE UNIQUE INDEX idx_users_email_global ON users (lower(email));

CREATE TABLE memberships (
  user_id TEXT NOT NULL REFERENCES users(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  loyalty_remainder_fc INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_remainder_fc >= 0),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, restaurant_id)
);

CREATE TABLE platform_admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  description TEXT,
  price_fc INTEGER NOT NULL CHECK (price_fc >= 0),
  category TEXT NOT NULL CHECK (category IN ('plat', 'boisson', 'dessert', 'snack')),
  is_available INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  is_daily INTEGER NOT NULL DEFAULT 0 CHECK (is_daily IN (0, 1)),
  image_asset_id TEXT REFERENCES assets(id),
  position INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'poster', 'menu')),
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  size INTEGER NOT NULL CHECK (size >= 0),
  created_at TEXT NOT NULL
);

CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  kind TEXT NOT NULL CHECK (kind IN ('promotion', 'event', 'game')),
  title TEXT NOT NULL,
  description TEXT,
  image_asset_id TEXT REFERENCES assets(id),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dine_in', 'delivery')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'mobile_money')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refund_due')),
  subtotal_fc INTEGER NOT NULL CHECK (subtotal_fc >= 0),
  discount_fc INTEGER NOT NULL CHECK (discount_fc >= 0),
  delivery_fee_fc INTEGER NOT NULL CHECK (delivery_fee_fc >= 0),
  total_fc INTEGER NOT NULL CHECK (total_fc >= 0),
  points_redeemed INTEGER NOT NULL DEFAULT 0 CHECK (points_redeemed >= 0),
  points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  arrival_time TEXT,
  delivery_commune TEXT,
  delivery_quartier TEXT,
  delivery_address TEXT,
  delivery_landmark TEXT,
  delivery_phone TEXT,
  note TEXT,
  idempotency_key TEXT,
  comment TEXT,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  commented_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT,
  UNIQUE (restaurant_id, order_number),
  UNIQUE (user_id, idempotency_key)
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit_price_fc INTEGER NOT NULL CHECK (unit_price_fc >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total_fc INTEGER NOT NULL CHECK (line_total_fc >= 0)
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
  operator TEXT NOT NULL CHECK (operator IN ('mpesa', 'orange_money', 'airtel_money', 'africell_money')),
  phone TEXT NOT NULL,
  amount_fc INTEGER NOT NULL CHECK (amount_fc > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed')),
  provider_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE points_ledger (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('earn', 'referral', 'redeem', 'expire', 'adjust', 'refund')),
  points INTEGER NOT NULL CHECK (points <> 0),
  remaining INTEGER CHECK (remaining IS NULL OR remaining >= 0),
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
  referee_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded')),
  reward_points INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  rewarded_order_id TEXT REFERENCES orders(id),
  created_at TEXT NOT NULL,
  rewarded_at TEXT
);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('order', 'points', 'other')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  requested_points INTEGER CHECK (requested_points IS NULL OR requested_points > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending_validation', 'resolved')),
  proposed_decision TEXT CHECK (proposed_decision IS NULL OR proposed_decision IN ('accept', 'refuse')),
  proposed_response TEXT,
  proposed_by TEXT REFERENCES users(id),
  decision TEXT CHECK (decision IS NULL OR decision IN ('accept', 'refuse')),
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
  token_hash TEXT NOT NULL UNIQUE,
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
