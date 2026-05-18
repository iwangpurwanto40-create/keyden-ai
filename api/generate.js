const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar bisa diakses browser HP Anda
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
            return res.status(400).json({ error: 'API Key Magnific wajib diisi!' });
        }

        // JALUR 1: Mengecek Status Hasil Video Berdasarkan Task ID
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
                    return res.status(response.status).json({ error: jsonData.detail || 'Gagal mengecek status antrean.' });
                }
                
                // Menyesuaikan status keluaran Magnific AI
                return res.status(200).json({
                    status: jsonData.status, // 'pending', 'processing', 'completed', 'failed'
                    progress: jsonData.progress || 0,
                    output_video_url: jsonData.result ? jsonData.result.output : null
                });
            } catch (e) {
                return res.status(response.status).json({ error: `Server Magnific merespons dengan kode ${response.status}.` });
            }
        }

        // JALUR 2: Membuat Tugas Pembuatan Video Baru (Task Generation)
        // Ini adalah endpoint universal Magnific untuk mendaftarkan proses AI berdurasi panjang
        const generateUrl = 'https://api.magnific.ai/v1/tasks';
        
        // Membangun struktur parameter wajib untuk model video kontrol Magnific
        const parameters = {
            image_url: String(image_url),
            guidance_scale: parseFloat(guidance_scale) || 0.50
        };

        if (video_url && video_url.trim() !== "") {
            parameters.video_url = String(video_url);
            parameters.character_orientation = character_orientation || 'video';
        }
        
        if (prompt && prompt.trim() !== "") {
            parameters.prompt = String(prompt);
        }

        // Payload wajib mengikuti standard task creation Magnific
        const payload = {
            task_type: "video_control", // Mengunci tipe tugas ke kontrol video AI
            model: model || 'kling-v2.6',
            parameters: parameters
        };

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
                if (response.status === 401) {
                    return res.status(401).json({ error: "API Key salah atau tidak memiliki izin akses (Unauthorized)." });
                }
                return res.status(response.status).json({ error: data.detail || 'Permintaan ditolak oleh Magnific.' });
            }
            
            // Mengirimkan Task ID yang berhasil dibuat ke frontend index.html
            return res.status(200).json({
                task_id: data.id || data.task_id
            });

        } catch (jsonEror) {
            return res.status(response.status).json({ 
                error: `Gagal memproses respons balik Magnific (${response.status}). Hubungi penyedia API Key Anda untuk memastikan paket Anda mendukung Video API.` 
            });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Internal Backend Error: ' + error.message });
    }
};
