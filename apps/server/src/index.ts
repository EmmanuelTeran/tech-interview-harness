import express from 'express';
import http from 'http';
import cors from 'cors';
import WebSocket, { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { INTERVIEWER_SYSTEM_PROMPT } from './prompts/interviewer';
import { executeCode } from './runners/codeRunner';

dotenv.config();

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY no está configurada");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint para ejecutar el código en el Sandbox de WSL2
app.post('/api/run', async (req, res) => {
  const { code, language } = req.body;
  if (!code || !language) {
    return res.status(400).json({ error: 'Código y lenguaje requeridos' });
  }

  try {
    const result = await executeCode(code, language);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const GEMINI_LIVE_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

wss.on('connection', (clientWs: WebSocket) => {
  console.log('[WS] Cliente conectado');
  const geminiWs = new WebSocket(GEMINI_LIVE_URL);

  // Variables de diagnóstico y métricas
  let lastAudioSentTime = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  geminiWs.on('open', () => {
    console.log('[Gemini] Sesión Live iniciada');
    const setupMessage = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio-latest",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Fenrir" }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: INTERVIEWER_SYSTEM_PROMPT }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setupMessage));
  });

  clientWs.on('message', (data: WebSocket.RawData) => {
    if (geminiWs.readyState !== WebSocket.OPEN) return;

    try {
      const parsed = JSON.parse(data.toString());

      // 1. Chunks de Audio entrantes
      if (parsed.realtimeInput) {
        lastAudioSentTime = Date.now(); // Marca de tiempo del último chunk enviado
        geminiWs.send(JSON.stringify(parsed));
      } 
      // 2. Inyección de Código / Texto de Pruebas a la conversación
      else if (parsed.clientContent) {
        geminiWs.send(JSON.stringify(parsed));
      }
    } catch {
      geminiWs.send(data);
    }
  });

  geminiWs.on('message', (data: WebSocket.RawData) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data.toString());
    }

    // Inspección de métricas recibidas de Gemini
    try {
      const response = JSON.parse(data.toString());

      // 1. Cálculo de latencia del primer fragmento de audio tras hablar
      if (lastAudioSentTime > 0 && response.serverContent?.modelTurn?.parts) {
        const latency = Date.now() - lastAudioSentTime;
        console.log(`[Métrica] Latencia de respuesta de audio: ${latency} ms`);
        lastAudioSentTime = 0; // Reiniciar hasta el próximo turno de entrada
      }

      // 2. Extracción de tokens consumidos
      if (response.usageMetadata) {
        const { promptTokenCount, candidatesTokenCount, totalTokenCount } = response.usageMetadata;
        totalInputTokens = promptTokenCount || totalInputTokens;
        totalOutputTokens = candidatesTokenCount || totalOutputTokens;

        console.log(`[Consumo] Tokens entrada: ${totalInputTokens} | Tokens salida: ${totalOutputTokens} | Total: ${totalTokenCount}`);
      }
    } catch {
      // Ignorar de ser necesario
    }
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`[Gemini] Desconectado: ${code} - ${reason?.toString() || ''}`);
    console.log(`[Resumen Sesión] Consumo final acumulado: Entrada ~${totalInputTokens} tokens | Salida ~${totalOutputTokens} tokens`);
    clientWs.close();
  });
  geminiWs.on('error', (err) => console.error('[Gemini] Error:', err));
  clientWs.on('close', () => geminiWs.close());
});

server.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});