'use client';

import useSimulationStore from '@/store/simulationStore';
import { useState, useEffect } from 'react';
import { audioSystem } from '@/utils/AudioEngine';

export default function Header() {
  const reset = useSimulationStore((s) => s.reset);
  const [showAbout, setShowAbout] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const toggleAudio = () => {
    if (audioSystem) {
      setAudioEnabled(audioSystem.toggleMute());
    }
  };

  return (
    <>
      <header className="header">
        <div className="header__title-container">
          <div className="header__logo">
            <span className="header__globe-icon">🌍</span>
          </div>
          <div className="header__title-text">
            <h1 className="header__title">
              Simulasi Musim & Ekliptika
            </h1>
            <span className="header__subtitle">Interactive 3D Explorer</span>
          </div>
        </div>
        <div className="header__actions">
          <button className="header__btn" onClick={toggleAudio}>
            {audioEnabled ? '🔊 Audio ON' : '🔇 Audio OFF'}
          </button>
          <button className="header__btn" onClick={() => { audioSystem?.playClick(); reset(); }}>
            ↺ Reset
          </button>
          <button className="header__btn" onClick={() => { audioSystem?.playClick(); setShowAbout(true); }}>
            ℹ Tentang
          </button>
        </div>
      </header>

      {showAbout && (
        <div className="info-overlay" style={{ zIndex: 9999 }} onClick={() => setShowAbout(false)}>
          <div className="info-overlay__card" onClick={(e) => e.stopPropagation()}>
            <div className="info-overlay__header">
              <span className="info-overlay__icon">🌌</span>
              <h2>Tentang Simulasi</h2>
            </div>
            
            <div className="info-overlay__content">
              <p className="info-overlay__desc">
                Simulasi ini menampilkan orbit Bumi mengelilingi Matahari dan bagaimana
                posisi orbit memengaruhi musim di Bumi. Kemiringan sumbu Bumi sebesar
                <strong className="text-highlight"> 23,44° </strong> menyebabkan perbedaan musim di belahan Utara dan Selatan.
              </p>
              
              <div className="info-overlay__instructions">
                <h3>Cara Penggunaan:</h3>
                <ul>
                  <li><span className="inst-icon">🖱️</span> <span><strong>Klik & seret</strong> pada tampilan orbit untuk mengubah perspektif</span></li>
                  <li><span className="inst-icon">🌍</span> <span><strong>Klik & seret Bumi</strong> untuk mengubah posisi/tanggal</span></li>
                  <li><span className="inst-icon">🧍</span> <span><strong>Geser figur pengamat</strong> untuk mengubah lintang</span></li>
                  <li><span className="inst-icon">⏱️</span> <span><strong>Gunakan timeline</strong> di bawah untuk memilih bulan</span></li>
                </ul>
              </div>

              <div className="info-overlay__developer">
                <div className="dev-avatar">
                  👨‍🏫
                </div>
                <div className="dev-info">
                  <span className="dev-title">Pengembang</span>
                  <a href="https://www.instagram.com/suckarsha" target="_blank" rel="noopener noreferrer" className="dev-name">
                    I Kadek Sukarsa, S.Pd., M.Pd.
                  </a>
                  <span className="dev-school">SMP Negeri 3 Singaraja</span>
                </div>
              </div>
            </div>

            <button className="info-overlay__close-btn" onClick={() => { audioSystem?.playClick(); setShowAbout(false); }}>
              Tutup Panel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
