module.exports = async (req, res) => {
    // Pengaturan CORS agar aman diakses browser HP
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

    // Ambil semua nama kunci variabel yang dikirim dari form HP lu
    const daftarKunci = Object.keys(dataHP);

    // Kita susun kalimat rapi tanpa karakter aneh agar dibaca lancar sebagai JSON
    let teksLaporan = `Berhasil melacak! Variabel yang dikirim HP Anda adalah: [${daftarKunci.join(', ')}]. `;
    
    // Cari tahu apakah ada data teks panjang atau link yang nyangkut
    if (daftarKunci.length > 0) {
        teksLaporan += "Isi detail data pertama: " + String(JSON.stringify(dataHP)).substring(0, 150);
    } else {
        teksLaporan += "Peringatan: Paket data yang dikirim kosong melompong!";
    }

    // ⚠️ KUNCI UTAMA: Kita kirim status 400 tapi dibungkus objek JSON murni 'error'
    // agar lolos sensor index.html dan langsung muntah di layar pop-up HP lu
    return res.status(400).json({
        error: teksLaporan
    });
};
