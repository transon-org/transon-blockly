// autopilot-editor.mjs — v2 Act III (standalone editor, hands-on tour) + Act IV.3 (self-hosting).
//
// Records the reference host as ONE continuous 1920×1080 take, paced to the narration beat durations
// in out/audio/timings.json. Assembly slices it via act3-meta.json cumulative bounds. Act IV.3 is a
// second take. One warm engine for the whole take (record only after "Engine: ready").
//
// Blockly labels use NBSP ( ) between words — the finders normalize it so multi-word terms match.
// Usage: node autopilot-editor.mjs [baseURL]  (default http://localhost:5173). Run AFTER `make audio`.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = new URL('out/video/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const timingsPath = new URL('out/audio/timings.json', import.meta.url).pathname;
const timings = existsSync(timingsPath) ? JSON.parse(readFileSync(timingsPath, 'utf8')) : [];
const durOf = (id) => timings.find((t) => t.id === id)?.duration ?? 4;

const G_PALETTE =
  '/@fs' + new URL('../../packages/editor-core/src/codec/generators/G_palette.json', import.meta.url).pathname;

const EX = {
  swap: 'RecipeSwapKeysAndValues',
  variety: 'RecipeMapCodeToLabel',
  dense: 'WorkedExampleReshapeRecords',
};

const browser = await chromium.launch({ headless: true });

async function newRecordingPage() {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept()); // never hang on a native confirm() (e.g. New)
  const ctxStart = Date.now();
  await page.goto(BASE);
  await page.waitForFunction(() => /Engine:\s*ready/.test(document.body.innerText), null, { timeout: 90_000 });
  await page.waitForTimeout(600);
  return { ctx, page, ctxStart };
}

