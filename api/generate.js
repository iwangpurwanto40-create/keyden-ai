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

        // Endpoint Tunggal Resmi Magnific AI
        const TASKS_URL = 'https://api.magnific.ai/v1/tasks';

        // ---------------------------------------------------------------------
        // JALUR 1: Memantau Progress Status Video (Polling)
        // ---------------------------------------------------------------------
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
        // JALUR 2: Mendaftarkan Pembuatan Video Baru (Flat/Root Structure)
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalVideoUrl = body.video_url || body.video || body.videoUrl;
        const finalPrompt = body.prompt || "";
        const rawModel = body.model || "kling_v2_6";
        const finalGuidance = body.guidance_scale || 0.5;

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar referensi terlebih dahulu." });
        }

        // Konversi penamaan model sesuai format resmi Magnific (garis bawah)
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

        // ⚠️ STRUKTUR BARU: Semua parameter ditaruh di root utama, TIDAK pakai objek 'parameters' lagi
        const mainPayload = {
            task_type: "video_generation",
            model: cleanModel,
            image_url: String(finalImageUrl),
            guidance_scale: parseFloat(finalGuidance) || 0.5
        };

        // Sertakan video referensi jika ada
        if (finalVideoUrl && String(finalVideoUrl).trim() !== "") {
            mainPayload.video_url = String(finalVideoUrl);
        }

        // Sertakan prompt teks jika diisi
        if (finalPrompt && String(finalPrompt).trim() !== "") {
            mainPayload.prompt = String(finalPrompt);
        }

        // Kirim data ke Magnific
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
                return res.status(response.status).json({ error: data.detail || `Magnific menolak: ${responseText}` });
            }
            
            // Kembalikan ID task ke front-end
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            // Jika masuk ke sini, kita muntahkan isi teks aslinya biar kelihatan eror apa dari Magnific
            return res.status(response.status).json({ error: `Eror Respons Server (${response.status}): ${responseText.substring(0, 120)}` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
