CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  base_currency VARCHAR(10) DEFAULT 'BDT',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id INTEGER REFERENCES groups(id),
  user_id INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id),
  paid_by INTEGER REFERENCES users(id),
  description VARCHAR(255),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  amount_in_base_currency NUMERIC(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE expense_splits (
  expense_id INTEGER REFERENCES expenses(id),
  user_id INTEGER REFERENCES users(id),
  share_amount NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (expense_id, user_id)
);