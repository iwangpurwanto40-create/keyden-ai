const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS biar browser HP Anda bebas akses
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
        const body = req.body || {};
        const apiKey = body.apiKey;
        const taskId = body.taskId;
        const checkStatus = body.checkStatus;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key wajib diisi!' });
        }

        // JALUR 1: Cek Status Antrean (Polling)
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

        // 🧠 MODE DETEKTIF: Cari otomatis string URL gambar dan video di dalam request body
        let detectedImageUrl = null;
        let detectedVideoUrl = null;

        // Ambil semua kunci variabel yang dikirim oleh front-end
        const keys = Object.keys(body);
        for (let key of keys) {
            const value = String(body[key]);
            // Jika isi variabel berupa link internet (http:// atau https://)
            if (value.startsWith('http://') || value.startsWith('https://')) {
                // Deteksi jika itu video
                if (value.match(/\.(mp4|webm|mov|avi)/i) || key.toLowerCase().includes('video')) {
                    detectedVideoUrl = value;
                } 
                // Deteksi jika itu gambar
                else if (value.match(/\.(jpg|jpeg|png|webp|gif)/i) || key.toLowerCase().includes('image') || key.toLowerCase().includes('img')) {
                    detectedImageUrl = value;
                }
            }
        }

        // Jika pencarian otomatis gagal, gunakan fallback manual dari nama variabel standar
        const finalImageUrl = detectedImageUrl || body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = detectedVideoUrl || body.video_url || body.video || body.videoUrl;
        
        const finalPrompt = body.prompt || body.textPrompt || "";
        const finalModel = body.model || "kling-v2.6";
        const finalGuidance = body.guidance_scale || body.guidance || 0.5;
        const finalOrientation = body.character_orientation || body.orientation || "video";

        // Validasi Akhir Gambar Utama
        if (!finalImageUrl || finalImageUrl.trim() === "") {
            return res.status(400).json({ 
                error: "Backend Gagal Mendeteksi Gambar! Front-end Anda mengirimkan data ini: " + JSON.stringify(body) 
            });
        }

        // Susun payload resmi untuk Magnific AI
        const payload = {
            model: String(finalModel),
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        // Masukkan video jika ditemukan
        if (finalVideoUrl && finalVideoUrl.trim() !== "") {
            payload.video_url = String(finalVideoUrl);
            payload.character_orientation = String(finalOrientation);
        }

        // Masukkan prompt jika ada isinya
        if (finalPrompt && finalPrompt.trim() !== "") {
            payload.prompt = String(finalPrompt);
        }

        // Kirim data ke Magnific AI
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
                return res.status(404).json({ error: "Eror 404 Magnific: Endpoint tujuan salah atau tidak merespons perintah video." });
            }
            return res.status(response.status).json({ error: `Respons tidak dikenal (${response.status}).` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
