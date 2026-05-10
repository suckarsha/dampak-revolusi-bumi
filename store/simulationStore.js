import { create } from 'zustand';

/**
 * Menghitung hari dalam tahun (1-365) dari bulan dan tanggal
 */
function getDayOfYear(month, day) {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = 0;
  for (let i = 0; i < month; i++) {
    doy += daysInMonth[i];
  }
  return doy + day;
}

/**
 * Menghitung bulan dan tanggal dari hari dalam tahun
 */
function getMonthDay(dayOfYear) {
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let remaining = Math.floor(dayOfYear);
  for (let m = 0; m < 12; m++) {
    if (remaining <= daysInMonth[m]) {
      return { month: m, day: Math.max(1, remaining) };
    }
    remaining -= daysInMonth[m];
  }
  return { month: 11, day: 31 };
}

/**
 * Deklinasi matahari dalam derajat
 * Menggunakan rumus aproksimasi: δ = 23.44° × sin(360/365 × (N + 284))
 */
function getSunDeclination(dayOfYear) {
  const deg = (360 / 365) * (dayOfYear + 284);
  return 23.44 * Math.sin((deg * Math.PI) / 180);
}

/**
 * Asensio rekta matahari dalam jam (0-24)
 */
function getSunRightAscension(dayOfYear) {
  // Sudut ekliptika (ecliptic longitude)
  const L = (360 / 365.25) * (dayOfYear - 80); // roughly
  const Lrad = (L * Math.PI) / 180;
  const obliquity = (23.44 * Math.PI) / 180;
  
  let ra = Math.atan2(Math.cos(obliquity) * Math.sin(Lrad), Math.cos(Lrad));
  ra = (ra * 180) / Math.PI;
  if (ra < 0) ra += 360;
  return ra / 15; // konversi ke jam
}

/**
 * Sudut orbit bumi (0-360) berdasarkan hari dalam tahun
 * 0° = Vernal Equinox (~21 Maret, day 80)
 */
function getOrbitAngle(dayOfYear) {
  return ((dayOfYear - 80) / 365.25) * 360;
}

/**
 * Altitude matahari saat transit (noon) untuk lintang tertentu
 */
function getSunAltitude(latitude, declination) {
  return 90 - Math.abs(latitude - declination);
}

/**
 * Menghitung durasi siang (jam) berdasarkan lintang dan deklinasi
 * Menggunakan rumus: cos(ωs) = -tan(φ) × tan(δ)
 * dimana ωs = hour angle saat matahari terbit/terbenam
 */
function getDaylightHours(latitude, declination) {
  const latRad = (latitude * Math.PI) / 180;
  const declRad = (declination * Math.PI) / 180;
  
  const cosOmega = -Math.tan(latRad) * Math.tan(declRad);
  
  // Polar day (24 jam siang)
  if (cosOmega < -1) return 24;
  // Polar night (0 jam siang)
  if (cosOmega > 1) return 0;
  
  const omega = Math.acos(cosOmega);
  return (omega / Math.PI) * 24;
}

/**
 * Info musim berdasarkan bulan (untuk belahan bumi utara)
 * Returns { north: string, south: string, icon_north: string, icon_south: string }
 */
function getSeasonInfo(dayOfYear) {
  // Based on approximate day ranges for Northern Hemisphere
  // Spring: Mar 21 (80) - Jun 20 (171)
  // Summer: Jun 21 (172) - Sep 22 (265)
  // Autumn: Sep 23 (266) - Dec 20 (354)
  // Winter: Dec 21 (355) - Mar 20 (79)
  
  const seasons = {
    spring: { north: 'Semi', south: 'Gugur', iconN: '🌸', iconS: '🍂' },
    summer: { north: 'Panas', south: 'Dingin', iconN: '☀️', iconS: '❄️' },
    autumn: { north: 'Gugur', south: 'Semi', iconN: '🍂', iconS: '🌸' },
    winter: { north: 'Dingin', south: 'Panas', iconN: '❄️', iconS: '☀️' },
  };

  let s;
  if (dayOfYear >= 80 && dayOfYear < 172) s = seasons.spring;
  else if (dayOfYear >= 172 && dayOfYear < 266) s = seasons.summer;
  else if (dayOfYear >= 266 && dayOfYear < 355) s = seasons.autumn;
  else s = seasons.winter;

  return {
    north: `Musim ${s.north}`,
    south: `Musim ${s.south}`,
    iconN: s.iconN,
    iconS: s.iconS,
  };
}

/**
 * Info tooltip per bulan
 */
