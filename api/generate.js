const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Mengatasi kendala CORS (Keamanan Browser)
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
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { apiKey, taskId, checkStatus, model, prompt, image_url, video_url, guidance_scale, character_orientation } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key wajib diisi!' });
        }

        // JALUR B: Jika frontend meminta cek status antrean video
        if (checkStatus && taskId) {
            const statusUrl = `https://api.magnific.ai/v1/video/control/${taskId}`;
            const response = await fetch(statusUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            if (!response.ok) {
                return res.status(response.status).json({ error: data.detail || 'Gagal mengecek status ke Magnific.' });
            }
            return res.status(200).json(data);
        }

        // JALUR A: Jika frontend meminta generate video baru
        const generateUrl = 'https://api.magnific.ai/v1/video/control';
        const payload = {
            model: model || 'kling-v2.6',
            image_url: image_url,
            guidance_scale: parseFloat(guidance_scale) || 0.50,
            character_orientation: character_orientation || 'video'
        };

        if (video_url) payload.video_url = video_url;
        if (prompt && prompt.trim() !== "") payload.prompt = prompt;

        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok) {
            // Menangkap pesan limitasi atau eror dari Magnific
            const errMsg = data.detail || (data.error ? data.error.message : 'Terjadi kesalahan di server Magnific.');
            return res.status(response.status).json({ error: errMsg });
        }

        return res.status(200).json(data);

    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};
