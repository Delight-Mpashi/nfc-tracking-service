import { useEffect, useState } from "react";
import axios from "axios";

const API = "https://your-tracking-service.onrender.com";

export default function App() {
    const [cards, setCards] = useState([]);

    useEffect(() => {
        fetchCards();
    }, []);

    const fetchCards = async () => {
        const res = await axios.get(`${API}/api/cards`);
        setCards(res.data);
    };

    return (
        <div style={{ padding: 20, fontFamily: "Arial" }}>
            <h1>NFC Analytics Dashboard</h1>

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
                            <td>{c.destination_url}</td>
                            <td>{c.total_taps}</td>
                            <td>{c.unique_visitors}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}