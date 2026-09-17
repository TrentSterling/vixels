// Capture 1200x630 in-engine OG candidates into tools/out/og-*.png. Chrome hidden, canvas fills the frame.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {launch, sleep, until} from './cdp.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type': 'text/html'}); res.end(fs.readFileSync(path.join(root, 'index.html'))); }).listen(0);
const out = path.join(root, 'tools', 'out'); fs.mkdirSync(out, {recursive: true});
const W = 1200, H = 630;
const P = await launch({port: 9472, width: W + 270, height: H + 200});
await P.goto(`http://127.0.0.1:${server.address().port}/`);
await until(() => P.eval('!!window.VIXELS && VIXELS.ready'), {timeout: 60000, label: 'boot'});

// Hide only the in-viewport overlays, then clip the screenshot to the canvas rect (no layout changes).
await P.eval(`for (const s of ['.corner-label','.scene-stat','#toast']) document.querySelectorAll(s).forEach(e => e.style.setProperty('display','none','important')); 1`);
const rect = await P.eval(`(()=>{const r=document.getElementById('view').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
console.log('canvas rect', rect);
const clip = {x: rect.x + (rect.width - W) / 2, y: rect.y + (rect.height - H) / 2, width: W, height: H};
const shot = (file) => P.shotClip(file, clip);
if (rect.width < W || rect.height < H) throw new Error('canvas smaller than OG frame');

// Chunk hero: Fit framing, then a few wheel-zoom steps toward the terrain for tighter candidates.
await P.eval("VIXELS.setMode('chunk'); VIXELS.fit(); VIXELS.render(); 1"); await sleep(200);
await shot(path.join(out, 'og-0-chunk-fit.png'));
const wheel = (dy) => P.eval(`document.getElementById('view').dispatchEvent(new WheelEvent('wheel',{deltaY:${dy},clientX:600,clientY:330,bubbles:true,cancelable:true})); 1`);
for (let i = 1; i <= 3; i++) { await wheel(-120); await sleep(150); await P.eval('VIXELS.render(); 1'); await shot(path.join(out, `og-${i}-chunk-zoom.png`)); }
// Orbit a little (right-drag = pan, left-drag in orbit tool = orbit).
await P.eval("VIXELS.setMode('chunk'); VIXELS.fit(); VIXELS.setTool('orbit'); 1"); await wheel(-120); await wheel(-120);
await P.mouse('mousePressed', 600, 330); await P.mouse('mouseMoved', 520, 300); await P.mouse('mouseReleased', 520, 300); await sleep(150);
await P.eval('VIXELS.render(); 1'); await shot(path.join(out, 'og-4-chunk-orbit.png'));
// Surface macro of a couple materials as alternates.
for (const key of ['stone', 'ore', 'log']) {
  await P.eval(`VIXELS.setMode('surface'); VIXELS.select(${JSON.stringify(key)}); VIXELS.macro(); VIXELS.render(); 1`);
  await sleep(200);
  await shot(path.join(out, `og-surface-${key}.png`));
}
console.log('exceptions', P.logs.filter(l => /EXCEPTION|error/i.test(l)).slice(0, 10));
P.kill(); server.close(); process.exit(0);
