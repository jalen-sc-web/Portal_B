import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, '../../src');
const ALLOWED_FILES = new Set([
  path.normalize(path.join(SRC_DIR, 'utils', 'logger.js')),
]);

function getJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path.normalize(fullPath));
    }
  }
  return files;
}

describe('Arquitectura de Observabilidad - Uso exclusivo de LokiLogger', () => {
  it('no debe existir uso directo de console.* fuera de src/utils/logger.js', () => {
    const consoleRegex = /\bconsole\.(log|warn|error|info|debug)\b/;
    const violations = [];

    for (const filePath of getJsFiles(SRC_DIR)) {
      if (ALLOWED_FILES.has(filePath)) continue;

      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (consoleRegex.test(line)) {
          violations.push(`${path.relative(SRC_DIR, filePath)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    expect(violations, `Se encontraron llamadas directas a console.*:\n${violations.join('\n')}`).toEqual([]);
  });
});
