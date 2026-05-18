const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar tidak diblokir oleh browser HP
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
        // Membaca kiriman request body
        const body = req.body || {};
        const apiKey = body.apiKey;
        const taskId = body.taskId;
        const checkStatus = body.checkStatus;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key wajib diisi!' });
        }

        // JALUR 1: Pengecekan Status Antrean Video (Polling)
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
                    status: jsonData.status,
                    progress: jsonData.progress || 0,
                    output_video_url: jsonData.result ? (jsonData.result.output || jsonData.result) : null
                });
            } catch (e) {
                return res.status(response.status).json({ error: `Gagal membaca status (${response.status}).` });
            }
        }

        // JALUR 2: Pembuatan Video Baru (Generate)
        const generateUrl = 'https://api.magnific.ai/v1/video/control';
        
        // SISTEM DETEKSI OTOMATIS: Membaca variasi nama variabel dari front-end Anda
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || body.textPrompt || "";
        const finalModel = body.model || "kling-v2.6";
        const finalGuidance = body.guidance_scale || body.guidance || 0.5;
        const finalOrientation = body.character_orientation || body.orientation || "video";

        // Validasi input gambar utama
        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gagal memproses: Gambar referensi utama tidak terdeteksi oleh backend. Periksa upload Anda." });
        }

        // Menyusun payload bersih murni untuk Magnific
        const payload = {
            model: String(finalModel),
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        // Hanya masukkan video jika front-end mengirimkan file video gaul-geol
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            payload.video_url = String(finalVideoUrl);
            payload.character_orientation = String(finalOrientation);
        }

        // Hanya masukkan prompt jika ada teks tertulis
        if (finalPrompt && String(finalPrompt).trim() !== "") {
            payload.prompt = String(finalPrompt);
        }

        // Mengirim data ke Magnific AI
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
                if (response.status === 403 || responseText.includes("limit") || responseText.includes("quota")) {
                    return res.status(403).json({ error: "Limit kuota API Key gratisan Anda sudah habis (Maks 5 video). Silakan ganti ke API Key baru." });
                }
                return res.status(response.status).json({ error: data.detail || 'Permintaan ditolak oleh Magnific.' });
            }
            
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            if (response.status === 404) {
                return res.status(404).json({ error: "Eror 404: Link gambar/video gagal dikirim atau format data front-end Anda tidak cocok dengan back-end." });
            }
            return res.status(response.status).json({ error: `Respons tidak dikenal (${response.status}).` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
