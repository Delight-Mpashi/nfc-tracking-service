require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const db = require("./db");

const app = express();

/**
 * CORS CONFIG
 */
const configuredOrigins = (process.env.CORS_ORIGINS || process.env.DASHBOARD_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = [
    "http://localhost:5173",
    "https://nfc-tracking-service-1.onrender.com",
    ...configuredOrigins
];

const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

/**
 * REQUEST LOGGER
 */
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

/**
 * INITIALIZE DATABASE TABLES
 */
async function initializeDatabase() {
    try {

        await db.query(`
            CREATE TABLE IF NOT EXISTS cards (
                id SERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                destination_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS taps (
                id SERIAL PRIMARY KEY,
                card_slug TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                city TEXT,
                country TEXT,
                tapped_at TIMESTAMP DEFAULT NOW()
            );
        `);

        console.log("Database initialized");

    } catch (err) {
        console.error("Database initialization failed:", err);
    }
}

/**
 * HEALTH CHECK
 */
app.get("/", (req, res) => {
    res.status(200).send("NFC Tracking Service Running 🚀");
});

/**
 * TRACKING ENDPOINT
 * NFC hits this URL
 */
app.get("/t/:slug", async (req, res) => {

    try {

        const slug = req.params.slug;

        // 1. Find card
        const cardResult = await db.query(
            "SELECT * FROM cards WHERE slug = $1",
            [slug]
        );

        if (cardResult.rows.length === 0) {
            return res.status(404).json({
                error: "Card not found"
            });
        }

        const card = cardResult.rows[0];

        // 2. Get IP
        const forwarded = req.headers["x-forwarded-for"];

        const ip = forwarded
            ? forwarded.split(",")[0]
            : req.socket.remoteAddress;

        // 3. Geo lookup
        let city = null;
        let country = null;

        try {

            const geo = await axios.get(
                `https://ipapi.co/${ip}/json/`
            );

            city = geo.data.city || null;
            country = geo.data.country_name || null;

        } catch (geoError) {
            console.log("Geo lookup failed");
        }

        // 4. Save tap
        await db.query(
            `
            INSERT INTO taps
            (
                card_slug,
                ip_address,
                user_agent,
                city,
                country
            )
            VALUES ($1, $2, $3, $4, $5)
            `,
            [
                slug,
                ip,
                req.headers["user-agent"],
                city,
                country
            ]
        );

        // 5. Redirect
        return res.redirect(card.destination_url);

    } catch (error) {

        console.error("Tracking error:", error);

        return res.status(500).json({
            error: "Internal server error"
        });
    }
});

/**
 * CREATE CARD
 */
app.post("/cards", async (req, res) => {

    try {

        const { slug, destination_url } = req.body;

        if (!slug || !destination_url) {
            return res.status(400).json({
                error: "slug and destination_url are required"
            });
        }

        await db.query(
            `
            INSERT INTO cards
            (slug, destination_url)
            VALUES ($1, $2)
            `,
            [slug, destination_url]
        );

        return res.status(201).json({
            message: "Card created successfully"
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: err.message
        });
    }
});

/**
 * BASIC STATS
 */
app.get("/stats/:slug", async (req, res) => {

    try {

        const slug = req.params.slug;

        const result = await db.query(
            `
            SELECT 
                COUNT(*) AS total_taps,
                COUNT(DISTINCT ip_address) AS unique_visitors
            FROM taps
            WHERE card_slug = $1
            `,
            [slug]
        );

        return res.json(result.rows[0]);

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Failed to fetch stats"
        });
    }
});

/**
 * GET ALL CARDS
 */
app.get("/api/cards", async (req, res) => {

    try {

        const result = await db.query(`
            SELECT 
                c.slug,
                c.destination_url,
                COUNT(t.id)::INTEGER AS total_taps,
                COUNT(DISTINCT t.ip_address)::INTEGER AS unique_visitors
            FROM cards c
            LEFT JOIN taps t
                ON c.slug = t.card_slug
            GROUP BY c.slug, c.destination_url
            ORDER BY total_taps DESC;
        `);

        return res.json(result.rows);

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Failed to fetch cards"
        });
    }
});

/**
 * SINGLE CARD ANALYTICS
 */
app.get("/api/cards/:slug", async (req, res) => {

    try {

        const slug = req.params.slug;

        const stats = await db.query(`
            SELECT 
                COUNT(*)::INTEGER AS total_taps,
                COUNT(DISTINCT ip_address)::INTEGER AS unique_visitors
            FROM taps
            WHERE card_slug = $1;
        `, [slug]);

        const recent = await db.query(`
            SELECT *
            FROM taps
            WHERE card_slug = $1
            ORDER BY tapped_at DESC
            LIMIT 20;
        `, [slug]);

        const locations = await db.query(`
            SELECT 
                city,
                country,
                COUNT(*)::INTEGER AS count
            FROM taps
            WHERE card_slug = $1
            GROUP BY city, country
            ORDER BY count DESC;
        `, [slug]);

        return res.json({
            stats: stats.rows[0],
            recent: recent.rows,
            locations: locations.rows
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Failed to fetch analytics"
        });
    }
});

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;

initializeDatabase().then(() => {

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });

});
