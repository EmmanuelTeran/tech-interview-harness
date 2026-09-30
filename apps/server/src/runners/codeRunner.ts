import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export async function executeCode(code: string, language: string): Promise<RunResult> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-run-'));
  const startTime = Date.now();

  let filename = '';
  let command = '';

  switch (language) {
    case 'python':
      filename = path.join(tempDir, 'solution.py');
      await fs.writeFile(filename, code);
      command = `python3 "${filename}"`;
      break;
    case 'javascript':
    case 'typescript':
      filename = path.join(tempDir, 'solution.js');
      await fs.writeFile(filename, code);
      command = `node "${filename}"`;
      break;
    default:
      throw new Error(`Lenguaje ${language} no soportado en el sandbox.`);
  }

  return new Promise((resolve) => {
    // Timeout estricto de 5 segundos para prevenir bucles infinitos (O(n!) o while(true))
    exec(command, { timeout: 5000 }, async (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      
      // Limpieza de archivos temporales
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignorar error de limpieza
      }

      if (error && error.killed) {
        resolve({
          stdout: '',
          stderr: 'Time Limit Exceeded (TLE): La ejecución superó los 5 segundos.',
          exitCode: 124,
          durationMs
        });
        return;
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim() || (error ? error.message : ''),
        exitCode: typeof error?.code === 'number' ? error.code : (error ? 1 : 0),
        durationMs
      });
    });
  });
}