const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS untuk browser HP Anda
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

        // Jalur 1: Cek Status Antrean Video
        if (checkStatus && taskId) {
            const statusUrl = `https://api.magnific.ai/v1/tasks/${taskId}`;
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal mengambil status.' });
                }
                
                return res.status(200).json({
                    status: jsonData.status, // pending, processing, completed, failed
                    progress: jsonData.progress || 0,
                    output_video_url: jsonData.result ? (jsonData.result.output || jsonData.result) : null
                });
            } catch (e) {
                return res.status(response.status).json({ error: `Gagal membaca status server (${response.status}).` });
            }
        }

        // Jalur 2: Mengirim Perintah Pembuatan Video Baru (Sesuai standard web contoh)
        const generateUrl = 'https://api.magnific.ai/v1/video/control';
        
        // Buat objek data dengan menyertakan parameter yang benar-benar terisi saja
        const payload = {};
        
        // Memastikan model dikirim dengan format string murni yang valid
        payload.model = model || "kling-v2.6";
        payload.image_url = String(image_url);
        payload.guidance_scale = parseFloat(guidance_scale) || 0.5;

        // Hanya sertakan video referensi jika pengguna mengunggahnya
        if (video_url && video_url.trim() !== "") {
            payload.video_url = String(video_url);
            payload.character_orientation = character_orientation || "video";
        }

        // Hanya sertakan prompt jika ada teks yang ditulis
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
                // Deteksi otomatis jika limit gratisan 5 video dari API Key Anda sudah habis
                if (responseText.includes("limit") || responseText.includes("quota") || response.status === 403) {
                    return res.status(403).json({ error: "Limit kuota API Key baru Anda sudah habis (Maks 5 video). Silakan ganti dengan API Key baru lagi." });
                }
                return res.status(response.status).json({ error: data.detail || 'Permintaan ditolak oleh Magnific.' });
            }
            
            // Kirim ID antrean ke index.html
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            // Menangani jika Magnific melempar proteksi cloudflare/HTML eror akibat limit harian tercapai
            if (response.status === 429 || response.status === 403) {
                return res.status(response.status).json({ error: "Sistem mendeteksi Limit/Kuota API Key Anda sudah habis. Mohon gunakan API Key baru." });
            }
            return res.status(response.status).json({ error: `Respons tidak dikenal (${response.status}). Coba periksa apakah API Key Anda masih aktif.` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
