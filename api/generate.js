const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS untuk akses browser HP
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
            return res.status(400).json({ error: 'API Key wajib diisi!' });
        }

        // RUTE ALTERNATIF: Menggunakan rute root v1/worker untuk deteksi tugas
        const BASE_URL = 'https://api.magnific.ai/v1';

        // JALUR 1: Jika sistem sedang mengecek status antrean video
        if (checkStatus && taskId) {
            const statusUrl = `${BASE_URL}/tasks/${taskId}`;
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal mengambil status antrean.' });
                }
                return res.status(200).json(jsonData);
            } catch (e) {
                return res.status(response.status).json({ error: `Server Magnific merespons dengan status ${response.status}.` });
            }
        }

        // JALUR 2: Mengirim perintah pembuatan video baru (Generate)
        // Menggunakan endpoint /v1/video untuk pembuatan control video langsung
        const generateUrl = `${BASE_URL}/video`;
        
        const payload = {
            model: model || 'kling-v2.6',
            image_url: String(image_url),
            guidance_scale: parseFloat(guidance_scale) || 0.5
        };

        // Memasukkan input video jika ada referensi video yang berhasil diunggah
        if (video_url && video_url.trim() !== "") {
            payload.video_url = String(video_url);
            payload.character_orientation = character_orientation || 'video';
        }
        
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
                if (response.status === 401) {
                    return res.status(401).json({ error: "API Key salah atau tidak valid. Periksa kembali key Anda." });
                }
                const errMsg = data.detail || (data.error ? data.error.message : 'Ditolak oleh server Magnific.');
                return res.status(response.status).json({ error: errMsg });
            }
            return res.status(200).json(data);
        } catch (jsonEror) {
            if (response.status === 404) {
                // Skema fallback jika endpoint /video langsung juga memberikan respons 404
                return res.status(404).json({ error: "Rute API Magnific tidak merespons (404). Pastikan langganan API Key Anda mengizinkan akses ke model video." });
            }
            return res.status(response.status).json({ error: `Gagal memproses data server Magnific (${response.status}).` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
