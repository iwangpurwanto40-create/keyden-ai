const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS terlengkap agar aman diakses dari browser HP
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

        // URL ENDPOINT UTAMA ANTREAN RESMI MAGNIFIC AI
        const TASKS_URL = 'https://api.magnific.ai/v1/tasks';

        // JALUR 1: Mengecek Progress Status Antrean (Polling)
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal memantau status antrean.' });
                }
                return res.status(200).json({
                    status: jsonData.status, 
                    progress: jsonData.progress || 0,
                    output_video_url: jsonData.result ? (jsonData.result.output_video_url || jsonData.result.output || jsonData.result) : null
                });
            } catch (e) {
                return res.status(response.status).json({ error: `Gagal membaca update status (${response.status}).` });
            }
        }

        // JALUR 2: Mendaftarkan Pembuatan Video Baru
        // 🧠 MODE DETEKTIF: Otomatis memilah string link internet dari form front-end Anda
        let detectedImageUrl = null;
        let detectedVideoUrl = null;

        const keys = Object.keys(body);
        for (let key of keys) {
            const value = String(body[key]);
            if (value.startsWith('http://') || value.startsWith('https://')) {
                if (value.match(/\.(mp4|webm|mov|avi)/i) || key.toLowerCase().includes('video')) {
                    detectedVideoUrl = value;
                } else if (value.match(/\.(jpg|jpeg|png|webp|gif)/i) || key.toLowerCase().includes('image') || key.toLowerCase().includes('img')) {
                    detectedImageUrl = value;
                }
            }
        }

        // Ambil link hasil deteksi atau gunakan fallback variabel bawaan
        const finalImageUrl = detectedImageUrl || body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = detectedVideoUrl || body.video_url || body.video || body.videoUrl;
        
        const finalPrompt = body.prompt || body.textPrompt || "";
        const finalModel = body.model || "kling-v2.6";
        const finalGuidance = body.guidance_scale || body.guidance || 0.5;
        const finalOrientation = body.character_orientation || body.orientation || "video";

        if (!finalImageUrl || finalImageUrl.trim() === "") {
            return res.status(400).json({ error: "Backend gagal mendeteksi gambar utama. Pastikan gambar sudah terunggah." });
        }

        // ⚠️ STRUKTUR BARU: Wajib dibungkus di dalam objek 'parameters' agar tidak memicu 404
        const taskParameters = {
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        if (finalVideoUrl && finalVideoUrl.trim() !== "") {
            taskParameters.video_url = String(finalVideoUrl);
            taskParameters.character_orientation = String(finalOrientation);
        }

        if (finalPrompt && finalPrompt.trim() !== "") {
            taskParameters.prompt = String(finalPrompt);
        }

        // Payload utama dengan bungkus parameters yang disukai server Magnific terbaru
        const mainPayload = {
            task_type: "video_control",
            model: String(finalModel),
            parameters: taskParameters
        };

        const response = await fetch(TASKS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(mainPayload)
        });

        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            if (!response.ok) {
                if (response.status === 403 || responseText.includes("limit") || responseText.includes("quota")) {
                    return res.status(403).json({ error: "Limit kuota API Key gratisan Anda sudah habis (Maks 5 video). Silakan ganti ke API Key baru." });
                }
                return res.status(response.status).json({ error: data.detail || 'Akses ditolak oleh pihak Magnific.' });
            }
            
            // Mengembalikan task_id agar front-end index.html bisa mulai melakukan polling progress %
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Eror struktur data (${response.status}). Coba buat API Key baru jika masalah berlanjut.` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
