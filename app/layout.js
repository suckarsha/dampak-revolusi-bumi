import "./globals.css";

export const metadata = {
  title: "Simulasi Musim & Ekliptika — Simulator Astronomi Interaktif",
  description: "Simulasi interaktif 3D revolusi Bumi mengelilingi Matahari. Pelajari musim, ekliptika, deklinasi matahari, dan sudut cahaya matahari dalam Bahasa Indonesia.",
  keywords: "simulasi musim, ekliptika, revolusi bumi, astronomi, seasons simulator, IPA, fisika",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
