const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS Terlengkap agar lancar diakses dari browser HP
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

        // 🌟 ENDPOINT CORE UTAMA WAVESPEED
        const BASE_URL = 'https://api.wavespeed.ai/v1/video';

        // ---------------------------------------------------------------------
        // JALUR 1: Memantau Progress Status Video (Polling)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            // Menggunakan rute universal cek status langsung ke id task
            const response = await fetch(`${BASE_URL}/${taskId}`, {
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
                    if (!progressPercentage) progressPercentage = 45; 
                }

                const videoHasil = jsonData.output_video_url || 
                                   jsonData.video_url || 
                                   (jsonData.output && jsonData.output[0]) || null;

                return res.status(200).json({
                    status: currentStatus,
                    progress: progressPercentage,
                    output_video_url: videoHasil
                });
            } catch (e) {
                return res.status(response.status).json({ error: 'Gagal memproses format status Wavespeed.' });
            }
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Mendaftarkan Pembuatan Video Baru
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling-v2.6";

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar terlebih dahulu." });
        }

        // Normalisasi format model Wavespeed yang valid menggunakan tanda minus
        let cleanModel = "kling-v2.6";
        if (String(rawModel).toLowerCase().includes("2.5")) {
            cleanModel = "kling-v2.5";
        }

        // Susunan data flat payload root-level sesuai spesifikasi Wavespeed Core
        const wavespeedPayload = {
            model: cleanModel,
            prompt: finalPrompt || "Smooth professional camera movement, clean aesthetic, highly detailed",
            image_url: String(finalImageUrl)
        };

        // Jika ada video target gerakan (Motion Control)
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            wavespeedPayload.motion_video_url = String(finalVideoUrl);
        }

        // Tembak langsung ke core endpoint pembuatan video
        const response = await fetch(BASE_URL, {
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
                return res.status(response.status).json({ error: data.message || `Wavespeed menolak request: ${responseText}` });
            }
            
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Eror Struktur Endpoint (${response.status}): ${responseText.substring(0, 100)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};
