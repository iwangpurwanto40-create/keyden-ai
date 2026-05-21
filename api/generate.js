const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar bisa diakses lancar dari browser HP
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

        // 🌟 ENDPOINT ASLI WAVESPEED UNTUK MODEL KLING
        const WAVESPEED_BASE = 'https://api.wavespeed.ai/v1';

        // ---------------------------------------------------------------------
        // JALUR 1: Cek Status Antrean Video (Polling)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            const response = await fetch(`${WAVESPEED_BASE}/tasks/${taskId}`, {
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
                    return res.status(response.status).json({ error: jsonData.message || 'Wavespeed gagal merespons status.' });
                }
                
                let currentStatus = jsonData.status; 
                let progressPercentage = jsonData.progress || 0;

                if (currentStatus === 'completed' || currentStatus === 'succeeded') {
                    currentStatus = 'completed';
                    progressPercentage = 100;
                } else if (currentStatus === 'failed') {
                    currentStatus = 'failed';
                } else {
                    currentStatus = 'active';
                    if (!progressPercentage) progressPercentage = 40; 
                }

                // Ambil link video hasil render dari objek output Wavespeed
                const videoHasil = jsonData.output_url || 
                                   jsonData.video_url || 
                                   (jsonData.output && jsonData.output.video_url) || null;

                return res.status(200).json({
                    status: currentStatus,
                    progress: progressPercentage,
                    output_video_url: videoHasil
                });
            } catch (e) {
                return res.status(response.status).json({ error: 'Gagal membaca format status Wavespeed.' });
            }
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Daftarkan Video Baru (Kling Image-to-Video / Motion)
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling";

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar terlebih dahulu." });
        }

        // Menyesuaikan format penamaan model Kling di Wavespeed
        let wavespeedModel = "kling-v2.5";
        if (String(rawModel).toLowerCase().includes("2.6")) {
            wavespeedModel = "kling-v2.6";
        }

        // Menyusun data payload root-level untuk dikirim ke Wavespeed
        const wavespeedPayload = {
            model: wavespeedModel,
            prompt: finalPrompt || "Smooth camera movement, high quality, professional production",
            image_url: String(finalImageUrl)
        };

        // Skema deteksi jika user mengunggah video referensi untuk gerakan (Motion Control)
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            wavespeedPayload.motion_video_url = String(finalVideoUrl);
        }

        // Tembak ke endpoint pembuatan task baru milik Wavespeed
        const response = await fetch(`${WAVESPEED_BASE}/videos`, {
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
            
            // Kirim ID antrean balik ke halaman web front-end lu
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Eror Balasan Wavespeed (${response.status}): ${responseText.substring(0, 120)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};
