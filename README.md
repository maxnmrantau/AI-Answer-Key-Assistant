# 🤖 AI Answer Checker & Question Generator

Aplikasi berbasis AI yang dirancang untuk membantu pengajar dan siswa dalam memeriksa jawaban secara otomatis berdasarkan dokumen PDF kunci jawaban, serta membuat soal baru secara instan menggunakan teknologi **Google Gemini AI**.

---

## 🌟 Fitur Utama

- **📄 Analisis Multi-PDF**: Unggah satu atau lebih file PDF sebagai basis data kunci jawaban.
- **🔍 Pemeriksa Jawaban Cerdas**: 
  - Input pertanyaan melalui **Teks**.
  - Input pertanyaan melalui **Screenshot** (Gambar).
  - AI akan mencari jawaban yang paling tepat berdasarkan dokumen yang diunggah.
- **📝 Pembuat Soal Otomatis**: Buat soal pilihan ganda baru secara instan dari materi PDF yang Anda miliki.
- **🔑 Manajemen Multi-API Key**:
  - Masukkan lebih dari satu API Key Gemini.
  - **Rotasi Otomatis**: Jika satu key mencapai limit atau expired, sistem akan otomatis beralih ke key berikutnya.
  - Penyimpanan lokal (LocalStorage) agar key tidak perlu diinput ulang.
- **⚡ UI/UX Modern**: Antarmuka bersih, responsif, dan interaktif menggunakan Tailwind CSS dan Framer Motion.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Animasi**: [Framer Motion](https://www.framer.com/motion/)
- **AI Engine**: [Google Gemini AI SDK (@google/genai)](https://ai.google.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 🚀 Cara Penggunaan

### 1. Persiapan API Key
Aplikasi ini membutuhkan API Key dari Google Gemini.
- Dapatkan key gratis di [Google AI Studio](https://aistudio.google.com/app/apikey).
- Masukkan key tersebut di panel **"Manajemen API Key"** pada aplikasi.

### 2. Memeriksa Jawaban
1. Unggah file PDF kunci jawaban di panel kiri.
2. Tambahkan pertanyaan di panel kanan (bisa ketik teks atau upload screenshot soal).
3. Klik **"Cari Jawaban"**.
4. AI akan memberikan jawaban beserta penjelasan singkatnya.

### 3. Membuat Soal Baru
1. Pastikan PDF materi sudah terunggah.
2. Pilih tab **"Buat Soal Baru"**.
3. Tentukan jumlah soal yang diinginkan.
4. Klik **"Buat Soal"**.

---

## 📦 Instalasi Lokal

Jika Anda ingin menjalankan proyek ini di komputer sendiri:

```bash
# 1. Clone repositori
git clone https://github.com/username/repo-name.git

# 2. Masuk ke folder
cd repo-name

# 3. Install dependensi
npm install

# 4. Jalankan aplikasi
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`.

---

## 🌐 Deployment ke Vercel

Aplikasi ini sangat mudah di-deploy ke Vercel:
1. Hubungkan repositori GitHub Anda ke Vercel.
2. Tambahkan Environment Variable `GEMINI_API_KEY` di dashboard Vercel (opsional, karena pengguna bisa input manual di UI).
3. Klik **Deploy**.

---

## 📄 Lisensi
Proyek ini bersifat open-source dan bebas digunakan untuk tujuan pendidikan.

---
*Dibuat saat kepikiran, juga atas bantuan AI* & *Bakalan update versi kalo lagi kepikiran*
