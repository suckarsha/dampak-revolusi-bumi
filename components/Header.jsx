'use client';

import useSimulationStore from '@/store/simulationStore';
import { useState } from 'react';

export default function Header() {
  const reset = useSimulationStore((s) => s.reset);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <header className="header">
        <h1 className="header__title">
          🌍 Simulasi Musim & Ekliptika
        </h1>
        <div className="header__actions">
          <button className="header__btn" onClick={reset}>
            ↺ Reset
          </button>
          <button className="header__btn" onClick={() => setShowAbout(true)}>
            ℹ Tentang
          </button>
        </div>
      </header>

      {showAbout && (
        <div className="info-overlay" onClick={() => setShowAbout(false)}>
          <div className="info-overlay__card" onClick={(e) => e.stopPropagation()}>
            <h2>Tentang Simulasi</h2>
            <p>
              Simulasi ini menampilkan orbit Bumi mengelilingi Matahari dan bagaimana
              posisi orbit memengaruhi musim di Bumi. Kemiringan sumbu Bumi sebesar
              23,44° menyebabkan perbedaan musim di belahan Utara dan Selatan.
            </p>
            <p>
              <strong>Cara penggunaan:</strong><br />
              • Klik & seret pada tampilan orbit untuk mengubah perspektif<br />
              • Klik & seret Bumi untuk mengubah posisi/tanggal<br />
              • Geser figur pengamat untuk mengubah lintang<br />
              • Gunakan timeline di bawah untuk memilih bulan
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Terinspirasi dari NAAP Seasons & Ecliptic Simulator — University of Nebraska-Lincoln.
              Dibuat ulang dalam Bahasa Indonesia dengan tampilan modern.
            </p>
            <button onClick={() => setShowAbout(false)}>Tutup</button>
          </div>
        </div>
      )}
    </>
  );
}
