import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { useLiveSession } from './hooks/useLiveSession';
import { Mic, MicOff, Play, Send, Clock, Terminal } from 'lucide-react';

const INITIAL_CODE = `# You can ask the interviewer for clarification before coding.
# Function signature:
def two_sum(nums: list[int], target: int) -> list[int]:
    # Write your solution here
    pass

# Quick test run:
if __name__ == "__main__":
    print("Result:", two_sum([2, 7, 11, 15], 9))
`;

export default function App() {
  const { isConnected, startSession, endSession, sendCodeContext } = useLiveSession();
  const [code, setCode] = useState(INITIAL_CODE);
  const [language, setLanguage] = useState('python');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45 * 60);

  // Temporizador de 45 minutos de entrevista
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running test suite...');
    try {
      const res = await fetch('http://localhost:4000/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language })
      });
      const data = await res.json();
      const outputText = data.stderr ? `Error:\n${data.stderr}` : `Output (${data.durationMs}ms):\n${data.stdout}`;
      setOutput(outputText);
      return outputText;
    } catch (err: any) {
      const errText = `Failed to execute: ${err.message}`;
      setOutput(errText);
      return errText;
    } finally {
      setIsRunning(false);
    }
  };

  const handleShareWithInterviewer = async () => {
    const currentOutput = await handleRunCode();
    sendCodeContext(code, language, currentOutput);
  };

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Panel Izquierdo: Problema, Voz y Temporizador */}
      <div className="w-2/5 border-r border-neutral-800 flex flex-col p-6 justify-between">
        <div>
          {/* Header & Cronómetro */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
            <h1 className="text-xl font-bold tracking-tight text-neutral-200">
              Live DSA Interview
            </h1>
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-md text-amber-400 font-mono text-sm">
              <Clock size={16} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Enunciado de ejemplo */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-neutral-100">1. Two Sum</h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Given an array of integers <code className="bg-neutral-800 px-1 rounded text-amber-300">nums</code> and an integer <code className="bg-neutral-800 px-1 rounded text-amber-300">target</code>, return indices of the two numbers such that they add up to target.
            </p>
            <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-md text-xs font-mono text-neutral-400">
              <p className="text-neutral-200 font-semibold mb-1">Constraints:</p>
              <p>• 2 &lt;= nums.length &lt;= 10⁴</p>
              <p>• -10⁹ &lt;= nums[i] &lt;= 10⁹</p>
              <p>• Exactly one valid answer exists.</p>
            </div>
          </div>
        </div>

        {/* Control del Entrevistador */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
            <span className="text-xs uppercase tracking-wider text-neutral-400 font-semibold">
              {isConnected ? 'Interviewer Connected (Voice Live)' : 'Interviewer Offline'}
            </span>
          </div>

          <button
            onClick={isConnected ? endSession : startSession}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isConnected
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isConnected ? <><MicOff size={18} /> End Interview</> : <><Mic size={18} /> Start Voice Session</>}
          </button>
        </div>
      </div>

      {/* Panel Derecho: Monaco Editor + Consola */}
      <div className="w-3/5 flex flex-col h-full bg-[#1e1e1e]">
        {/* Barra superior de herramientas */}
        <div className="h-12 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-neutral-800 text-xs border border-neutral-700 rounded px-2.5 py-1 text-neutral-200 focus:outline-none"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunCode}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-medium transition-colors"
            >
              <Play size={14} className="text-emerald-400" /> Run Code
            </button>
            <button
              onClick={handleShareWithInterviewer}
              disabled={!isConnected || isRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors"
            >
              <Send size={14} /> Submit & Discuss
            </button>
          </div>
        </div>

        {/* Editor de código */}
        <div className="flex-1">
          <Editor
            height="100%"
            language={language}
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4
            }}
          />
        </div>

        {/* Consola de Salida de Pruebas */}
        <div className="h-44 border-t border-neutral-800 bg-neutral-950 flex flex-col">
          <div className="px-4 py-1.5 border-b border-neutral-900 flex items-center gap-2 text-xs text-neutral-400 font-mono">
            <Terminal size={14} /> Console / Test Results
          </div>
          <pre className="flex-1 p-3 font-mono text-xs text-neutral-300 overflow-y-auto whitespace-pre-wrap">
            {output || 'No output. Click "Run Code" to test your solution.'}
          </pre>
        </div>
      </div>
    </div>
  );
}