import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const PORT = (Number.isFinite(cliPort) && cliPort > 0 ? cliPort : Number(process.env.PORT)) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function getGenAi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  const { GoogleGenAI, ThinkingLevel, Type } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return { ai, ThinkingLevel, Type };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('403') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'API key rejected or missing permissions. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Quota exceeded or paid API key required for this model. Select a billing-enabled API key in Settings > Secrets.',
    };
  }
  if (raw.includes('NOT_FOUND') || raw.includes('404')) {
    return {
      status: 404,
      message: `Model endpoint not found: ${raw}`,
    };
  }
  return {
    status: 500,
    message: raw || 'Unexpected server error.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '30mb' }));

  // Fast health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Voice command transcription & conversational AI agent parsing
  app.post('/api/voice/interpret', async (req, res) => {
    try {
      const {
        transcript: rawTranscript,
        audioBase64,
        audioMimeType,
        angleUnit = 'DEG',
        ans = 0,
        conversationHistory = [],
      } = req.body as {
        transcript?: string;
        audioBase64?: string;
        audioMimeType?: string;
        angleUnit?: 'DEG' | 'RAD' | 'GRAD';
        ans?: number;
        conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
      };

      const { ai, ThinkingLevel, Type } = await getGenAi();
      let transcript = (rawTranscript || '').trim();

      if (!transcript && audioBase64) {
        const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
        const transcribeInteraction = await ai.interactions.create({
          model: 'gemini-3.5-transcribe',
          input: [
            {
              type: 'audio',
              data: cleanBase64,
              mime_type: audioMimeType || 'audio/webm',
            },
            {
              type: 'text',
              text: 'Transcribe the spoken audio verbatim in its original language (e.g., Hindi, Hinglish, or English). Do not translate.',
            },
          ],
        });
        transcript = (transcribeInteraction.output_text || '').trim();
      }

      if (!transcript) {
        res.status(400).json({ error: 'No speech or transcript detected.' });
        return;
      }

      const recentContext =
        conversationHistory.length > 0
          ? '\nRecent conversation:\n' +
            conversationHistory
              .slice(-6)
              .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.text}`)
              .join('\n')
          : '';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Active angle mode: ${angleUnit}. Previous answer (ANS): ${ans}.${recentContext}\nCurrent user speech: "${transcript}"`,
        config: {
          systemInstruction:
            'You are a responsive, intelligent conversational AI voice agent built into a scientific calculator and utility workspace.\n' +
            'Understand Hindi, Hinglish, and English seamlessly.\n' +
            'Language rule: If the user speaks Hindi or Hinglish, set replyLanguage="hi" and write spokenSummary in natural, conversational Hindi (Devanagari script). Otherwise set replyLanguage="en" and write spokenSummary in clear English.\n\n' +
            'Choose the best structured action:\n' +
            '- action="calculate": ALWAYS use this when the user asks ANY arithmetic or math calculation (e.g. "2 + 2 कितना होता है", "500 plus 250", "पांच सौ में दो सौ पचास जोड़ो", "sqrt(1728) + sin(45)", "15 का स्क्वायर", "what is 25% of 400"). Return a valid mathjs expression in "expression" (e.g. "2 + 2", "15^2", "400 * 25%"). Trig functions sin, cos, tan, asin, acos, atan automatically respect the active angle mode.\n' +
            '- action="convert": When user asks to convert units (e.g. "convert 50 mph to m/s", "100 किलोमीटर को मील में बदलो"). Populate conversionValue (number), conversionFrom (short symbol/name), conversionTo (short symbol/name), and conversionCategory (one of: length, mass, temperature, time, velocity, area, volume, energy, power, pressure, data, angle, frequency).\n' +
            '- action="graph": When user says "plot ...", "graph ...", "ग्राफ बनाओ ...". Populate graphExpression in terms of x.\n' +
            '- action="clear" | "memory_add" | "memory_recall" | "memory_clear": For calculator memory/clear commands.\n' +
            '- action="reply": For greetings, general non-calculation questions, science/math explanations, formulas, follow-ups, or conversational speech. Keep spokenSummary direct and concise (1–2 sentences, max 40 words). Always write whole numbers as integers (e.g. "4", never "4.0").',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              action: {
                type: Type.STRING,
                enum: [
                  'calculate',
                  'convert',
                  'graph',
                  'clear',
                  'memory_add',
                  'memory_recall',
                  'memory_clear',
                  'reply',
                ],
              },
              replyLanguage: {
                type: Type.STRING,
                enum: ['en', 'hi'],
              },
              expression: { type: Type.STRING },
              conversionCategory: { type: Type.STRING },
              conversionValue: { type: Type.NUMBER },
              conversionFrom: { type: Type.STRING },
              conversionTo: { type: Type.STRING },
              graphExpression: { type: Type.STRING },
              spokenSummary: { type: Type.STRING },
            },
            required: ['action', 'replyLanguage', 'spokenSummary'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        spokenSummary?: string;
        [key: string]: unknown;
      };
      if (typeof parsed.spokenSummary === 'string') {
        parsed.spokenSummary = parsed.spokenSummary.replace(
          /(^|[^.\d])(-?\d+)\.0+(?![.\d])/g,
          '$1$2'
        );
      }
      res.json({ transcript, intent: parsed });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Neural TTS Readout via Gemini Interactions API
  app.post('/api/voice/speak', async (req, res) => {
    try {
      const { text, language } = req.body as { text?: string; language?: string };
      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }

      const cleaned = text
        .trim()
        .replace(/(^|[^.\d])(-?\d+)\.0+(?![.\d])/g, '$1$2');
      const hasDevanagari = /[\u0900-\u097F]/.test(cleaned);
      const speechLang =
        language === 'hi' || language === 'hi-IN' || hasDevanagari ? 'hi-IN' : 'en-US';

      const smallHi: Record<string, string> = {
        '0': 'शून्य', '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार',
        '5': 'पांच', '6': 'छह', '7': 'सात', '8': 'आठ', '9': 'नौ',
        '10': 'दस', '11': 'ग्यारह', '12': 'बारह', '13': 'तेरह', '14': 'चौदह',
        '15': 'पंद्रह', '16': 'सोलह', '17': 'सत्रह', '18': 'अठारह', '19': 'उन्नीस', '20': 'बीस',
      };
      const smallEn: Record<string, string> = {
        '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
        '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
        '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen', '14': 'fourteen',
        '15': 'fifteen', '16': 'sixteen', '17': 'seventeen', '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
      };
      let ttsText = cleaned;
      if (/^-?\d+$/.test(cleaned)) {
        const isNeg = cleaned.startsWith('-');
        const absStr = isNeg ? cleaned.slice(1) : cleaned;
        const word = speechLang === 'hi-IN' ? smallHi[absStr] : smallEn[absStr];
        if (word) {
          ttsText = isNeg ? `${speechLang === 'hi-IN' ? 'माइनस' : 'minus'} ${word}` : word;
        }
      }

      const { ai } = await getGenAi();
      const interaction = await ai.interactions.create({
        model: 'gemini-3.8-flash-lite-tts',
        input: [
          {
            type: 'text',
            text: ttsText,
            annotations: [
              {
                type: 'speech_metadata',
                style:
                  speechLang === 'hi-IN'
                    ? 'Clear, friendly, natural Hindi conversational assistant voice. Speak whole numbers directly without adding point zero.'
                    : 'Clear, friendly, concise voice assistant. Speak whole numbers directly without adding point zero.',
              },
            ],
          },
        ],
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [
            {
              language: speechLang,
              voice: 'Kore',
            },
          ],
        },
      });

      const audio = interaction.output_audio;
      if (!audio?.data) {
        res.status(502).json({ error: 'No audio returned from speech model.' });
        return;
      }

      res.json({
        audioBase64: audio.data,
        mimeType: audio.mime_type || 'audio/wav',
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (!isProd) {
    const viteMiddlewarePromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        }).then((vite) => vite.middlewares)
      )
      .catch((err) => {
        console.error('Vite dev middleware failed to initialize:', err);
        throw err;
      });
    app.use((req, res, next) => {
      viteMiddlewarePromise
        .then((middlewares) => middlewares(req, res, next))
        .catch(next);
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Axiom Lab server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
