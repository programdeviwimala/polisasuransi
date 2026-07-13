# PANDUAN SETUP APLIKASI WEB POLIS (RAMAH PEMULA)

Panduan ini dibuat khusus untuk Anda yang awam pemrograman. Ikuti 4 langkah mudah berikut untuk mengaktifkan aplikasi web pelacakan polis asuransi Anda secara **GRATIS selamanya**.

---

## Langkah 1: Membuat Database di Supabase

Supabase berfungsi sebagai memori (penyimpan data) aplikasi Anda.

1. Buka website **[supabase.com](https://supabase.com)** di browser komputer Anda.
2. Klik tombol **Start your project** atau **Sign Up** untuk membuat akun gratis (gunakan akun Google/Gmail Anda agar cepat).
3. Setelah masuk, klik tombol **New Project** (Proyek Baru) di dasbor Supabase.
4. Isi data proyek baru Anda:
   * **Organization:** Pilih nama organisasi Anda (biasanya otomatis terisi nama Anda).
   * **Name:** Isi dengan `Polis Asuransi Tracker`.
   * **Database Password:** Buat password database Anda (catat password ini agar tidak lupa).
   * **Region:** Pilih wilayah terdekat (misal: `Singapore`).
   * **Pricing Plan:** Pilih **Free** (Gratis).
5. Klik **Create new project** dan tunggu sekitar 1-2 menit hingga proyek selesai dibuat.

---

## Langkah 2: Membuat Tabel Database Otomatis

Kita akan membuat tabel untuk data nasabah, kendaraan, dan akun pengguna secara otomatis menggunakan file `schema.sql` yang sudah disediakan di folder ini.

1. Di dasbor Supabase (kolom kiri), klik menu **SQL Editor** (ikon berbentuk terminal `>_`).
2. Klik tombol **New Query** (atau **Create a new query**).
3. Buka file **`schema.sql`** di komputer Anda (klik kanan file tersebut, buka dengan **Notepad**).
4. **Salin (Copy)** seluruh isi teks di dalam `schema.sql` tersebut.
5. **Tempel (Paste)** teks tersebut ke dalam kotak SQL Editor di Supabase.
6. Klik tombol **Run** di pojok kanan bawah kotak editor.
7. Jika sukses, Anda akan melihat tulisan "Success" di bagian bawah. Sekarang tabel data Anda sudah siap!
8. **PENTING UNTUK FITUR IMPORT EXCEL:** Agar Anda bisa mengimpor data Excel dengan berbagai macam tipe Keterangan (misal: "RO TERKAIT ORANGTUA"), buat query baru di SQL Editor Supabase dan jalankan perintah berikut:
   ```sql
   ALTER TABLE nasabah DROP CONSTRAINT IF EXISTS nasabah_keterangan_check;
   ```
   *Perintah ini akan membuang batasan isian kolom Keterangan agar database Anda fleksibel menerima catatan apa pun dari file Excel.*

---

## Langkah 3: Menghubungkan Aplikasi ke Supabase Anda

Kita perlu memasukkan kunci koneksi dari Supabase ke dalam file konfigurasi aplikasi.

1. Di dasbor Supabase, klik menu **Project Settings** (ikon Roda Gigi di kiri paling bawah).
2. Klik menu **API**.
3. Cari bagian **Project API Keys** dan **Project URL**:
   * Salin **Project URL** (berawalan `https://...`).
   * Salin **anon public** key (teks kode yang sangat panjang).
4. Buka folder aplikasi di komputer Anda, klik kanan file **`config.js`**, lalu pilih **Open with Notepad** (Buka dengan Notepad).
5. Ganti teks default dengan URL dan Key yang Anda salin tadi:
   ```javascript
   const SUPABASE_URL = "TEMPEL_URL_PROYEK_ANDA_DI_SINI";
   const SUPABASE_ANON_KEY = "TEMPEL_API_KEY_ANON_ANDA_DI_SINI";
   ```
6. **Simpan** file `config.js` (tekan `Ctrl + S`).

---

## Langkah 4: Mengonlinekan Website secara Gratis (Drag-and-Drop)

Ini adalah langkah paling seru! Kita akan membuat website Anda aktif dan bisa dibuka oleh siapapun secara online tanpa menyewa hosting berbayar.

1. Buka website **[Netlify Drop](https://app.netlify.com/drop)** di browser Anda.
2. Anda akan melihat kotak besar bertuliskan **"Drag and drop your site folder here"** (Tarik dan lepas folder situs Anda di sini).
3. Buka File Explorer di komputer Anda, temukan folder **`aplikasi_asuransi`** yang berisi file `index.html`, `style.css`, `app.js`, dll.
4. **Tarik (Drag) seluruh folder `aplikasi_asuransi`** tersebut menggunakan mouse, lalu **Lepas (Drop)** di dalam kotak besar di halaman website Netlify tadi.
5. Tunggu sekitar 5-10 detik. Netlify akan langsung membuatkan website online Anda secara otomatis!
6. Anda akan diberikan link website aktif (misal: `https://lively-cookies-1293ad.netlify.app`).

*Catatan: Anda bisa mendaftarkan akun gratis di Netlify untuk mengubah nama link website tersebut agar lebih mudah diingat.*

---

## Langkah 5: Cara Menggunakan Aplikasi

Bagikan link website Netlify Anda ke 3 rekan kerja Anda. Mereka bisa langsung membukanya di browser HP atau Komputer masing-masing dengan data login berikut (sudah dibuatkan di database):

### 1. Akun Admin Kantor (Komputer / HP)
* **Username:** `admin`
* **Password:** `admin123`
* *Fungsi:* Menginput nasabah & jaminan baru, mencatat polis datang, menugaskan petugas lapangan.

### 2. Akun Petugas Lapangan (HP)
* **Username:** `lapangan1` (atau `lapangan2`)
* **Password:** `lapangan1` (atau `lapangan2`)
* *Fungsi:* Mengantarkan polis, mengambil tanda tangan digital nasabah, memotret tanda terima fisik.

---

### Perubahan Alur di Masa Depan
Jika Anda ingin menambah data atau memodifikasi tampilan website:
1. Edit file `index.html` atau `style.css` di komputer lokal Anda.
2. Tarik kembali folder `aplikasi_asuransi` tersebut ke dasbor Netlify Anda untuk meng-update website secara instan.
