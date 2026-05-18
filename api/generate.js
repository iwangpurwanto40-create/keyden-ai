export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { apiKey, model, prompt, image_url, video_url, guidance_scale, character_orientation } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key diperlukan' });
        }

        // PERBAIKAN: Mengirimkan header otentikasi ganda agar kompatibel dengan Freepik maupun sistem Magnific asli
        const response = await fetch('https://api.freepik.com/v1/ai/video-generation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'X-Magnific-API-Key': apiKey, 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt || "Smooth motion control tracking shot",
                image_url: image_url,
                video_url: video_url || undefined,
                guidance_scale: parseFloat(guidance_scale || 0.5),
                character_orientation: character_orientation || 'video'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || 'Gagal divalidasi oleh server AI. Pastikan API Key Anda benar dan memiliki kuota.' });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
