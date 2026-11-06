import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const samplesDir = join(here, '..', '..', 'samples');

export function loadSamples() {
  const out = {};
  let files = [];
  try {
    files = readdirSync(samplesDir).filter((f) => f.endsWith('.txt')).sort();
  } catch {
    files = [];
  }
  for (const f of files) {
    const raw = readFileSync(join(samplesDir, f), 'utf8').replace(/\r\n/g, '\n');
    const i = raw.indexOf('\n\n');
    const head = raw.slice(0, i);
    const get = (n) => (new RegExp(`^${n}:[ \\t]*(.*)$`, 'im').exec(head) || [])[1] || '';
    out[f.slice(0, 2)] = { from: get('From'), to: get('To'), subject: get('Subject'), body: raw.slice(i + 2) };
  }
  return out;
}