// Center of an on-canvas block whose label contains `text` (NBSP-normalized; excludes the flyout).
async function blockBox(page, text, which = 'last') {
  const box = await page.evaluate(
    ({ t, which }) => {
      const norm = (s) => s.replace(/\u00A0/g, ' ');
      const hits = [...document.querySelectorAll('.blocklyDraggable')]
        .filter((d) => !d.closest('.blocklyFlyout'))
        .filter((d) => [...d.querySelectorAll('.blocklyText')].some((e) => norm(e.textContent).includes(t)));
      const el = which === 'first' ? hits[0] : hits[hits.length - 1];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    { t: text, which },
  );
  if (!box) throw new Error(`canvas block "${text}" not found`);
  return box;
}

// Center of the first palette (flyout) block whose title starts with `text`.
async function flyoutBox(page, text) {
  return page.evaluate((t) => {
    const norm = (s) => s.replace(/\u00A0/g, ' ').trim();
    const d = [...document.querySelectorAll('.blocklyFlyout .blocklyDraggable')].find((d) => {
      const e = d.querySelector('.blocklyText');
      return e && norm(e.textContent).startsWith(t);
    });
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, text);
}

async function drag(page, from, to, ms = 1300) {
  const steps = Math.round(ms / 16);
  await page.mouse.move(from.x, from.y, { steps: 20 });
  await page.mouse.down();
  await page.waitForTimeout(50);
  for (let i = 1; i <= steps; i++) {
    const k = 0.5 - Math.cos((i / steps) * Math.PI) / 2;
    await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(50);
  await page.mouse.up();
}

// Drag a palette block onto the canvas at `to` (best-effort — logs and continues if not found).
async function dragOut(page, label, to) {
  const from = await flyoutBox(page, label);
  if (!from) return console.warn(`palette block "${label}" not found`);
  await drag(page, from, to, 1000);
  await page.waitForTimeout(250);
}

async function loadExample(page, name) {
  await page.getByLabel('Load example').selectOption(name);
  await page.waitForTimeout(500);
}

async function zoomToFit(page) {
  const ctrl = page.locator('.zoomToFit');
  await ctrl.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await ctrl.click({ force: true });
  await page.waitForTimeout(800);
}

const parkEmpty = (page) => page.mouse.move(720, 250, { steps: 15 });

// ---- Act III: one continuous take, paced to beat boundaries -------------------
{
  const { ctx, page, ctxStart } = await newRecordingPage();
  const clock0 = Date.now();
  const offset = (clock0 - ctxStart) / 1000;
  const bounds = {};
  let cum = 0;
  const until = async (sec) => {
    const ms = clock0 + sec * 1000 - Date.now();
    if (ms > 0) await page.waitForTimeout(ms);
  };
  const endBeat = async (id, extra = 0) => {
    cum += durOf(id) + extra;
    await until(cum);
    bounds[id] = +cum.toFixed(2);
  };

  await loadExample(page, EX.swap);

  // III.1 — the full editor: calm wide shot.
  await page.mouse.move(1400, 60, { steps: 25 });
  await page.mouse.move(760, 460, { steps: 30 });
  await endBeat('III.1');

  // III.2 — load examples, timed to the words "Load one, load another" (~45% / ~56% into the beat),
  // not at the beat's start.
  await until(cum + durOf('III.2') * 0.45); // hold on the current example until "Load one"
  await loadExample(page, EX.variety);
  await until(cum + durOf('III.2') * 0.56); // "load another"
  await loadExample(page, EX.swap);
  await endBeat('III.2');

  // III.3 — the palette: scroll the flat block list down and back (show the whole language).
  await page.mouse.move(120, 500, { steps: 15 });
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, 1100);
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, -1800);
  await parkEmpty(page);
  await endBeat('III.3');

  // III.4 — build from scratch: blank canvas, drag blocks out of the palette, then the JSON writes in
  // and the blocks assemble into a connected tree (reliable reverse projection).
  try {
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.waitForTimeout(500);
    await dragOut(page, 'Map', { x: 470, y: 250 });
    await dragOut(page, 'Get attribute', { x: 820, y: 360 });
    await dragOut(page, 'Current value', { x: 560, y: 520 });
    await page.waitForTimeout(500);
    const ta = page.locator('textarea[aria-label="Generated template JSON"]');
    await ta.click();
    await ta.fill('{"$": "map", "key": {"$": "value"}, "value": {"$": "attr", "name": "name"}}');
    await page.waitForTimeout(900); // blocks assemble from the JSON
    await parkEmpty(page);
  } catch (e) {
    console.warn('III.4 build:', e.message);
  }
  await endBeat('III.4');

  // III.5 — live both ways: detach a value block (JSON updates mid-drag) → restore → edit JSON text.
  await loadExample(page, EX.swap);
  {
    const home = await blockBox(page, 'Current value');
    await drag(page, home, { x: home.x + 320, y: home.y + 220 }, 1200);
    await page.waitForTimeout(600);
    await drag(page, await blockBox(page, 'Current value'), home, 1200);
    await page.waitForTimeout(400);
    const ta = page.locator('textarea[aria-label="Generated template JSON"]');
    await ta.click();
    await ta.fill('{"$": "map", "key": {"$": "value"}, "value": {"$": "attr", "name": "code"}}');
    await page.waitForTimeout(600);
  }
  await endBeat('III.5');

  // III.6 — run it: Run → ✓ Output matches expected.
  await loadExample(page, EX.swap);
  await page.getByTestId('btn-run').click();
  await page.waitForSelector('[data-testid="match-indicator"][data-match="match"]', { timeout: 15_000 });
  await endBeat('III.6');

  // III.7 — navigate a big template: wheel-zoom, zoom-to-fit, minimap, pan, collapse/expand.
  await loadExample(page, EX.dense);
  await zoomToFit(page);
  await page.mouse.move(760, 500);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  await drag(page, { x: 760, y: 500 }, { x: 500, y: 360 }, 900);
  await page.waitForTimeout(300);
  {
    const b = await blockBox(page, 'Map', 'first');
    await page.mouse.dblclick(b.x, b.y);
    await page.waitForTimeout(600);
    await page.mouse.dblclick(b.x, b.y);
  }
  await parkEmpty(page);
  await endBeat('III.7');

  // III.8 — grow it in place: +/- inline mutators. The +/- are 14×14 data-URI <image> glyphs in an
  // adjacent [−][+] pair; take the TOP-MOST pair, click + ×2 then − ×1 (verified: grows 351→394px).
  await loadExample(page, EX.dense);
  await page.waitForTimeout(700);
  {
    const findPair = () =>
      page.evaluate(() => {
        const g = [...document.querySelectorAll('.blocklyWorkspace image')]
          .map((im) => {
            const r = im.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
          })
          .filter((v) => v.w >= 10 && v.w <= 22);
        if (g.length < 2) return null;
        g.sort((a, b) => a.y - b.y || a.x - b.x);
        const first = g[0];
        const partner = g.find((v) => v !== first && Math.abs(v.y - first.y) < 6 && Math.abs(v.x - first.x) < 30);
        if (!partner) return null;
        const minus = first.x < partner.x ? first : partner;
        const plus = first.x < partner.x ? partner : first;
        return { plus: { x: plus.x, y: plus.y }, minus: { x: minus.x, y: minus.y } };
      });
    const pair = await findPair();
    if (pair) {
      await page.mouse.click(pair.plus.x, pair.plus.y);
      await page.waitForTimeout(500);
      await page.mouse.click(pair.plus.x, pair.plus.y);
      await page.waitForTimeout(500);
      const p2 = await findPair();
      if (p2) await page.mouse.click(p2.minus.x, p2.minus.y);
      await page.waitForTimeout(500);
    } else {
      console.warn('III.8: +/- glyph pair not located');
    }
  }
  await parkEmpty(page);
  await endBeat('III.8');

  // III.9 — the scale shot: zoom-to-fit the densest example, hold on empty canvas.
  await loadExample(page, EX.dense);
  await page.waitForTimeout(1000);
  await zoomToFit(page);
  await parkEmpty(page);
  await endBeat('III.9', 0.4);

  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), `${OUT}act3.webm`);
  writeFileSync(`${OUT}act3-meta.json`, JSON.stringify({ offset: +offset.toFixed(2), bounds }, null, 2));
  console.log(`act3.webm  offset=${offset.toFixed(2)}s  bounds=`, bounds);
}

// ---- Act IV.3: the editor opens its own palette generator, then zoom-to-fit ---
{
  const { ctx, page, ctxStart } = await newRecordingPage();
  const clock0 = Date.now();
  const offset = (clock0 - ctxStart) / 1000;
  await page.evaluate(async (path) => {
    const text = await (await fetch(path)).text();
    const ta = document.querySelector('textarea[aria-label="Generated template JSON"]');
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, text);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, G_PALETTE);
  await page.waitForFunction(() => document.querySelectorAll('.blocklyDraggable').length > 100, null, {
    timeout: 20_000,
  });
  await page.waitForTimeout(600);
  await zoomToFit(page);
  await page.mouse.move(960, 540, { steps: 20 });
  const dur = durOf('IV.3') + 1;
  await page.waitForTimeout(dur * 1000);
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), `${OUT}act4.webm`);
  writeFileSync(`${OUT}act4-meta.json`, JSON.stringify({ offset: +offset.toFixed(2), duration: +dur.toFixed(2) }, null, 2));
  console.log(`act4.webm  offset=${offset.toFixed(2)}s`);
}

await browser.close();
