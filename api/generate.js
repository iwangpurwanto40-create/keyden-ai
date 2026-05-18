module.exports = async (req, res) => {
    // Pengaturan CORS agar tidak diblokir browser HP
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

    // KITA PAKSA SERVER UNTUK MENAMPILKAN ISI DATA YANG DIKIRIM OLEH HP ANDA
    const dataYangDiterimaBackend = req.body || {};
    
    return res.status(400).json({
        error: "🔍 [MODE DEBUG KEYDEN] Berhasil menangkap data dari HP Anda! Silakan screenshot layar ini dan kirim ke saya agar saya bisa melihat strukturnya.",
        isi_data_anda: dataYangDiterimaBackend
    });
};
