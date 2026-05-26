CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    destination_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taps (
    id SERIAL PRIMARY KEY,
    card_slug TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    city TEXT,
    country TEXT,
    tapped_at TIMESTAMP DEFAULT NOW()
);