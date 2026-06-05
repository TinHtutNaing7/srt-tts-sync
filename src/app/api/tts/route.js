import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash-preview-tts';

export async function POST(request) {
  try {
    const { text, voice, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required.' }, { status: 400 });
    }
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: text.trim() }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice || 'Kore',
            },
          },
        },
      },
    };

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      const message = err?.error?.message || `Gemini API error ${geminiRes.status}`;
      return NextResponse.json({ error: message }, { status: geminiRes.status });
    }

    const data = await geminiRes.json();
    const audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audio) {
      return NextResponse.json({ error: 'No audio returned from Gemini.' }, { status: 500 });
    }

    return NextResponse.json({ audio });
  } catch (err) {
    console.error('[TTS API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
