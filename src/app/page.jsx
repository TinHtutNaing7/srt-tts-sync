'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { parseSRT, formatTimecode, formatShort } from '@/lib/parseSRT';
import { stitchAudio } from '@/lib/audioUtils';

// ─── Voice options ─────────────────────────────────────────────────────────────
const VOICES = [
  { id: 'Zephyr',   label: 'Zephyr',   desc: 'Bright'       },
  { id: 'Puck',     label: 'Puck',     desc: 'Upbeat'       },
  { id: 'Charon',   label: 'Charon',   desc: 'Informative'  },
  { id: 'Kore',     label: 'Kore',     desc: 'Firm'         },
  { id: 'Fenrir',   label: 'Fenrir',   desc: 'Excitable'    },
  { id: 'Aoede',    label: 'Aoede',    desc: 'Breezy'       },
  { id: 'Orbit',    label: 'Orbit',    desc: 'Relaxed'      },
  { id: 'Callisto', label: 'Callisto', desc: 'Clear'        },
  { id: 'Autonoe',  label: 'Autonoe',  desc: 'Gentle'       },
  { id: 'Umbriel',  label: 'Umbriel',  desc: 'Easy'         },
];

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    idle:       { label: 'PENDING',    cls: 'text-muted border-muted/30'              },
    generating: { label: 'GENERATING', cls: 'text-amber border-amber/40 pulse-amber'  },
    done:       { label: 'READY',      cls: 'text-teal border-teal/40'               },
    error:      { label: 'ERROR',      cls: 'text-red-400 border-red-400/40'          },
  };
  const { label, cls } = map[status] || map.idle;
  return (
    <span className={`font-mono text-[10px] tracking-widest px-2 py-0.5 border rounded ${cls}`}>
      {label}
    </span>
  );
}

