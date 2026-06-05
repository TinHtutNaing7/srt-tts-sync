/**
 * Stitches TTS audio segments into a single WAV file aligned to SRT timestamps.
 *
 * @param {Array}  entries     - Parsed SRT entries: { index, start, end, text }
 * @param {Object} audioMap    - Map of entry.index -> base64 PCM string (L16, 24kHz, mono)
 * @param {number} totalSecs   - Total video/audio duration in seconds
 * @returns {ArrayBuffer}      - WAV file as ArrayBuffer
 */
export async function stitchAudio(entries, audioMap, totalSecs) {
  const SAMPLE_RATE = 24000;
  const totalSamples = Math.ceil(totalSecs * SAMPLE_RATE);

  const ctx = new OfflineAudioContext(1, totalSamples, SAMPLE_RATE);

  for (const entry of entries) {
    const b64 = audioMap[entry.index];
    if (!b64) continue;

    // Decode base64 → Uint8Array → Int16Array → Float32Array
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768.0;
    }

    // Clip to segment duration so segments don't bleed into each other
    const segMaxSamples = Math.ceil((entry.end - entry.start) * SAMPLE_RATE);
    const usedSamples = Math.min(float32.length, segMaxSamples);

    const buffer = ctx.createBuffer(1, usedSamples, SAMPLE_RATE);
    buffer.copyToChannel(float32.subarray(0, usedSamples), 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    // Schedule at the SRT start time
    source.start(entry.start);
  }

  const rendered = await ctx.startRendering();
  return encodeWAV(rendered);
}

/**
 * Encodes an AudioBuffer as a WAV ArrayBuffer (16-bit PCM).
 */
function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = samples.length * 2;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0,  'RIFF');
  view.setUint32(4,  36 + dataSize,  true);
  writeStr(view, 8,  'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16,             true); // chunk size
  view.setUint16(20, 1,              true); // PCM format
  view.setUint16(22, numChannels,    true);
  view.setUint32(24, sampleRate,     true);
  view.setUint32(28, byteRate,       true);
  view.setUint16(32, blockAlign,     true);
  view.setUint16(34, 16,             true); // bits per sample
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize,       true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return buffer;
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