function getMonthTooltip(monthIndex) {
  const tooltips = [
    'Perihelion (~3 Jan)\nBumi terdekat Matahari',
    null,
    'Ekuinoks Vernal (~21 Mar)\nSiang = Malam di seluruh dunia',
    null,
    null,
    'Solstis (~21 Jun)\nSiang terpanjang di utara',
    null,
    null,
    'Ekuinoks Autumnal (~23 Sep)\nSiang = Malam di seluruh dunia',
    null,
    null,
    'Solstis (~21 Des)\nMalam terpanjang di utara',
  ];
  return tooltips[monthIndex] || null;
}

const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const MONTH_FULL_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const useSimulationStore = create((set, get) => ({
  // === State Utama ===
  month: 2,       // 0-indexed (0=Januari)
  day: 21,        // 1-indexed
  doyExact: 80,   // Fractional exact day
  latitude: 10.0, // derajat (positif = Utara)
  isAnimating: false,
  animationSpeed: 1,
  
  // === Mode Tampilan ===
  viewMode: 'orbit',        // 'orbit' | 'celestial'
  sunlightMode: 'angle',    // 'angle' | 'spread'
  earthViewMode: 'side',    // 'side' | 'sun'
  showLabels: false,
  showConstellations: false,
  rotateEarth: true,
  
  // === Computed Values ===
  get dayOfYear() {
    return get().doyExact;
  },

  getDayOfYear: () => {
    return get().doyExact;
  },

  getSunDeclination: () => {
    const doy = getDayOfYear(get().month, get().day);
    return getSunDeclination(doy);
  },

  getSunRightAscension: () => {
    const doy = getDayOfYear(get().month, get().day);
    return getSunRightAscension(doy);
  },

  getOrbitAngle: () => {
    const doy = getDayOfYear(get().month, get().day);
    return getOrbitAngle(doy);
  },

  getSunAltitude: () => {
    const state = get();
    const doy = getDayOfYear(state.month, state.day);
    const decl = getSunDeclination(doy);
    return getSunAltitude(state.latitude, decl);
  },

  getDaylightHours: () => {
    const state = get();
    const doy = getDayOfYear(state.month, state.day);
    const decl = getSunDeclination(doy);
    return getDaylightHours(state.latitude, decl);
  },

  getSeasonInfo: () => {
    const doy = getDayOfYear(get().month, get().day);
    return getSeasonInfo(doy);
  },

  getDateString: () => {
    const state = get();
    return `${state.day} ${MONTH_FULL_NAMES_ID[state.month]}`;
  },

  getLatitudeString: () => {
    const lat = get().latitude;
    const dir = lat >= 0 ? 'U' : 'S';
    return `${Math.abs(lat).toFixed(1)}° ${dir}`;
  },

  // === Actions ===
  setDate: (month, day) => set({ month, day, doyExact: getDayOfYear(month, day) }),
  
  setDayOfYear: (doy) => {
    let exact = ((doy - 1) % 365) + 1;
    if (exact < 1) exact += 365;
    const { month, day } = getMonthDay(exact);
    set({ month, day, doyExact: exact });
  },

  setLatitude: (lat) => set({ latitude: Math.max(-90, Math.min(90, lat)) }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  setSunlightMode: (mode) => set({ sunlightMode: mode }),
  setEarthViewMode: (mode) => set({ earthViewMode: mode }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowConstellations: (show) => set({ showConstellations: show }),
  setRotateEarth: (rotate) => set({ rotateEarth: rotate }),
  
  toggleAnimation: () => set((state) => ({ isAnimating: !state.isAnimating })),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  
  advanceTime: (deltaMs) => {
    const state = get();
    // Advance speed: ~15 days per second (1000ms)
    // 1 ms = 0.015 days
    const daysToAdd = deltaMs * 0.015 * state.animationSpeed;
    
    let exact = state.doyExact + daysToAdd;
    exact = ((exact - 1) % 365) + 1;
    if (exact <= 0) exact += 365;
    
    const oldInt = Math.floor(state.doyExact);
    const newInt = Math.floor(exact);
    
    if (oldInt !== newInt) {
      const { month, day } = getMonthDay(newInt);
      set({ month, day, doyExact: exact });
    } else {
      set({ doyExact: exact });
    }
  },

  reset: () => set({
    month: 2,
    day: 21,
    doyExact: 80,
    latitude: 10.0,
    isAnimating: false,
    animationSpeed: 1,
    viewMode: 'orbit',
    sunlightMode: 'angle',
    earthViewMode: 'side',
    showLabels: false,
    showConstellations: false,
    showSubsolarPoint: true,
  }),
}));

export { MONTH_NAMES_ID, MONTH_FULL_NAMES_ID, getMonthTooltip };
export default useSimulationStore;
