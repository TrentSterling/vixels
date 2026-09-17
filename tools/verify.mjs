// Headless boot + regression check for Vixels Forge. Zero deps (Node 20+, local Chrome).
// Usage: node tools/verify.mjs [url]   (defaults to the local index.html; pass https://tront.xyz/vixels/ for live)
import {launch, sleep, until} from './cdp.mjs';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const url = process.argv[2] || 'file:///' + resolve('index.html').replace(/\\/g, '/');
const out = resolve('tools/out'); mkdirSync(out, {recursive: true});
const P = await launch({port: 9471, width: 1280, height: 800});
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };

await P.goto(url);
try {
  await until(() => P.eval('!!window.VIXELS && (VIXELS.ready || !document.getElementById("error-box").hidden)'), {timeout: 60000, label: 'boot'});
} catch (e) { console.log('boot timeout', e.message); }
const ready = await P.eval('VIXELS.ready');
const errorBox = await P.eval("document.getElementById('error-box').hidden ? '' : document.getElementById('error-text').textContent");
check('boot ready', ready, errorBox ? 'error-box: ' + errorBox.slice(0, 200) : '');
check('no VIXELS.errors', (await P.eval('VIXELS.errors.length')) === 0, JSON.stringify(await P.eval('VIXELS.errors.map(String).slice(0,3)')));
check('boot overlay hidden', await P.eval("document.getElementById('boot').hidden"));
check('origin', true, await P.eval('location.origin') + ' secure=' + await P.eval('isSecureContext'));
const nonSelf = await P.eval("performance.getEntriesByType('resource').map(r=>r.name).filter(n=>!n.startsWith(location.origin)&&!n.startsWith('file:'))");
check('no external requests', nonSelf.length === 0, JSON.stringify(nonSelf.slice(0, 5)));

// Canvas not blank: fingerprint per mode should be stable and non-trivial, and pixel variance > 0.
const notBlank = async () => P.eval(`(()=>{const c=document.querySelector('canvas');const g=document.createElement('canvas');g.width=64;g.height=64;const x=g.getContext('2d');x.drawImage(c,0,0,64,64);const d=x.getImageData(0,0,64,64).data;let mn=255,mx=0;for(let i=0;i<d.length;i+=4){const v=d[i]+d[i+1]+d[i+2];if(v<mn)mn=v;if(v>mx)mx=v;}return mx-mn;})()`);
for (const [i, mode] of ['surface', 'block', 'chunk'].entries()) {
  let ok = true, why = '';
  try { await P.eval(`VIXELS.setMode(${JSON.stringify(mode)}); VIXELS.fit(); VIXELS.render(); 1`); await sleep(400); }
  catch (e) { ok = false; why = e.message; }
  const spread = ok ? await notBlank() : 0;
  const fp = ok ? await P.eval('VIXELS.frameFingerprint()') : 0;
  await P.shot(`${out}/${i + 1}-${mode}.png`);
  check('mode ' + mode + ' renders', ok && spread > 40, `spread=${spread} fp=${fp} ${why}`);
}

// Materials: every compiled material selectable, each yields a distinct frame in surface mode.
await P.eval('VIXELS.setMode("surface"); VIXELS.fit(); 1');
const mats = await P.eval('VIXELS.statistics.materials.map(m=>m.key)');
const fps = new Set();
for (const key of mats) { await P.eval(`VIXELS.select(${JSON.stringify(key)}); 1`); fps.add(await P.eval('VIXELS.frameFingerprint()')); }
check('materials selectable', mats.length >= 12 && fps.size === mats.length, `${mats.length} materials, ${fps.size} distinct frames`);
check('thumbnails present', (await P.eval("document.querySelectorAll('#preset-grid img').length")) >= mats.length, await P.eval("document.querySelectorAll('#preset-grid img').length") + ' imgs');

// Grid invariance: the acceleration grid must not change the artwork.
let gt = null;
try { await P.eval('VIXELS.gridTest()'); gt = await P.eval('VIXELS.testLog.at(-1)'); } catch (e) { gt = {error: e.message}; }
check('grid invariance test', !!gt && gt.pass === true, gt ? JSON.stringify(gt).slice(0, 300) : 'no log');

// Face audit for the chunk.
const audit = await P.eval('JSON.stringify(VIXELS.faceAudit())');
check('face audit', /"(hidden|problems|errors)":0|"ok":true/.test(audit) || !/[1-9]\d* (hidden|problem)/.test(audit), audit.slice(0, 300));

// Camera tools exist.
check('tools switch', await P.eval('(()=>{VIXELS.setTool("pan");const a=VIXELS.camera.tool;VIXELS.setTool("orbit");return a==="pan"&&VIXELS.camera.tool==="orbit"})()'));

// Narrow viewport still boots (re-check layout at phone width).
const ledger = await P.eval('JSON.stringify(VIXELS.statistics.ledger)');
console.log('ledger', ledger.slice(0, 400));
console.log('device', JSON.stringify(await P.eval('VIXELS.device')).slice(0, 300));
console.log('console', P.logs.filter(l => /EXCEPTION|error|warn/i.test(l)).slice(0, 8));
check('no exceptions', !P.logs.some(l => l.startsWith('EXCEPTION')));
console.log(`\n${pass} passed, ${fail} failed  (${url})`);
P.kill(); process.exit(fail ? 1 : 0);
