import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function cacheKey(version, provider, model, task, input) {
  return createHash('sha256')
    .update(JSON.stringify([version, provider, model, task, input]))
    .digest('hex');
}

export function createCache(dir) {
  const file = dir ? join(dir, 'cache.json') : null;
  const map = new Map();
  if (file) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      for (const [k, v] of Object.entries(data)) map.set(k, v);
    } catch {
      map.clear();
    }
  }
  function persist() {
    if (!file) return;
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, JSON.stringify(Object.fromEntries(map)));
    } catch {
      return;
    }
  }
  return {
    get(key) {
      return map.get(key);
    },
    set(key, value) {
      map.set(key, value);
      persist();
    },
    size() {
      return map.size;
    },
    clear() {
      map.clear();
      persist();
    }
  };
}
