import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { createService } from '../server.js';
import { ProviderError } from '../providers.js';
import { samplesDir } from './helpers.js';

test('warm up reads every sample, including the new ones', async () => {
  const svc = createService({
    persist: false,
    env: { DATA_DIR: 'unused', SAMPLES_DIR: samplesDir },
    callProvider: async () => {
      throw new ProviderError('The provider is not reachable', 'unreachable');
    }
  });
  const r = await svc.handle('POST', '/warm', null);
  const files = readdirSync(samplesDir).filter((f) => f.endsWith('.txt')).sort();
  assert.ok(files.length >= 9);
  assert.deepEqual(r.json.samples.map((x) => x.file), files);
  for (const f of ['06_courier_blue_dune.txt', '07_land_oasis_build.txt', '08_sea_fcl_harbor_light.txt', '09_incomplete_weight_cedar_point.txt']) {
    assert.ok(r.json.samples.find((x) => x.file === f)?.ok, f);
  }
});
