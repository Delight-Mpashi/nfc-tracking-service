require("dotenv").config();
const express = require("express");
const axios = require("axios");
const db = require("./db");

const app = express();
app.use(express.json());

/**
 * HEALTH CHECK
 */
app.get("/", (req, res) => {
    res.send("NFC Tracking Service Running ");
});

/**
 * TRACKING ENDPOINT
 * NFC hits this URL
 */
app.get("/t/:slug", async (req, res) => {
    const slug = req.params.slug;

    try {
        // 1. Get card from DB
        const cardResult = await db.query(
            "SELECT * FROM cards WHERE slug = $1",
            [slug]
        );

        if (cardResult.rows.length === 0) {
            return res.status(404).send("Card not found");
        }

        const card = cardResult.rows[0];

        // 2. Get user IP
        const ip =
            req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress ||
            null;

        // 3. Get geolocation (optional but useful)
        let city = null;
        let country = null;

        try {
            const geo = await axios.get(`https://ipapi.co/${ip}/json/`);

            city = geo.data.city;
            country = geo.data.country_name;

        } catch (err) {
            console.log("Geo lookup failed");
        }

        // 4. Log tap event
        await db.query(
            `INSERT INTO taps 
            (card_slug, ip_address, user_agent, city, country)
            VALUES ($1, $2, $3, $4, $5)`,
            [
                slug,
                ip,
                req.headers["user-agent"],
                city,
                country
            ]
        );

        // 5. Redirect to actual card
        return res.redirect(card.destination_url);

    } catch (error) {
        console.error("Tracking error:", error);
        return res.status(500).send("Server error");
    }
});

/**
 * OPTIONAL: create card endpoint (for testing)
 */
app.post("/cards", async (req, res) => {
    const { slug, destination_url } = req.body;

    try {
        await db.query(
            `INSERT INTO cards (slug, destination_url)
             VALUES ($1, $2)`,
            [slug, destination_url]
        );

        res.json({ message: "Card created" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * OPTIONAL: basic stats endpoint
 */
app.get("/stats/:slug", async (req, res) => {
    const slug = req.params.slug;

    const result = await db.query(
        `SELECT 
            COUNT(*) as total_taps,
            COUNT(DISTINCT ip_address) as unique_visitors
         FROM taps
         WHERE card_slug = $1`,
        [slug]
    );

    res.json(result.rows[0]);
});

// Additions
app.get("/api/cards", async (req, res) => {
    const result = await db.query(`
        SELECT 
            c.slug,
            c.destination_url,
            COUNT(t.id) AS total_taps,
            COUNT(DISTINCT t.ip_address) AS unique_visitors
        FROM cards c
        LEFT JOIN taps t ON c.slug = t.card_slug
        GROUP BY c.slug, c.destination_url
        ORDER BY total_taps DESC;
    `);

    res.json(result.rows);
});

app.get("/api/cards/:slug", async (req, res) => {
    const slug = req.params.slug;

    const stats = await db.query(`
        SELECT 
            COUNT(*) AS total_taps,
            COUNT(DISTINCT ip_address) AS unique_visitors
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
        SELECT city, country, COUNT(*) as count
        FROM taps
        WHERE card_slug = $1
        GROUP BY city, country
        ORDER BY count DESC;
    `, [slug]);

    res.json({
        stats: stats.rows[0],
        recent: recent.rows,
        locations: locations.rows
    });
});




const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});