const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar aman diakses dari browser HP tanpa hambatan
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

        // 🌟 ENDPOINT RESMI WAVESPEED.AI
        const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/v1/video/generations';

        // ---------------------------------------------------------------------
        // JALUR 1: Polling Status Perkembangan Video
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            const statusUrl = `${WAVESPEED_BASE_URL}/${taskId}`;
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
                    return res.status(response.status).json({ error: jsonData.message || 'Wavespeed gagal memperbarui status.' });
                }
                
                // Pemetaan status Wavespeed (biasanya: queued, processing, completed, failed)
                let currentStatus = jsonData.status;
                let progressPercentage = 0;

                if (currentStatus === 'completed' || currentStatus === 'succeeded') {
                    currentStatus = 'completed';
                    progressPercentage = 100;
                } else if (currentStatus === 'failed') {
                    currentStatus = 'failed';
                } else {
                    currentStatus = 'active'; // Menyesuaikan dengan UI front-end lu
                    progressPercentage = jsonData.progress || 45; // Default progress visual
                }

                // Mengambil link video hasil render
                const videoHasil = jsonData.output_video_url || (jsonData.output && jsonData.output[0]) || null;

                return res.status(200).json({
                    status: currentStatus,
                    progress: progressPercentage,
                    output_video_url: videoHasil
                });
            } catch (e) {
                return res.status(response.status).json({ error: 'Gagal memproses data update dari Wavespeed.' });
            }
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Membuat Task Video Baru (Image-to-Video / Motion Control)
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling-v2.6";
        const finalGuidance = body.guidance_scale || 0.5;

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar referensi utama kosong. Silakan unggah terlebih dahulu." });
        }

        // Normalisasi nama model agar sesuai dengan standar API Wavespeed
        let wavespeedModel = "kling-v2.6";
        const modelText = String(rawModel).toLowerCase();

        if (modelText.includes("kling") && modelText.includes("2.6")) {
            wavespeedModel = "kling-v2.6";
        } else if (modelText.includes("kling") && modelText.includes("2.5")) {
            wavespeedModel = "kling-v2.5";
        } else if (modelText.includes("luma")) {
            wavespeedModel = "luma-ray-v2";
        } else {
            wavespeedModel = String(rawModel).trim().replace(/_/g, '.');
        }

        // Susun payload sesuai dokumentasi payload root level milik Wavespeed.ai
        const wavespeedPayload = {
            model: wavespeedModel,
            prompt: finalPrompt || "Smooth professional camera movement, high quality",
            image_url: String(finalImageUrl),
            cfg_scale: parseFloat(finalGuidance) * 20 || 5.0 // Skala CFG Wavespeed biasanya berbasis 1-100
        };

        // Jika ada video referensi untuk motion control / character orientation
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            wavespeedPayload.motion_video_url = String(finalVideoUrl);
            wavespeedPayload.mode = "motion_control";
        } else {
            wavespeedPayload.mode = "image_to_video";
        }

        // Kirim perintah ke Wavespeed API
        const response = await fetch(WAVESPEED_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(wavespeedPayload)
        });

        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            if (!response.ok) {
                return res.status(response.status).json({ error: data.message || `Wavespeed menolak: ${responseText}` });
            }
            
            // Kirim ID antrean Wavespeed ke front-end halaman web lu
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Respons non-JSON dari Wavespeed (${response.status}): ${responseText.substring(0, 100)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
