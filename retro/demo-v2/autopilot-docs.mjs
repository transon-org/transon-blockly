// autopilot-docs.mjs — v2 Act II (the docs site). ONE continuous 1920×1080 take paced to the II.*
// narration durations in out/audio/timings.json; assembly slices it (act2-meta.json offset).
//
// Beats: II.1 scroll the docs catalog (editor NOT yet shown) · II.2 open an example (expand to
// input/template/result JSON, then "Open in Visual Editor" — the editor mount is TIMED to land on the
// word "opens") · II.3 hold on the swap · II.4 flip four recipes via the in-editor dropdown · II.5 hold.
//
// Reuses the docs page's OWN PyScript runtime (RFC-005) — no second Pyodide.
// Usage: node autopilot-docs.mjs [baseURL]  (default http://localhost:4173). Run AFTER `make audio`.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const OUT = new URL('out/video/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const timingsPath = new URL('out/audio/timings.json', import.meta.url).pathname;
const timings = existsSync(timingsPath) ? JSON.parse(readFileSync(timingsPath, 'utf8')) : [];
const durOf = (id) => timings.find((t) => t.id === id)?.duration ?? 6;

const SWAP_ID = 'recipe-RecipeSwapKeysAndValues'; // <label for=…> in the docs (ExamplesSection slug)
const FLIP = [
  'RecipePluckFieldFromEach',
  'RecipeDefaultForMissingField',
  'RecipeJoinListToString',
  'RecipeKeepItemsMatchingCondition',
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
});
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());

const ctxStart = Date.now();
await page.goto(BASE);
await page.waitForFunction(
  (id) => typeof window.transon_transform === 'function' && !!document.querySelector(`label[for="${id}"]`),
  SWAP_ID,
  { timeout: 150_000 },
);
await page.evaluate(() => window.scrollTo({ top: 0 }));
await page.waitForTimeout(600);

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

// II.1 — scroll the docs catalog and land on the LISTS the narration names: first the Worked-examples
// section, then the Recipes section (its example-button list), ending near the swap recipe for II.2.
{
  const yOf = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      return el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80) : 0;
    }, sel);
  const yWorked = await yOf('#worked-examples');
  const yRecipes = await yOf('#recipes');
  const d = durOf('II.1');
  const smoothTo = async (fromY, toY, fromT, toT, steps) => {
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((y) => window.scrollTo({ top: y }), Math.round(fromY + ((toY - fromY) * i) / steps));
      await until(cum + fromT + ((toT - fromT) * i) / steps);
    }
  };
  await smoothTo(0, yWorked, 0, d * 0.5, 20); // → the worked-examples list
  await smoothTo(yWorked, yRecipes, d * 0.5, d, 18); // → the recipes list (ends near the swap recipe)
  cum += d;
  bounds['II.1'] = +cum.toFixed(2);
}

// II.2 — open one: expand the recipe (shows input/template/result JSON), hold, then "Open in Visual
// Editor" so the editor mounts on the word "opens" (~55% into the beat).
{
  await page.locator(`label[for="${SWAP_ID}"]`).scrollIntoViewIfNeeded();
  await page.locator(`label[for="${SWAP_ID}"]`).click();
  await page.waitForTimeout(1300); // the 3-panel Monaco view expands + settles
  await until(cum + durOf('II.2') * 0.5); // hold on the raw JSON while narration sets up
  await page.getByRole('button', { name: 'Open in Visual Editor' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.blocklyDraggable').length > 0, null, {
    timeout: 30_000,
  });
  cum += durOf('II.2');
  await until(cum);
  bounds['II.2'] = +cum.toFixed(2);
}

// II.3 — the first transformation: hold on the three swap blocks + live output.
await page.mouse.move(760, 460, { steps: 30 });
await endBeat('II.3');

// II.4 — flip through four visibly-different recipes via the in-editor dropdown (autorun each).
{
  const select = page.getByLabel('Load example');
  const per = Math.max(1.2, (durOf('II.4') - 0.4) / FLIP.length);
  for (const name of FLIP) {
    await select.selectOption(name).catch(() => console.warn(`II.4: example ${name} not in dropdown`));
    await until(cum + per - 0.1);
    cum += per;
  }
  bounds['II.4'] = +cum.toFixed(2);
  await until(cum);
}

// II.5 — calm hold on the last example.
await page.mouse.move(960, 540, { steps: 20 });
await endBeat('II.5', 0.4);

const video = page.video();
await ctx.close();
renameSync(await video.path(), `${OUT}act2.webm`);
writeFileSync(`${OUT}act2-meta.json`, JSON.stringify({ offset: +offset.toFixed(2), bounds }, null, 2));
console.log(`act2.webm  offset=${offset.toFixed(2)}s  bounds=`, bounds);

await browser.close();
