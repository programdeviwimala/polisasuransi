-- ==========================================
-- SQL SCRIPT UNTUK DATABASE SUPABASE
-- ==========================================
-- Salin seluruh teks ini, lalu tempel (paste) di SQL Editor Supabase Anda,
-- kemudian klik tombol "Run" di kanan bawah editor.

-- 1. Hapus tabel lama jika sudah ada (untuk mencegah error)
DROP TABLE IF EXISTS jaminan_polis CASCADE;
DROP TABLE IF EXISTS nasabah CASCADE;
DROP TABLE IF EXISTS pengguna CASCADE;

-- 2. Buat tabel Akun Pengguna
CREATE TABLE pengguna (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL, -- Menggunakan teks biasa agar admin mudah membuat/mengingat akun tim
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'lapangan'))
);

-- 3. Buat tabel Data Nasabah
CREATE TABLE nasabah (
    id SERIAL PRIMARY KEY,
    nama_nasabah VARCHAR(100) NOT NULL,
    nama_marketing VARCHAR(100),
    no_pk VARCHAR(50) UNIQUE NOT NULL,
    plafond NUMERIC(15, 2) NOT NULL,
    jangka_waktu INT NOT NULL, -- dalam bulan
    periode_awal DATE NOT NULL,
    periode_akhir DATE NOT NULL,
    bunga NUMERIC(5, 2) NOT NULL, -- Spread rate
    keterangan VARCHAR(50) CHECK (keterangan IN ('RO LUNAS', 'RO KM', 'Baru')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Buat tabel Jaminan & Polis (Detail Kendaraan & Status)
CREATE TABLE jaminan_polis (
    id SERIAL PRIMARY KEY,
    nasabah_id INT REFERENCES nasabah(id) ON DELETE CASCADE,
    merk_kendaraan VARCHAR(50) NOT NULL,
    tipe_kendaraan VARCHAR(50) NOT NULL,
    tahun_kendaraan INT NOT NULL,
    harga_taksasi NUMERIC(15, 2) NOT NULL,
    asuransi_pilihan VARCHAR(50) NOT NULL,
    no_polis VARCHAR(100), -- Diisi oleh admin ketika polis datang
    status VARCHAR(100) DEFAULT 'Menunggu Polis' CHECK (status IN (
        'Menunggu Polis',
        'Polis Datang, Menunggu Lapangan',
        'Diterima Lapangan, Dalam Proses Pengantaran',
        'Selesai, Polis Sudah Diantar Nasabah'
    )),
    petugas_lapangan VARCHAR(100), -- Nama petugas yang ditugaskan mengantar
    ttd_petugas TEXT, -- Berisi data gambar tanda tangan (Base64)
    ttd_nasabah TEXT, -- Berisi data gambar tanda tangan (Base64)
    foto_bukti TEXT, -- Berisi URL foto yang diunggah ke storage
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Masukkan Data Akun Awal (Username & Password untuk Uji Coba)
-- Admin
INSERT INTO pengguna (username, password, role) VALUES ('admin', 'admin123', 'admin');
-- Petugas Lapangan
INSERT INTO pengguna (username, password, role) VALUES ('lapangan1', 'lapangan1', 'lapangan');
INSERT INTO pengguna (username, password, role) VALUES ('lapangan2', 'lapangan2', 'lapangan');

-- 6. Nonaktifkan Row Level Security (RLS) untuk prototipe aplikasi
ALTER TABLE pengguna DISABLE ROW LEVEL SECURITY;
ALTER TABLE nasabah DISABLE ROW LEVEL SECURITY;
ALTER TABLE jaminan_polis DISABLE ROW LEVEL SECURITY;
