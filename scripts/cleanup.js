#!/usr/bin/env node
/* ==========================================================================
 * Vijeta Wings — automatic expiry cleaner
 *
 * What it does:
 *   - Reads competitions/registry.json
 *   - For every entry whose endDate < TODAY (Asia/Kolkata):
 *       • Deletes the referenced poster image from images/
 *       • Removes the entry from registry.json
 *       • Cleans up any <img ... src="images/...jpg"> lines in index.html
 *         that belonged to that competition (matched by poster filename)
 *
 * Run:
 *   node scripts/cleanup.js                (uses real TODAY)
 *   node scripts/cleanup.js --dry-run     (only reports, deletes nothing)
 *   node scripts/cleanup.js --today=YYYY-MM-DD   (simulate any date)
 *
 * Exit codes: 0 success, 1 bad input, 2 I/O error.
 * ========================================================================== */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REG = path.join(ROOT, 'competitions', 'registry.json');
const IMG_DIR = path.join(ROOT, 'images');
const HTML = path.join(ROOT, 'index.html');

// -------------------------------------------------------------- helpers
function istTodayISO(simulated) {
  // IST = UTC+5:30. We want today's YYYY-MM-DD IN IST.
  const now = simulated
    ? new Date(simulated + 'T00:00:00+05:30')
    : new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60 * 1000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, '0');
  const d = String(ist.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function arg(name, def = '') {
  const m = process.argv.find(a => a.startsWith('--' + name + '='));
  return m ? m.split('=').slice(1).join('=') : def;
}
function hasFlag(name) {
  return process.argv.includes('--' + name);
}

// -------------------------------------------------------------- main
try {
  const today = istTodayISO(arg('today'));
  const dry = hasFlag('dry-run');

  console.log('╭──────────────────────────────────────────────');
  console.log('│ Vijeta Wings — auto expiry cleaner');
  console.log('│ IST today  :', today);
  console.log('│ Dry-run    :', dry ? 'YES (no delete)' : 'NO (real delete)');
  console.log('╰──────────────────────────────────────────────');

  const reg = JSON.parse(fs.readFileSync(REG, 'utf8'));
  const before = reg.competitions.length;

  const survivors = [];
  const removed = [];
  for (const c of reg.competitions) {
    if (c.endDate < today) {
      removed.push(c);
    } else {
      survivors.push(c);
    }
  }

  // summarize plan
  console.log(`\nFound ${removed.length} expired competition(s):`);
  for (const c of removed) {
    console.log(`  · ${c.id.padEnd(22)} endDate=${c.endDate}  poster=${c.poster}`);
  }

  if (removed.length === 0) {
    console.log('\n✅ Nothing expired today — no action needed.');
    process.exit(0);
  }

  if (dry) {
    console.log('\n(dry-run: filenames only, nothing deleted)');
    process.exit(0);
  }

  // delete image files
  console.log('\nDeleting poster files:');
  for (const c of removed) {
    if (!c.poster) { console.log(`  – ${c.id}: no poster`); continue; }
    const fp = path.join(ROOT, c.poster);
    try {
      fs.unlinkSync(fp);
      console.log(`  ✅ ${c.poster}`);
    } catch (e) {
      console.log(`  ⚠️  ${c.poster} → ${e.code || e.message}`);
    }
  }

  // rewrite registry.json (preserve comment keys)
  reg.competitions = survivors;
  fs.writeFileSync(REG, JSON.stringify(reg, null, 2) + '\n');
  console.log(`\n✅ ${REG.split('/').pop()} updated: ${before} → ${survivors.length} entries`);

  // tidy index.html — remove dead <img src="images/<x>" ...> lines for deleted posters
  // (only the bare img references, leaves everything else untouched).
  const deadPosters = new Set(removed.map(c => path.basename(c.poster || '')));
  if (deadPosters.size && fs.existsSync(HTML)) {
    let h = fs.readFileSync(HTML, 'utf8');
    const beforeLen = h.length;
    for (const fn of deadPosters) {
      const safe = fn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      h = h.replace(new RegExp(`<img[^>]*src="images/${safe}"[^>]*>\\s*`, 'g'), '');
      h = h.replace(new RegExp(`<img[^>]*src='images/${safe}'[^>]*>\\s*`, 'g'), '');
    }
    fs.writeFileSync(HTML, h);
    console.log(`✅ index.html cleaned: ${beforeLen - h.length} bytes stripped`);
  }

  console.log('\n🎉 Cleanup complete. Commit & push!');
  process.exit(0);
} catch (e) {
  console.error('❌ cleanup crashed:', e.message);
  process.exit(2);
}
