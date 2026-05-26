import { useEffect, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "https://nfc-tracking-api.onrender.com";

export default function App() {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        const load = async () => {
            try {
                const res = await axios.get(`${API}/api/cards`);
                if (mounted) setCards(res.data);
            } catch (err) {
                console.error(err);
                if (mounted) setError("Failed to load dashboard data");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        load();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <div style={{ padding: 20, fontFamily: "Arial" }}>
            <h1>NFC Analytics Dashboard</h1>

            {loading && <p>Loading...</p>}

            {error && (
                <p style={{ color: "red" }}>
                    {error}
                </p>
            )}

            {!loading && !error && (
                <table border="1" cellPadding="10">
                    <thead>
                        <tr>
                            <th>Slug</th>
                            <th>Destination</th>
                            <th>Total Taps</th>
                            <th>Unique Visitors</th>
                        </tr>
                    </thead>

                    <tbody>
                        {cards.map((c) => (
                            <tr key={c.slug}>
                                <td>{c.slug}</td>
                                <td>
                                    <a
                                        href={c.destination_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {c.destination_url}
                                    </a>
                                </td>
                                <td>{c.total_taps}</td>
                                <td>{c.unique_visitors}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
