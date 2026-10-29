// Groq TTS using serverless proxy /api/tts
// Client contains ZERO API keys

const DEFAULT_VOICE = 'Thunder-PlayAI';
let currentAudio: HTMLAudioElement | null = null;

/**
 * Speaks text using serverless Groq TTS proxy (/api/tts).
 * Returns true if successful, false if unavailable (so caller falls back to window.speechSynthesis).
 */
export async function speakWithGroq(
    text: string,
    onStart: () => void,
    onEnd: () => void,
    onError: (e: unknown) => void,
    voice: string = DEFAULT_VOICE
): Promise<boolean> {
    const cleanText = (text || '').trim();
    if (!cleanText) return false;

    // Stop any currently playing audio
    stopGroqTTS();

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: cleanText,
                voice,
            }),
        });

        if (!response.ok) {
            console.warn('[TTS] /api/tts responded with status:', response.status);
            return false;
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudio = audio;

        audio.onplay = () => {
            onStart();
        };

        audio.onended = () => {
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
        console.warn('[TTS] Groq TTS unavailable, falling back:', e);
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
