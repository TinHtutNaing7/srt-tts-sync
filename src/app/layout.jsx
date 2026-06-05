import './globals.css';

export const metadata = {
  title: 'SRT Voice Sync — Gemini TTS Timeline',
  description: 'Generate and sync Gemini TTS voiceovers to SRT subtitle timecodes. Export a WAV audio track perfectly timed to your video.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-body antialiased">
        {children}
      </body>
    </html>
  );
}
