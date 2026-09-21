import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { INTERVIEWER_SYSTEM_PROMPT } from './prompts/interviewer';

dotenv.config();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY no está definida en el archivo .env");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const GEMINI_LIVE_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

wss.on('connection', (clientWs: WebSocket) => {
  console.log('[WS] Cliente conectado desde el frontend');

  // Abrir conexión contra Gemini Multimodal Live API
  const geminiWs = new WebSocket(GEMINI_LIVE_URL);
  
  // Variables de diagnóstico y métricas
  let lastAudioSentTime = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  geminiWs.on('open', () => {
    console.log('[Gemini] Conectado a Gemini Live API');

    // Mensaje de inicialización obligatorio (Handshake de configuración)
    const setupMessage = {
      setup: {
        model: "models/gemini-2.5-flash-native-audio-latest",
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Fenrir" // Opciones: Aoede, Charon, Fenrir, Kore, Puck
              }
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

  // Reenviar audio/comandos recibidos del frontend hacia Gemini
  clientWs.on('message', (data: WebSocket.RawData) => {
    if (geminiWs.readyState === WebSocket.OPEN) {
      try {
        const parsed = JSON.parse(data.toString());
        
        // Si el cliente envía audio en Base64
        if (parsed.realtimeInput) {
          lastAudioSentTime = Date.now(); // Marca de tiempo del último chunk enviado
          geminiWs.send(JSON.stringify(parsed));
        }
      } catch {
        // En caso de que se envíen buffers binarios directos
        geminiWs.send(data);
      }
    }
  });

  // Reenviar respuestas de audio desde Gemini hacia el frontend
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
      // Ignorar buffers binarios puros si aplican
    }
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`[Gemini] Desconectado: ${code} - ${reason.toString()}`);
    console.log(`[Resumen Sesión] Consumo final acumulado: Entrada ~${totalInputTokens} tokens | Salida ~${totalOutputTokens} tokens`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  geminiWs.on('error', (err) => {
    console.error('[Gemini] Error:', err);
  });

  clientWs.on('close', () => {
    console.log('[WS] Cliente desconectado');
    if (geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});