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
            return res.status(400).json({ error: 'API Key wajib diisi!' });
        }

        // URL ENDPOINT RESMI UNIVERSAL UNTUK UTILITY TASKS MAGNIFIC AI
        const TASKS_URL = 'https://api.magnific.ai/v1/tasks';

        // JALUR 1: Pengecekan status antrean video (Polling)
        if (checkStatus && taskId) {
            const statusUrl = `${TASKS_URL}/${taskId}`;
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
                
                // Menyamakan format output agar terbaca oleh index.html Anda
                return res.status(200).json({
                    status: jsonData.status, // pending, processing, completed, failed
                    progress: jsonData.progress || 0,
                    output_video_url: jsonData.result ? (jsonData.result.output_video_url || jsonData.result.output || jsonData.result) : null
                });
            } catch (e) {
                return res.status(response.status).json({ error: `Gagal membaca update status (${response.status}).` });
            }
        }

        // JALUR 2: Membuat antrean generator video baru (Sesuai standard web contoh)
        // Membungkus parameter ke dalam objek khusus 'parameters' sesuai regulasi Magnific Task API
        const videoParameters = {
            image_url: String(image_url),
            guidance_scale: parseFloat(guidance_scale) || 0.5
        };

        // Masukkan video_url hanya jika user mengunggah video referensi gaul-geolnya
        if (video_url && video_url.trim() !== "") {
            videoParameters.video_url = String(video_url);
            videoParameters.character_orientation = character_orientation || "video";
        }

        // Masukkan prompt hanya jika kolom teks diisi
        if (prompt && prompt.trim() !== "") {
            videoParameters.prompt = String(prompt);
        }

        // Payload utama untuk mendaftarkan tugas pengerjaan video AI
        const payload = {
            task_type: "video_control", 
            model: model || "kling-v2.6",
            parameters: videoParameters
        };

        const response = await fetch(TASKS_URL, {
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
                return res.status(response.status).json({ error: data.detail || 'Permintaan ditolak oleh server Magnific.' });
            }
            
            // Mengirim ID Antrean Tugas yang sukses dibuat balik ke frontend index.html
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            if (response.status === 404) {
                return res.status(404).json({ error: "Endpoint /v1/tasks mengalami gangguan pada server Magnific. Coba beberapa saat lagi." });
            }
            return res.status(response.status).json({ error: `Respons tidak dikenal dari server luar (${response.status}).` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
