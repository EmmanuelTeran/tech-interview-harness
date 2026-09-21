import { useLiveSession } from './hooks/useLiveSession';
import { Mic, MicOff } from 'lucide-react';

export default function App() {
  const { isConnected, startSession, endSession } = useLiveSession();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">Technical Interview Harness</h1>
      <p className="text-neutral-400 mb-8">Ponte tus audífonos y habla en inglés para iniciar la sesión técnica.</p>

      <button
        onClick={isConnected ? endSession : startSession}
        className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-colors ${
          isConnected 
            ? 'bg-red-600 hover:bg-red-700 text-white' 
            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {isConnected ? (
          <>
            <MicOff size={20} /> Terminar Entrevista
          </>
        ) : (
          <>
            <Mic size={20} /> Iniciar Entrevista en Vivo
          </>
        )}
      </button>

      {isConnected && (
        <div className="mt-6 flex items-center gap-2 text-sm text-emerald-400">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Voz bidireccional activa
        </div>
      )}
    </div>
  );
}