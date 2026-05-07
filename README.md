# Simulasi Musim & Ekliptika 🌍

Simulasi interaktif 3D revolusi Bumi mengelilingi Matahari dalam Bahasa Indonesia.  
Terinspirasi dari [NAAP Seasons & Ecliptic Simulator](https://astro.unl.edu/naap/motion1/animations/seasons_ecliptic.html).

## ✨ Fitur

- **Tampilan Orbit** — Matahari di tengah, Bumi mengorbit dengan kemiringan sumbu 23.44°
- **Bola Langit** — Mode geosentris dengan ekliptika dan ekuator langit
- **Panel Lintang** — Globe Bumi 3D dengan pengamat yang bisa digeser
- **Panel Cahaya** — Visualisasi sudut dan sebaran cahaya matahari
- **Timeline Interaktif** — Pilih bulan dan jalankan animasi
- **Data Real-time** — Deklinasi, asensio rekta, dan altitude matahari

## 🚀 Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000

## 📦 Deploy ke Vercel

```bash
# Push ke GitHub, lalu connect di vercel.com
# Atau gunakan Vercel CLI:
npx vercel
```

## 🛠️ Tech Stack

- **Next.js 16** — Framework React
- **Three.js** — 3D rendering (via @react-three/fiber)
- **Zustand** — State management
- **Vanilla CSS** — Custom design system
