// A small stand-in for Google's Apps Script services, enough to run the Sheet script's logic in Node.
// Spreadsheets are plain 2D arrays; Forms, triggers and UI calls are recorded rather than performed.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/** Returns a callable object where any method call returns itself, for builder-style APIs. */
function chain(overrides = {}) {
  const proxy = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop in overrides) return overrides[prop];
      if (prop === 'then') return undefined;
      return () => proxy;
    },
    apply() { return proxy; },
  });
  return proxy;
}

class FakeRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
  getRow() { return this.row; }
  getNumRows() { return this.numRows; }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) line.push(this.sheet.cell(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    values.forEach((line, r) => line.forEach((v, c) => this.sheet.set(this.row + r, this.col + c, v)));
    return this;
  }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  clearContent() {
    for (let r = 0; r < this.numRows; r++) for (let c = 0; c < this.numCols; c++) this.sheet.set(this.row + r, this.col + c, '');
    this.sheet.trim();
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setDataValidation() { return this; }
  setNumberFormat() { return this; }
}

class FakeSheet {
  constructor(name) { this.name = name; this.data = []; this.formUrl = null; this.maxCols = 26; }
  cell(r, c) { return (this.data[r - 1] || [])[c - 1] ?? ''; }
  set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    const row = this.data[r - 1];
    while (row.length < c) row.push('');
    row[c - 1] = v;
  }
  trim() {
    while (this.data.length && this.data[this.data.length - 1].every((v) => v === '' || v == null)) this.data.pop();
  }
  getName() { return this.name; }
  setName(n) { this.name = n; return this; }
  getLastRow() { this.trim(); return this.data.length; }
  getLastColumn() { return this.data.reduce((m, r) => { let n = r.length; while (n && (r[n - 1] === '' || r[n - 1] == null)) n--; return Math.max(m, n); }, 0); }
  getMaxRows() { return 1000; }
  getMaxColumns() { return Math.max(this.maxCols, this.getLastColumn()); }
  insertColumnsAfter(_after, n) { this.maxCols += n; }
  getRange(r, c, nr, nc) { return new FakeRange(this, r, c, nr, nc); }
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  appendRow(values) { const r = this.getLastRow() + 1; values.forEach((v, i) => this.set(r, i + 1, v)); }
  setFrozenRows() {}
  getProtections() { return []; }
  protect() { return chain(); }
  getFormUrl() { return this.formUrl; }
  getActiveRangeList() { return { getRanges: () => this.selection || [] }; }
  select(fromRow, numRows = 1) { this.selection = [new FakeRange(this, fromRow, 1, numRows, 1)]; }
}

