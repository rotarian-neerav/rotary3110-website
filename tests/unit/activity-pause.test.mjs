// Pause activity form (owner, 24 Nov 2026): one switch in the Sheet closes the activity and event form, the website
// hides every button and link to it (its short link and the posting guide open the home page), and the quiet-club
// reminders stop. Reopen puts it all back.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { before, test } from 'node:test';
import { createGoogleEnv } from '../helpers/google-mock.mjs';
import { bundleCode } from '../../tools/bundle-apps-script.mjs';
import { core } from '../../lib/core.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
let env;
const setting = (k) => env.main.rows('settings').find((r) => r.key === k)?.value;
const activityForm = () => env.forms[JSON.parse(env.props.get('FORM_IDS')).activity];
const publicData = () => env.run('Core_buildPublicData', { settings: env.main.rows('settings') }, new Date().toISOString(), {});

before(() => {
  env = createGoogleEnv({ sampleJson: readFileSync(resolve(ROOT, 'sample/sample-data.json'), 'utf8') });
  env.load(bundleCode());
  env.run('setup');
});

test('the rule: only "paused" pauses', () => {
  assert.equal(core.Core_activityPaused({ activity_form: 'Paused ' }), true);
  for (const v of ['open', '', undefined, 'off']) assert.equal(core.Core_activityPaused({ activity_form: v }), false);
  assert.equal(core.Core_activityPaused(undefined), false);
});

test('setup adds the setting, open', () => {
  assert.equal(setting('activity_form'), 'open');
  assert.equal(publicData().site.activity_paused, false);
  assert.ok(publicData().forms.activity, 'the form link is published while open');
});

test('Pause activity form closes the form, tells the website and asks for a rebuild; Reopen undoes it', () => {
  env.run('setSetting_', 'rebuild_requested_at', '');
  env.run('pauseActivityForm');
  assert.equal(activityForm().accepting, false);
  assert.equal(setting('activity_form'), 'paused');
  assert.ok(setting('rebuild_requested_at'), 'a rebuild is asked for');
  assert.match(env.alerts.at(-1), /paused/);
  const data = publicData();
  assert.equal(data.site.activity_paused, true);
  assert.equal(data.forms.activity, '', 'no link to the form while paused');
  assert.ok(data.forms.club_profile !== undefined);

  env.run('reopenActivityForm');
  assert.equal(activityForm().accepting, true);
  assert.equal(setting('activity_form'), 'open');
  assert.equal(publicData().site.activity_paused, false);
});

test('Google refusing to close the form: the setting still changes and the owner is told what to do by hand', () => {
  activityForm().refuse = 'close';
  const msg = env.run('setActivityForm_', true);
  assert.match(msg, /Accepting responses off by hand/);
  assert.equal(setting('activity_form'), 'paused');
  activityForm().refuse = null;
  env.run('setActivityForm_', false);
});

test('while paused, no quiet-club email and no reminders on the desk', () => {
  env.run('setSetting_', 'activity_form', 'paused');
  const n = env.mails.length;
  assert.equal(env.run('notPostingReport'), 0);
  env.run('sendNotPostingNow');
  assert.equal(env.mails.length, n, 'nothing sent');
  assert.match(env.alerts.at(-1), /Not sent: the activity form is paused/);
  assert.throws(() => env.run('deskNudge_', { views: { clubs: true }, email: 'm@example.com' }, env.main.rows('clubs')[0].club_id, 'email'), /paused/);
  env.run('setSetting_', 'activity_form', 'open');
  env.run('notPostingReport');
  assert.equal(env.mails.length, n + 1, 'sent again once reopened');
});
