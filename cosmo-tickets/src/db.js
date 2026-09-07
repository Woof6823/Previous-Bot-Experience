const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');

function defaultState() {
  return {

    counters: {},

    active: {},

    byChannel: {},
  };
}

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState(), null, 2));
  }
}

function readStateRaw() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);


    return {
      counters: parsed.counters && typeof parsed.counters === 'object' ? parsed.counters : {},
      active: parsed.active && typeof parsed.active === 'object' ? parsed.active : {},
      byChannel: parsed.byChannel && typeof parsed.byChannel === 'object' ? parsed.byChannel : {},
    };
  } catch (err) {
    console.error('[db] Failed to read/parse tickets.json, recovering with empty state:', err);
    const fresh = defaultState();
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}

function writeStateRaw(state) {


  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}




let queue = Promise.resolve();


function mutate(fn) {
  const result = queue.then(async () => {
    const state = readStateRaw();
    const output = await fn(state);
    writeStateRaw(state);
    return output;
  });


  queue = result.catch(() => {});
  return result;
}

function getState() {
  return readStateRaw();
}

module.exports = { getState, mutate };
