// The member-requests panel (apps-script/Sidebar.html) must reach the server functions the way
// Google's google.script.run expects: each call made on the runner object itself.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync(resolve(import.meta.dirname, '../../apps-script/Sidebar.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function makeRunner(calls, results) {
  // Like Google's runner: methods only work when called on the runner ("this")
  function Runner(ok, fail) { this.ok = ok; this.fail = fail; }
  Runner.prototype.withSuccessHandler = function (f) { return new Runner(f, this.fail); };
  Runner.prototype.withFailureHandler = function (f) { return new Runner(this.ok, f); };
  for (const fn of ['getMemberRequests', 'approveConsent', 'approveRemoval', 'rejectRequest']) {
    Runner.prototype[fn] = function (...args) {
      if (!(this instanceof Runner)) throw new TypeError('google.script.run method called without its runner');
      calls.push([fn, ...args]);
      this.ok(results[fn]);
    };
  }
  return new Runner();
}

test('Approve, Remove and Reject buttons reach the server', () => {
  const calls = [];
  const msg = { textContent: '', style: {} };
  const out = { innerHTML: '' };
  const tick = { checked: true };
  const ctx = {
    google: { script: { run: makeRunner(calls, {
      getMemberRequests: { consent: [{ id: 'CON-0001', name: 'XYZ1', club: 'RC Aligarh', filledBy: 'The member', match: 'new', choices: ['Photo'], warnings: [], needsConfirm: true }], removal: [{ id: 'REM-0001', name: 'XYZ', club: 'RC Aligarh', items: 'Birthday', match: 'm' }], waiting: [] },
      approveConsent: 'Approved CON-0001', approveRemoval: 'Removed', rejectRequest: 'Rejected',
    }) } },
    document: { getElementById: (id) => (id === 'msg' ? msg : id === 'ok-CON-0001' ? tick : out) },
    prompt: () => 'not suitable',
  };
  vm.createContext(ctx);
  vm.runInContext(script, ctx);
  assert.match(out.innerHTML, /CON-0001/, 'panel lists the request');
  vm.runInContext("approveOne('CON-0001')", ctx);
  assert.equal(msg.textContent, 'Approved CON-0001');
  vm.runInContext("act('approveRemoval', ['REM-0001'])", ctx);
  vm.runInContext("reject('consent', 'CON-0001')", ctx);
  assert.deepEqual(calls.filter((c) => c[0] !== 'getMemberRequests'), [
    ['approveConsent', 'CON-0001', true], ['approveRemoval', 'REM-0001'], ['rejectRequest', 'consent', 'CON-0001', 'not suitable'],
  ]);
  // the buttons in the panel call act(...) with the right names
  assert.match(out.innerHTML, /approveOne\('CON-0001'\)/);
  assert.match(out.innerHTML, /id="ok-CON-0001"/, 'with the confirmation tick');
  assert.match(out.innerHTML, /act\('approveRemoval', \['REM-0001'\]\)/);
});
