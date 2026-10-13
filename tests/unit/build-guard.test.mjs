// The build itself must stop when the public data is unsafe (brief, section 13).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { core, plain } from '../../lib/core.mjs';

const sample = JSON.parse(readFileSync(new URL('../../sample/sample-data.json', import.meta.url), 'utf8'));
const script = new URL('../../scripts/validate-public.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dir = mkdtempSync(join(tmpdir(), 'rotary-guard-'));

function runGuard(data) {
  const file = join(dir, `data-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(data));
  return spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
}
const fresh = () => plain(core.Core_buildPublicData(sample.main, '2026-10-13T00:00:00Z'));

test('guard passes good data', () => {
  const r = runGuard(fresh());
  assert.equal(r.status, 0, r.stderr);
});

test('guard stops the build on a birth year', () => {
  const d = fresh();
  d.members.find((m) => m.birthday).birthday = '1975-10-14';
  const r = runGuard(d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /PRIVACY CHECK FAILED/);
});

test('guard stops the build on a member who has not opted in', () => {
  const d = fresh();
  d.members.push({ public_key: 'kx', name: 'Rtn Not Opted In', club_id: 'S-001', directory_ok: false, photo_ok: false, birthday_ok: false });
  const r = runGuard(d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not opted in/);
});

test('guard stops the build on a phone number anywhere', () => {
  const d = fresh();
  d.clubs[0].meeting = 'Call Rajesh on 9876543210';
  const r = runGuard(d);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /phone number/);
});
