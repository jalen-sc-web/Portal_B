import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(__dirname, '../../src/db');

function getJsFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => path.join(dir, entry.name));
}

describe('Contrato de Errores en Capa DB', () => {
  it('todo retorno con error en src/db debe incluir rawError para preservar la traza de OracleDB', () => {
    const returnErrorRegex = /return\s*\{[^}]*\berror\s*:[^}]*\}/gs;
    const violations = [];

    for (const filePath of getJsFiles(DB_DIR)) {
      const content = fs.readFileSync(filePath, 'utf8');
      let match;
      while ((match = returnErrorRegex.exec(content)) !== null) {
        if (!/\brawError\s*:/.test(match[0])) {
          const line = content.slice(0, match.index).split(/\r?\n/).length;
          violations.push(`${path.basename(filePath)}:${line}`);
        }
      }
    }

    expect(
      violations,
      `Retornos { error } sin rawError en src/db:\n${violations.join('\n')}`
    ).toEqual([]);
  });
});
