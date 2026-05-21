const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS Terlengkap untuk Browser HP
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
        // JALUR 1: Memantau Progress Status Video (Polling Fal.ai)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            // Rute cek status antrean resmi dari Fal.ai
            const statusUrl = `https://queue.fal.run/fal-ai/kling-video/requests/${taskId}`;
            const response = await fetch(statusUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Key ${apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const textData = await response.text();
            try {
                const jsonData = JSON.parse(textData);
                
                let currentStatus = 'active';
                let progressPercentage = 50;
                let videoHasil = null;

                // Membaca status antrean Fal.ai
                if (jsonData.status === 'COMPLETED' || jsonData.video) {
                    currentStatus = 'completed';
                    progressPercentage = 100;
                    videoHasil = jsonData.video?.url || (jsonData.outputs && jsonData.outputs[0]?.url) || null;
                } else if (jsonData.status === 'FAILED') {
                    currentStatus = 'failed';
                } else {
                    currentStatus = 'active';
                    progressPercentage = jsonData.logs?.length ? Math.min(jsonData.logs.length * 5, 90) : 30;
                }

                return res.status(200).json({
                    status: currentStatus,
                    progress: progressPercentage,
                    output_video_url: videoHasil
                });
            } catch (e) {
                return res.status(response.status).json({ error: 'Gagal memproses update status antrean.' });
            }
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Mendaftarkan Pembuatan Video Baru (Kling v2.6 / v2.5 via Fal)
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling_v2_6";

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar terlebih dahulu." });
        }

        // Menentukan versi model Kling secara otomatis
        let falEndpoint = "https://queue.fal.run/fal-ai/kling-video/v2.5/image-to-video";
        if (String(rawModel).toLowerCase().includes("2.6")) {
            falEndpoint = "https://queue.fal.run/fal-ai/kling-video/v2.6/image-to-video"; // Jalur Kling 2.6
        }

        // Menyusun payload standar industri milik Fal.ai
        const falPayload = {
            prompt: finalPrompt || "Professional product commercial movement, clean aesthetic, smooth camera movement, highly detailed",
            image_url: String(finalImageUrl),
            duration: "5", // Durasi standar video komersial
            aspect_ratio: "16:9"
        };

        // Jika user menggunakan video referensi gerakan (Motion Control)
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            falPayload.motion_video_url = String(finalVideoUrl);
        }

        // Kirim perintah ke Fal.ai Queue System
        const response = await fetch(falEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(falPayload)
        });

        const responseText = await response.text();
        
        try {
            const data = JSON.parse(responseText);
            if (!response.ok) {
                return res.status(response.status).json({ error: data.detail || `Fal.ai menolak: ${responseText}` });
            }
            
            // Mengirim request_id antrean ke front-end website lu
            return res.status(200).json({
                task_id: data.request_id || data.id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Eror Jalur Gateway (${response.status}): ${responseText.substring(0, 100)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};
