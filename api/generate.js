const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar aman diakses dari browser HP
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

        // ---------------------------------------------------------------------
        // JALUR 1: Memantau Progress Status Video (Polling)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            // Cek status antrean video menggunakan endpoint tasks tracking
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal memantau status antrean.' });
                }
                
                let videoHasil = null;
                if (jsonData.result) {
                    videoHasil = jsonData.result.output_video_url || jsonData.result.output || jsonData.result;
                }

                return res.status(200).json({
                    status: jsonData.status, 
                    progress: jsonData.progress || 0,
                    output_video_url: videoHasil
                });
            } catch (e) {
                return res.status(response.status).json({ error: 'Gagal membaca update status antrean.' });
            }
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Mendaftarkan Pembuatan Video Baru (Sesuai Endpoint Resmi)
        // ---------------------------------------------------------------------
        // Endpoint khusus untuk Video Control / Image-to-Video Magnific
        const VIDEO_CONTROL_URL = 'https://api.magnific.ai/v1/video/control';

        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling_v2_6";
        const finalGuidance = body.guidance_scale || 0.5;
        const finalOrientation = body.character_orientation || "video";

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar referensi terlebih dahulu." });
        }

        // Normalisasi format string nama model untuk Magnific
        let cleanModel = "kling_v2_6"; 
        const modelText = String(rawModel).toLowerCase();

        if (modelText.includes("kling") && modelText.includes("2.6")) {
            cleanModel = "kling_v2_6";
        } else if (modelText.includes("kling") && modelText.includes("2.5")) {
            cleanModel = "kling_v2_5";
        } else if (modelText.includes("luma")) {
            cleanModel = "luma_ray_v2";
        } else if (modelText.includes("runway") || modelText.includes("gen3")) {
            cleanModel = "runway_gen3";
        } else {
            cleanModel = String(rawModel).trim().replace(/-/g, '_');
        }

        // Susun payload langsung murni ke root objek sesuai spesifikasi endpoint /video/control
        const mainPayload = {
            model: cleanModel,
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        // Jika ada video referensi tambahan
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            mainPayload.video_url = String(finalVideoUrl);
            mainPayload.character_orientation = String(finalOrientation);
        }

        // Jika ada prompt teks
        if (finalPrompt && String(finalPrompt).trim() !== "") {
            mainPayload.prompt = String(finalPrompt);
        }

        // Kirim request langsung ke endpoint video control
        const response = await fetch(VIDEO_CONTROL_URL, {
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
                return res.status(response.status).json({ error: data.detail || `Magnific menolak: ${responseText}` });
            }
            
            // Mengembalikan ID task agar front-end bisa mulai menghitung progress %
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Gagal memproses struktur data Magnific (${response.status}).` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
