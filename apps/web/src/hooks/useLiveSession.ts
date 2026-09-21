import { useState, useRef, useCallback } from 'react';
import { float32ToInt16, arrayBufferToBase64, AudioChunkPlayer } from '../utils/audioStream';

export function useLiveSession() {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioPlayerRef = useRef<AudioChunkPlayer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startSession = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;

      const ws = new WebSocket('ws://localhost:4000');
      wsRef.current = ws;
      audioPlayerRef.current = new AudioChunkPlayer();

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Conectado al servidor de entrevistas');

        // Captura de audio a 16kHz
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = float32ToInt16(inputData);
          const base64Audio = arrayBufferToBase64(pcm16.buffer);

          const payload = {
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio
                }
              ]
            }
          };
          ws.send(JSON.stringify(payload));
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          const parts = response.serverContent?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                audioPlayerRef.current?.playChunk(part.inlineData.data);
              }
            }
          }
        } catch (err) {
          console.error("Error procesando audio del modelo:", err);
        }
      };

      ws.onclose = () => {
        endSession();
      };

    } catch (err) {
      console.error("No se pudo iniciar la sesión:", err);
    }
  }, []);

  const endSession = useCallback(() => {
    setIsConnected(false);
    wsRef.current?.close();
    audioPlayerRef.current?.close();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach(track => track.stop());
    wsRef.current = null;
    audioPlayerRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
  }, []);

  return { isConnected, startSession, endSession };
}