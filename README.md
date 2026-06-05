# SRT Voice Sync 🎬

Generate synced TTS voiceovers from SRT subtitle files using **Gemini 2.5 Flash TTS**, then export a single WAV audio track perfectly timed to your video timeline.

## Features

- 📄 **SRT file parser** — drag & drop any `.srt` file
- 🎙️ **Gemini TTS per entry** — generate or regenerate individual subtitle lines
- ⏱️ **Timestamp sync** — each audio segment is placed at the exact SRT start time using `OfflineAudioContext`
- 🔊 **WAV export** — 24 kHz · 16-bit PCM · mono, ready to overlay on your video
- 🔑 **Client-side API key** — stored in `localStorage`, never hard-coded

## Tech Stack

- **Next.js 15** (App Router)
- **Tailwind CSS v3**
- **Gemini 2.5 Flash Preview TTS** API
- **Web Audio API** (OfflineAudioContext for stitching)
- Deployed on **Vercel**

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/srt-tts-sync.git
cd srt-tts-sync
npm install
npm run dev
```

### 2. Get a Gemini API key

Go to [Google AI Studio](https://aistudio.google.com/app/apikey) and create a free API key.

### 3. Run the app

Open [http://localhost:3000](http://localhost:3000), paste your API key in the UI, and upload an `.srt` file.

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. No environment variables needed — API key is entered in the UI
4. Click **Deploy** ✓

## How It Works

```
SRT File → Parse entries → Generate TTS (Gemini API) per entry
       → OfflineAudioContext: place each segment at SRT start time
       → Render full timeline → Encode WAV → Download
```

## Project Structure

```
src/
├── app/
│   ├── api/tts/route.js   # Proxies request to Gemini TTS API
│   ├── page.jsx           # Main UI: timeline, controls, export
│   ├── layout.jsx
│   └── globals.css
└── lib/
    ├── parseSRT.js        # SRT parser + timecode utilities
    └── audioUtils.js      # Audio stitcher + WAV encoder
```

## Voices Available

| Voice | Character |
|-------|-----------|
| Zephyr | Bright |
| Puck | Upbeat |
| Charon | Informative |
| Kore | Firm |
| Fenrir | Excitable |
| Aoede | Breezy |
| Orbit | Relaxed |
| Callisto | Clear |

## Notes

- Audio is **clipped** to the SRT segment duration — if Gemini generates speech longer than the subtitle window, it won't overlap the next entry.
- The **video length** field controls the total WAV duration. It auto-fills from the last SRT entry end time but can be adjusted.
- You can regenerate individual entries without re-running the whole file.
