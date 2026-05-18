module.exports = async (req, res) => {
    // Pengaturan CORS
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

    const dataHP = req.body || {};

    // KITA GA KAN PAKAI JSON, TAPI KIRIM TEKS BERSIH BERSKALA BESAR
    res.setHeader('Content-Type', 'text/plain');
    
    const teksAnalisis = `
==================================================
🔍 STRUKTUR DATA ASLI DARI HP KEYDEN
==================================================
Kunci data yang dikirim: ${JSON.stringify(Object.keys(dataHP))}

Isi lengkap paket data:
${JSON.stringify(dataHP, null, 4)}
==================================================
`;

    // Kirim status 400 tapi isinya teks murni agar nembus ke layar browser
    return res.status(400).send(teksAnalisis);
};