class FakeSpreadsheet {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = [new FakeSheet('Sheet1')]; }
  getId() { return this.id; }
  getName() { return this.name; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  getSheets() { return this.sheets; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  /** test helper: rows of a tab as objects */
  rows(n) {
    const sh = this.getSheetByName(n);
    const [h, ...rest] = sh.data;
    return rest.filter((r) => r.some((v) => v !== '' && v != null)).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
  }
}

export function createGoogleEnv({ sampleJson, mainId = 'MAIN', privateId = '1WA3KHpFQ1Bvh0eZun1_Rlile1gXUN0u9FOkItjScoxI' } = {}) {
  const main = new FakeSpreadsheet(mainId, '3110Website');
  const priv = new FakeSpreadsheet(privateId, 'Private sheet for Full Members List');
  const props = new Map();
  const cache = new Map();
  const mails = [];
  const alerts = [];
  const prompts = [];
  const triggers = [];
  const trashed = [];
  const forms = {};
  let activeSheet = null;
  let activeUser = 'moderator.a@example.com';
  let formSeq = 0;
  const files = new Map(); // drive id -> { name, bytes }
  const sharing = new Map();

  const ui = {
    alert: (...a) => { alerts.push(a.join(' | ')); return 'YES'; },
    prompt: () => {
      const text = prompts.shift() ?? '';
      return { getSelectedButton: () => 'OK', getResponseText: () => text };
    },
    createMenu: () => chain(),
    showSidebar: () => {},
    Button: { OK: 'OK', YES: 'YES', NO: 'NO' },
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO' },
  };

  const folder = (id, name) => ({
    getId: () => id,
    getName: () => name,
    getFiles: () => {
      const list = [...files.entries()].filter(([, f]) => f.folder === id).map(([fid, f]) => ({ getId: () => fid, getName: () => f.name }));
      return { hasNext: () => list.length > 0, next: () => list.shift() };
    },
    getFoldersByName: (n) => {
      const found = n === 'MemberPhotos' && sharing.has('folder:MemberPhotos') ? [folder('PHOTOS', 'MemberPhotos')] : [];
      return { hasNext: () => found.length > 0, next: () => found.shift() };
    },
    createFolder: (n) => { sharing.set('folder:' + n, 'PRIVATE'); return folder('PHOTOS', n); },
    getSharingAccess: () => sharing.get(id) || 'PRIVATE',
    setSharing: (a) => sharing.set(id, a),
  });

  const google = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => main,
      openById: (id) => (id === privateId ? priv : id === mainId ? main : (() => { throw new Error('No spreadsheet ' + id); })()),
      getUi: () => ui,
      getActiveSheet: () => activeSheet,
      flush: () => {},
      newDataValidation: () => chain(),
      ProtectionType: { SHEET: 'SHEET' },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getActiveUser: () => ({ getEmail: () => activeUser }), getEffectiveUser: () => ({ getEmail: () => 'rotarian.neerav@gmail.com' }) },
    Utilities: {
      getUuid: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, () => Math.floor(Math.random() * 16).toString(16)),
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    },
    Logger: { log: () => {} },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => sampleJson }) },
    ContentService: { createTextOutput: (s) => ({ setMimeType: () => ({ content: s }) }), MimeType: { JSON: 'JSON' } },
    HtmlService: { createTemplateFromFile: () => chain() },
    ScriptApp: {
      getProjectTriggers: () => triggers,
      newTrigger: (fn) => chain({ forForm: (id) => chain({ onFormSubmit: () => chain({ create: () => triggers.push({ getHandlerFunction: () => fn, getTriggerSourceId: () => id }) }) }), timeBased: () => chain({ create: () => triggers.push({ getHandlerFunction: () => fn, getTriggerSourceId: () => '' }) }) }),
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TEST/exec' }),
    },
    DriveApp: {
      Access: { PRIVATE: 'PRIVATE', ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
      Permission: { NONE: 'NONE', VIEW: 'VIEW' },
      getFileById: (id) => ({
        getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folder('PARENT', '3110Website'); } }; },
        getName: () => (files.get(id)?.name || id),
        getSharingAccess: () => sharing.get(id) || 'ANYONE_WITH_LINK',
        setSharing: (a) => sharing.set(id, a),
        setTrashed: () => trashed.push(id),
        getBlob: () => ({ getContentType: () => 'image/jpeg', getBytes: () => files.get(id)?.bytes || Buffer.from('jpg') }),
        getThumbnail: () => ({ getContentType: () => 'image/png', getBytes: () => Buffer.from('png') }),
      }),
      getFolderById: (id) => folder(id, 'folder'),
    },
    FormApp: {
      create: (title) => {
        const id = `FORM${++formSeq}`;
        forms[id] = title;
        // the response tab appears in the destination spreadsheet
        return chain({
          getId: () => id,
          getPublishedUrl: () => `https://docs.google.com/forms/d/e/${id}/viewform`,
          setDestination: (_t, ssId) => { const ss = ssId === privateId ? priv : main; const sh = ss.insertSheet('Form Responses ' + formSeq); sh.formUrl = `https://docs.google.com/forms/d/${id}/edit`; },
          getItems: () => [chain(), chain(), chain({ asListItem: () => chain() }), chain()],
        });
      },
      openById: (id) => { if (!forms[id]) throw new Error('no form'); return chain({ getId: () => id, getPublishedUrl: () => `https://docs.google.com/forms/d/e/${id}/viewform`, getItems: () => [] }); },
      createTextValidation: () => chain(),
      createParagraphTextValidation: () => chain(),
      DestinationType: { SPREADSHEET: 'SPREADSHEET' },
      PageNavigationType: { SUBMIT: 'SUBMIT' },
      ItemType: { LIST: 'LIST', CHECKBOX: 'CHECKBOX' },
    },
  };

  const context = vm.createContext({ ...google, console });
  return {
    context,
    main,
    priv,
    props,
    mails,
    alerts,
    prompts,
    trashed,
    files,
    sharing,
    triggers,
    load(code) { vm.runInContext(code, context, { filename: 'Code.gs' }); },
    run(fn, ...args) { return context[fn](...args); },
    setActive(tab, row, numRows = 1) { activeSheet = main.getSheetByName(tab); activeSheet.select(row, numRows); },
    setUser(email) { activeUser = email; },
    /** Simulates a Google Form submission with answers given as {question title: answer}. */
    submit(formKey, answers, email = 'secretary@example.com') {
      const ids = JSON.parse(props.get('FORM_IDS'));
      context.onAnyFormSubmit({
        source: { getId: () => ids[formKey] },
        response: {
          getTimestamp: () => new Date('2026-10-13T10:00:00Z'),
          getRespondentEmail: () => email,
          getItemResponses: () => Object.entries(answers).map(([title, value]) => ({ getItem: () => ({ getTitle: () => title }), getResponse: () => value })),
        },
      });
    },
    doGet(params) {
      const out = context.doGet({ parameter: params });
      return JSON.parse(out.content);
    },
  };
}

export function readSample(path) {
  return readFileSync(path, 'utf8');
}
