// Groq TTS using PlayAI (Orpheus English) model
// Docs: https://console.groq.com/docs/text-speech

const GROQ_API_KEY: string =
    (typeof import.meta !== 'undefined' &&
        (import.meta as any).env &&
        (import.meta as any).env.VITE_GROQ_API_KEY)
        ? (import.meta as any).env.VITE_GROQ_API_KEY
        : '';

const GROQ_TTS_URL = 'https://api.groq.com/openai/v1/audio/speech';

// Best voice for an authoritative AI interviewer: deep, measured, professional
const DEFAULT_VOICE = 'Fritz-PlayAI';
const TTS_MODEL = 'playai-tts';

let currentAudio: HTMLAudioElement | null = null;

/**
 * Speaks text using Groq's Orpheus/PlayAI TTS.
 * Returns true if successful, false if unavailable (so caller can fallback).
 */
export async function speakWithGroq(
    text: string,
    onStart: () => void,
    onEnd: () => void,
    onError: (e: unknown) => void,
    voice: string = DEFAULT_VOICE
): Promise<boolean> {
    if (!GROQ_API_KEY || !text.trim()) return false;

    // Stop any currently playing audio
    stopGroqTTS();

    try {
        console.log('[TTS] Requesting Groq TTS with voice:', voice);

        const response = await fetch(GROQ_TTS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: TTS_MODEL,
                input: text,
                voice,
                response_format: 'mp3',
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[TTS] Groq TTS error:', response.status, err);
            return false;
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudio = audio;

        audio.onplay = () => {
            console.log('[TTS] Groq TTS playing');
            onStart();
        };

        audio.onended = () => {
            console.log('[TTS] Groq TTS finished');
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            onEnd();
        };

        audio.onerror = (e) => {
            console.error('[TTS] Audio playback error:', e);
            URL.revokeObjectURL(audioUrl);
            currentAudio = null;
            onError(e);
        };

        await audio.play();
        return true;
    } catch (e) {
        console.error('[TTS] Groq TTS failed:', e);
        return false;
    }
}

/** Immediately stops any active Groq TTS playback. */
export function stopGroqTTS(): void {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
    }
}