// ─── Wave animation (shown while generating) ───────────────────────────────────
function WaveIcon() {
  return (
    <span className="inline-flex items-end gap-[2px] h-4">
      {[12, 14, 10, 16, 8].map((h, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{ height: h, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [apiKey, setApiKey]       = useState('');
  const [showKey, setShowKey]     = useState(false);
  const [voice, setVoice]         = useState('Kore');
  const [entries, setEntries]     = useState([]);
  const [fileName, setFileName]   = useState('');
  const [videoLen, setVideoLen]   = useState('');
  const [progress, setProgress]   = useState({});   // index -> status
  const [audioMap, setAudioMap]   = useState({});   // index -> base64
  const [generating, setGenerating] = useState(false);
  const [stitching, setStitching]   = useState(false);
  const [finalURL, setFinalURL]     = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewURL, setPreviewURL] = useState(null); // for single-entry preview
  const fileRef  = useRef(null);
  const audioRef = useRef(null);

  // Load API key from localStorage
  useEffect(() => {
    const k = localStorage.getItem('gemini_api_key');
    if (k) setApiKey(k);
  }, []);

  const handleKeyChange = (val) => {
    setApiKey(val);
    localStorage.setItem('gemini_api_key', val);
  };

  // ── SRT file loading ──────────────────────────────────────────────────────────
  const loadSRT = useCallback((file) => {
    if (!file || !file.name.toLowerCase().endsWith('.srt')) {
      alert('Please upload a valid .srt file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseSRT(e.target.result);
      if (!parsed.length) {
        alert('No valid subtitle entries found.');
        return;
      }
      setEntries(parsed);
      setFileName(file.name);
      setProgress({});
      setAudioMap({});
      setFinalURL(null);
      // Auto-set video length from last entry end time
      const lastEnd = parsed[parsed.length - 1].end;
      setVideoLen(lastEnd.toFixed(2));
    };
    reader.readAsText(file);
  }, []);

  const onFileInput  = (e)  => loadSRT(e.target.files[0]);
  const onDrop       = (e)  => {
    e.preventDefault();
    setIsDragging(false);
    loadSRT(e.dataTransfer.files[0]);
  };
  const onDragOver   = (e) => { e.preventDefault(); setIsDragging(true);  };
  const onDragLeave  = ()  => setIsDragging(false);

  // ── Single entry TTS ──────────────────────────────────────────────────────────
  const generateEntry = async (entry) => {
    setProgress(p => ({ ...p, [entry.index]: 'generating' }));
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: entry.text, voice, apiKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'TTS failed');
      setAudioMap(m => ({ ...m, [entry.index]: data.audio }));
      setProgress(p => ({ ...p, [entry.index]: 'done' }));
    } catch (err) {
      setProgress(p => ({ ...p, [entry.index]: 'error' }));
      console.error(err);
    }
  };

  // ── Generate all entries ──────────────────────────────────────────────────────
  const generateAll = async () => {
    if (!apiKey) { alert('Please enter your Gemini API key first.'); return; }
    setGenerating(true);
    setFinalURL(null);
    for (const entry of entries) {
      await generateEntry(entry);
    }
    setGenerating(false);
  };

  // ── Preview single audio ──────────────────────────────────────────────────────
  const previewEntry = (entry) => {
    const b64 = audioMap[entry.index];
    if (!b64) return;
    const bStr = atob(b64);
    const bytes = new Uint8Array(bStr.length);
    for (let i = 0; i < bStr.length; i++) bytes[i] = bStr.charCodeAt(i);
    // Build minimal WAV from raw PCM
    const pcm16 = new Int16Array(bytes.buffer);
    const wav   = buildRawWAV(pcm16);
    const url   = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    if (previewURL) URL.revokeObjectURL(previewURL);
    setPreviewURL(url);
    setTimeout(() => audioRef.current?.play(), 50);
  };

  function buildRawWAV(pcm16) {
    const SR = 24000;
    const buf = new ArrayBuffer(44 + pcm16.length * 2);
    const v   = new DataView(buf);
    const ws  = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0,  'RIFF'); v.setUint32(4,  36 + pcm16.length * 2, true);
    ws(8,  'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true);
    v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, pcm16.length * 2, true);
    new Int16Array(buf, 44).set(pcm16);
    return buf;
  }

  // ── Stitch & export ───────────────────────────────────────────────────────────
  const handleStitch = async () => {
    const totalSecs = parseFloat(videoLen);
    if (isNaN(totalSecs) || totalSecs <= 0) {
      alert('Please enter a valid video length in seconds.');
      return;
    }
    setStitching(true);
    try {
      const wav = await stitchAudio(entries, audioMap, totalSecs);
      if (finalURL) URL.revokeObjectURL(finalURL);
      const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
      setFinalURL(url);
    } catch (err) {
      console.error(err);
      alert('Audio stitching failed: ' + err.message);
    }
    setStitching(false);
  };

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const doneCount  = entries.filter(e => progress[e.index] === 'done').length;
  const allDone    = entries.length > 0 && doneCount === entries.length;
  const anyDone    = doneCount > 0;

  const baseName = fileName.replace(/\.srt$/i, '') || 'voiceover';

  return (
    <div className="min-h-screen bg-bg text-text font-body">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="relative border-b border-border overflow-hidden scanlines">
        <div className="absolute inset-0 bg-gradient-to-r from-amber/5 via-transparent to-teal/5 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-mono tracking-[0.3em] text-amber/70 mb-1">GEMINI TTS ✦ TIMELINE SYNC</p>
            <h1 className="font-display text-5xl leading-none text-text tracking-wide">
              SRT VOICE SYNC
            </h1>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 text-[11px] font-mono text-muted">
            <span>24 kHz · 16-bit PCM · WAV export</span>
            <span className="text-amber/60">gemini-2.5-flash-preview-tts</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Config row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* API Key */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
            <label className="text-[11px] font-mono tracking-widest text-amber/70 block">
              GEMINI API KEY
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => handleKeyChange(e.target.value)}
                placeholder="AIza…"
                className="flex-1 bg-panel border border-border rounded-lg px-3 py-2 text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:border-amber/60 transition-colors"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="px-3 py-2 text-[11px] font-mono text-muted hover:text-amber border border-border rounded-lg transition-colors"
              >
                {showKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <p className="text-[10px] text-muted">Saved to localStorage · never sent to server directly</p>
          </div>

          {/* Voice + Video length */}
          <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div>
              <label className="text-[11px] font-mono tracking-widest text-amber/70 block mb-2">
                VOICE
              </label>
              <select
                value={voice}
                onChange={e => setVoice(e.target.value)}
                className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-amber/60 transition-colors"
              >
                {VOICES.map(v => (
                  <option key={v.id} value={v.id}>{v.label} — {v.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-mono tracking-widest text-amber/70 block mb-2">
                VIDEO LENGTH (seconds)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={videoLen}
                onChange={e => setVideoLen(e.target.value)}
                placeholder="auto-filled from SRT"
                className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-sm font-mono text-text placeholder:text-muted focus:outline-none focus:border-amber/60 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* ── SRT Upload zone ─────────────────────────────────────────────────── */}
        <div
          className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer
            ${isDragging ? 'drop-active' : 'border-border hover:border-amber/30'}
            ${entries.length ? 'p-4' : 'p-10'}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".srt"
            className="hidden"
            onChange={onFileInput}
          />

          {entries.length === 0 ? (
            <div className="text-center space-y-3 pointer-events-none">
              <div className="text-5xl">🎬</div>
              <p className="text-text text-base font-medium">Drop your .srt file here</p>
              <p className="text-textDim text-sm">or click to browse</p>
            </div>
          ) : (
            <div className="flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-sm font-mono text-amber">{fileName}</p>
                  <p className="text-xs text-muted">{entries.length} subtitle entries loaded</p>
                </div>
              </div>
              <span className="text-xs font-mono text-muted border border-border px-2 py-1 rounded-lg">
                click to reload
              </span>
            </div>
          )}
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────────────── */}
        {entries.length > 0 && (
          <div className="space-y-3">

            {/* Header row */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl tracking-wide text-text">
                SUBTITLE TIMELINE
              </h2>
              <div className="flex items-center gap-3">
                {generating && <WaveIcon />}
                <span className="text-xs font-mono text-textDim">
                  {doneCount} / {entries.length} ready
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {entries.length > 0 && (
              <div className="h-1 bg-panel rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber rounded-full progress-fill"
                  style={{ width: `${(doneCount / entries.length) * 100}%` }}
                />
              </div>
            )}

            {/* Table */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-[10px] font-mono tracking-widest text-muted uppercase">
                      <th className="text-left px-4 py-3 w-10">#</th>
                      <th className="text-left px-4 py-3">START</th>
                      <th className="text-left px-4 py-3">END</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">DUR</th>
                      <th className="text-left px-4 py-3">TEXT</th>
                      <th className="text-center px-4 py-3">STATUS</th>
                      <th className="text-center px-4 py-3">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const status  = progress[entry.index] || 'idle';
                      const isDone  = status === 'done';
                      const isGen   = status === 'generating';
                      const dur     = (entry.end - entry.start).toFixed(1);

                      return (
                        <tr
                          key={entry.index}
                          className={`row-enter border-b border-border/50 last:border-0 transition-colors
                            ${isGen ? 'bg-amber/5' : 'hover:bg-panel/60'}`}
                          style={{ animationDelay: `${i * 0.03}s` }}
                        >
                          <td className="px-4 py-3 font-mono text-muted text-xs">{entry.index}</td>
                          <td className="px-4 py-3 font-mono text-xs text-amber/80 whitespace-nowrap">
                            {formatShort(entry.start)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-amber/60 whitespace-nowrap">
                            {formatShort(entry.end)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-muted hidden sm:table-cell">
                            {dur}s
                          </td>
                          <td className="px-4 py-3 text-text max-w-xs">
                            <span className="line-clamp-2 text-sm leading-snug">{entry.text}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              {/* Regenerate */}
                              <button
                                onClick={() => generateEntry(entry)}
                                disabled={generating || isGen}
                                title="Generate TTS for this entry"
                                className="text-[11px] font-mono px-2 py-1 border border-border rounded hover:border-amber/50 hover:text-amber text-muted transition-colors disabled:opacity-30"
                              >
                                {isGen ? '…' : '▶ GEN'}
                              </button>
                              {/* Preview */}
                              {isDone && (
                                <button
                                  onClick={() => previewEntry(entry)}
                                  title="Preview audio"
                                  className="text-[11px] font-mono px-2 py-1 border border-teal/30 rounded hover:border-teal hover:text-teal text-teal/60 transition-colors"
                                >
                                  ♪
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Hidden audio for single-entry preview */}
            {previewURL && (
              <audio ref={audioRef} src={previewURL} controls className="w-full h-9 opacity-80" />
            )}

            {/* ── Action bar ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-3 pt-2">

              {/* Generate All */}
              <button
                onClick={generateAll}
                disabled={generating || !apiKey}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm tracking-wide transition-all
                  ${generating || !apiKey
                    ? 'bg-panel text-muted border border-border cursor-not-allowed'
                    : 'bg-amber text-bg hover:bg-amber/90 active:scale-95'}`}
              >
                {generating ? (
                  <><WaveIcon /> <span>GENERATING…</span></>
                ) : (
                  <><span className="text-base">▶</span> <span>GENERATE ALL ({entries.length})</span></>
                )}
              </button>

              {/* Stitch */}
              {anyDone && (
                <button
                  onClick={handleStitch}
                  disabled={stitching || generating}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-mono text-sm tracking-wide border transition-all
                    ${stitching || generating
                      ? 'border-border text-muted cursor-not-allowed'
                      : 'border-teal/50 text-teal hover:bg-teal/10 active:scale-95'}`}
                >
                  {stitching ? '⏳ STITCHING…' : `⬡ STITCH & EXPORT WAV (${doneCount}/${entries.length})`}
                </button>
              )}
            </div>

            {/* ── Final output ─────────────────────────────────────────────── */}
            {finalURL && (
              <div className="bg-surface border border-teal/30 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex gap-[3px] items-end h-5">
                    {[10, 14, 8, 16, 12].map((h, i) => (
                      <span
                        key={i}
                        className="inline-block bg-teal rounded-sm"
                        style={{ width: 3, height: h }}
                      />
                    ))}
                  </div>
                  <h3 className="font-display text-xl text-teal tracking-wide">SYNCED AUDIO READY</h3>
                </div>
                <audio src={finalURL} controls className="w-full" />
                <div className="flex flex-wrap gap-3">
                  <a
                    href={finalURL}
                    download={`${baseName}_voiceover.wav`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal/10 border border-teal/50 text-teal rounded-lg font-mono text-sm hover:bg-teal/20 transition-colors"
                  >
                    ↓ DOWNLOAD WAV
                  </a>
                  <div className="flex items-center text-xs font-mono text-muted gap-2">
                    <span className="text-amber/60">✦</span>
                    <span>Duration: {parseFloat(videoLen).toFixed(1)}s · 24 kHz mono · 16-bit PCM</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Empty state hint ──────────────────────────────────────────────────── */}
        {entries.length === 0 && (
          <div className="text-center py-10 space-y-2 text-muted">
            <p className="font-mono text-xs tracking-widest">HOW IT WORKS</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-textDim">
              <span>① Upload .srt file</span>
              <span className="text-amber/30 hidden sm:inline">→</span>
              <span>② Add Gemini API key</span>
              <span className="text-amber/30 hidden sm:inline">→</span>
              <span>③ Generate TTS per entry</span>
              <span className="text-amber/30 hidden sm:inline">→</span>
              <span>④ Stitch to timeline → download WAV</span>
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border mt-16 py-6 text-center">
        <p className="text-[11px] font-mono text-muted tracking-widest">
          SRT VOICE SYNC · POWERED BY GEMINI 2.5 FLASH TTS
        </p>
      </footer>

    </div>
  );
}
