const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Pengaturan CORS agar lancar diakses dari browser HP tanpa hambatan
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
        const apiKey = body.apiKey; // Diisi Token Hugging Face (hf_...)
        const taskId = body.taskId;
        const checkStatus = body.checkStatus;

        if (!apiKey) {
            return res.status(400).json({ error: 'API Key (Hugging Face Token) wajib diisi!' });
        }

        // ---------------------------------------------------------------------
        // JALUR 1: Sinkronisasi Polling Status (Bypass UI Front-End)
        // ---------------------------------------------------------------------
        if (checkStatus && taskId) {
            // Karena Hugging Face memproses video langsung selesai di request pertama,
            // saat front-end mengecek status, kita langsung loloskan sebagai 'completed'
            return res.status(200).json({
                status: 'completed',
                progress: 100,
                output_video_url: taskId // ID dikembalikan berupa link video/gambar hasil
            });
        }

        // ---------------------------------------------------------------------
        // JALUR 2: Mengirim Perintah ke Model Video Gratis Hugging Face
        // ---------------------------------------------------------------------
        const finalImageUrl = body.image_url || body.image || body.imageUrl;
        const finalPrompt = body.prompt || "";

        if (!finalImageUrl || String(finalImageUrl).trim() === "") {
            return res.status(400).json({ error: "Gambar utama kosong. Silakan unggah gambar terlebih dahulu." });
        }

        // Menggunakan model video open-source LTX-Video yang di-host gratis oleh Hugging Face
        const HF_ENDPOINT = "https://api-inference.hugging
