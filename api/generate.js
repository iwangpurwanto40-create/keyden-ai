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

        // 🌟 ENDPOINT RESMI WAVESPEED (Menggunakan rute /v1/tasks)
        const WAVESPEED_TASKS_URL = 'https://api.wavespeed.ai/v1/tasks';

        // ---------------------------------------------------------------------
        // JALUR 1: Memantau Progress Status Video (Polling)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            const statusUrl = `${WAVESPEED_TASKS_URL}/${taskId}`;
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
                
                let currentStatus = jsonData.status; // 'queued', 'processing', 'completed', 'failed'
                let progressPercentage = jsonData.progress || 0;

                if (currentStatus === 'completed' || currentStatus === 'succeeded') {
                    currentStatus = 'completed';
                    progressPercentage = 100;
                } else if (currentStatus === 'failed') {
                    currentStatus = 'failed';
                } else {
                    currentStatus = 'active'; // Menyesuaikan dengan UI front-end lu
                    if (!progressPercentage) progressPercentage = 45; 
                }

                // Mengambil link video hasil render dari array/objek output Wavespeed
                const videoHasil = jsonData.output_video_url || 
                                   (jsonData.output && jsonData.output.video_url) || 
                                   (jsonData.output && jsonData.output[0]) || null;

                return res.status(200).json({
                    status: currentStatus,
                    progress: progressPercentage,
                    output_video_url: videoHasil
                });
            } catch (e) {
                return res.status(response.status).json({ error: 'Gagal memproses data update status dari Wavespeed.' });
            }
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Mendaftarkan Pembuatan Video Baru
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling_v2_6";
        const finalGuidance = body.guidance_scale || 0.5;

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar referensi utama kosong. Silakan unggah terlebih dahulu." });
        }

        // Normalisasi format nama model untuk Wavespeed AI (menggunakan garis bawah)
        let cleanModel = "kling_v2_6";
        const modelText = String(rawModel).toLowerCase();

        if (modelText.includes("kling") && modelText.includes("2.6")) {
            cleanModel = "kling_v2_6";
        } else if (modelText.includes("kling") && modelText.includes("2.5")) {
            cleanModel = "kling_v2_5";
        } else if (modelText.includes("luma")) {
            cleanModel = "luma_ray_v2";
        } else {
            cleanModel = String(rawModel).trim().replace(/[\.-]/g, '_');
        }

        // Menyusun Paket Data/Payload Flat untuk Wavespeed /v1/tasks
        const wavespeedPayload = {
            task_type: "video_generation",
            model: cleanModel,
            prompt: finalPrompt || "Professional product commercial movement, clean aesthetic, 8k resolution, smooth motion",
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        // Jika user menyertakan video gerakan sebagai acuan (Motion Control)
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            wavespeedPayload.video_url = String(finalVideoUrl);
        }

        // Tembak langsung ke URL utama Wavespeed
        const response = await fetch(WAVESPEED_TASKS_URL, {
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
            
            // Berhasil mengamankan ID antrean, oper balik ke front-end website lu
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Eror Struktur Server Wavespeed (${response.status}): ${responseText.substring(0, 100)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
