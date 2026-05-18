const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS untuk akses browser HP
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

        // JALUR 1: Mengecek Status Hasil Antrean Video (Menggunakan /v1/tasks/)
        if (checkStatus && taskId) {
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal mengambil status antrean.' });
                }
                
                return res.status(200).json({
                    status: jsonData.status, // 'pending', 'processing', 'completed', 'failed'
                    progress: jsonData.progress || 0,
                    output_video_url: jsonData.result ? (jsonData.result.output || jsonData.result) : null
                });
            } catch (e) {
                return res.status(response.status).json({ error: `Gagal membaca status data (${response.status}).` });
            }
        }

        // JALUR 2: Mengirim Perintah Pembuatan Video Kontrol Baru (Menggunakan /v1/video/control)
        const generateUrl = 'https://api.magnific.ai/v1/video/control';
        
        const payload = {
            model: model || 'kling-v2.6',
            image_url: String(image_url),
            guidance_scale: parseFloat(guidance_scale) || 0.5
        };

        // Sertakan file referensi video jika ada
        if (video_url && video_url.trim() !== "") {
            payload.video_url = String(video_url);
            payload.character_orientation = character_orientation || 'video';
        }
        
        // Sertakan perintah teks jika diisi
        if (prompt && prompt.trim() !== "") {
            payload.prompt = String(prompt);
        }

        const response = await fetch(generateUrl, {
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
                // Deteksi jika sisa jatah 5 video pada API Key baru Anda sudah habis tercapai
                if (response.status === 403 || responseText.includes("limit") || responseText.includes("quota")) {
                    return res.status(403).json({ error: "Limit kuota pembuatan video untuk API Key ini sudah habis. Silakan buat/gunakan API Key baru." });
                }
                return res.status(response.status).json({ error: data.detail || 'Permintaan ditolak server Magnific.' });
            }
            
            // Melempar ID Tugas yang sukses didaftarkan ke index.html Anda
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            // Jika merespons 404, berarti ada parameter payload yang tidak sesuai tipe datanya
            if (response.status === 404) {
                return res.status(404).json({ error: "Gagal memproses (404). Pastikan link gambar/video referensi Anda valid dan bisa diakses publik." });
            }
            return res.status(response.status).json({ error: `Respons luar biasa dari server (${response.status}).` });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
