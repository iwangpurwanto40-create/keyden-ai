const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar tidak diblokir browser HP
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method tidak diizinkan' });
    }

    try {
        const { apiKey, taskId, checkStatus, model, prompt, image_url, video_url, guidance_scale, character_orientation } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key Magnific wajib diisi!' });
        }

        // JALUR 1: Pengecekan Status Antrean Video
        if (checkStatus && taskId) {
            const statusUrl = `https://api.magnific.ai/v1/video/control/${taskId}`;
            const response = await fetch(statusUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const textData = await response.text();
            try {
                const jsonData = JSON.parse(textData);
                if (!response.ok) {
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal mengecek status antrean.' });
                }
                return res.status(200).json(jsonData);
            } catch (e) {
                return res.status(response.status).json({ error: `Server Magnific sibuk/down (${response.status}). Coba beberapa saat lagi.` });
            }
        }

        // JALUR 2: Pembuatan Video Baru (Generate)
        const generateUrl = 'https://api.magnific.ai/v1/video/control';
        
        // Memastikan parameter berbentuk tipe data yang sangat disukai API Magnific
        const payload = {
            model: model || 'kling-v2.6',
            image_url: String(image_url),
            guidance_scale: parseFloat(guidance_scale) || 0.5
        };

        // Hanya masukkan video_url jika user mengunggah video referensi
        if (video_url && video_url.trim() !== "") {
            payload.video_url = String(video_url);
            // Beberapa endpoint Magnific mewajibkan character_orientation dikirim jika ada video_url
            payload.character_orientation = character_orientation || 'video';
        }
        
        // Hanya masukkan prompt jika diisi teks oleh user
        if (prompt && prompt.trim() !== "") {
            payload.prompt = String(prompt);
        }

        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            if (!response.ok) {
                const errMsg = data.detail || (data.error ? data.error.message : 'Ditolak oleh server Magnific.');
                return res.status(response.status).json({ error: errMsg });
            }
            return res.status(200).json(data);
        } catch (jsonEror) {
            // Mengatasi jika Magnific membalas dalam bentuk teks html eror cloudflare/server crash
            if (responseText.includes("limit") || responseText.includes("trial")) {
                return res.status(403).json({ error: "Sisa kuota API Key Magnific Anda habis / harus upgrade akun premium." });
            }
            return res.status(response.status).json({ error: `Eror Struktur API Magnific (${response.status}). Pastikan API Key Anda aktif dan memiliki kredit.` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
