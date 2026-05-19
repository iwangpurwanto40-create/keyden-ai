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

        // 🌟 ENDPOINT BARU KHUSUS VIDEO (Bukan /v1/tasks lagi)
        const BASE_VIDEO_URL = 'https://api.magnific.ai/v1/video';

        // ---------------------------------------------------------------------
        // JALUR 1: Memantau Progress Status Video (Polling)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            // Mengecek antrean video langsung ke endpoint video/[id]
            const statusUrl = `${BASE_VIDEO_URL}/${taskId}`;
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal memantau status antrean video.' });
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
                return res.status(response.status).json({ error: 'Gagal membaca status perkembangan video.' });
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
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar referensi terlebih dahulu." });
        }

        // Penerjemah nama kode model otomatis (wajib menggunakan garis bawah '_')
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

        // Struktur data flat (tingkat utama) yang diminta oleh endpoint /v1/video
        const mainPayload = {
            model: cleanModel,
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        // Tambahkan opsional video jika ada gerakan referensi
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            mainPayload.video_url = String(finalVideoUrl);
        }

        // Tambahkan teks prompt instruksi jika diisi
        if (finalPrompt && String(finalPrompt).trim() !== "") {
            mainPayload.prompt = String(finalPrompt);
        }

        // Tembak langsung ke endpoint pembuatan video baru Magnific
        const response = await fetch(BASE_VIDEO_URL, {
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
                return res.status(response.status).json({ error: data.detail || `Sistem Magnific menolak: ${responseText}` });
            }
            
            // Berhasil mendapatkan ID antrean, kirim ke front-end halaman web lu
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ error: `Eror Struktural Server (${response.status}): ${responseText.substring(0, 120)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
