const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real route with an empty name-classifier result and two SAM masks.
const source = fs.readFileSync(path.join(__dirname, '../app/api/segment/route.ts'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export async function POST', 'async function POST');
let samInput;
let classifierSymbols = [];
const mask = (left) => Array.from({ length: 20 }, (_, y) =>
  Array.from({ length: 20 }, (_, x) => y >= 4 && y < 12 && x >= left && x < left + 3 ? 1 : 0));
const context = {
  console,
  process: { env: { OPENAI_API_KEY: 'test', REPLICATE_API_KEY: 'test' } },
  NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) },
  Replicate: class {
    predictions = { create: async ({ input }) => {
      samInput = input;
      return { status: 'succeeded', output: { results: ['https://test.invalid/masks'] } };
    } };
  },
  fetch: async (url) => ({ ok: true, json: async () => url.includes('/responses')
    ? { output: [{ content: [{ type: 'output_text', text: JSON.stringify({ kind: 'abstract emblem', summary: 'Unfamiliar motif', symbols: classifierSymbols }) }] }] }
    : { masks: [mask(5), mask(11)], scores: [0.93, 0.89] } }),
};
vm.createContext(context);
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2020 }), context);
(async () => {
  const response = await context.POST({ json: async () => ({
    imageDataUrl: 'data:image/png;base64,original',
    manualRegion: { x: 200, y: 100, width: 500, height: 700 },
  }) });
  assert.equal(response.status, 200);
  assert.equal(samInput.image, 'data:image/png;base64,original');
  assert.deepEqual(JSON.parse(samInput.prompts[0]), { positive_boxes: [[0.45, 0.45, 0.5, 0.7]] });
  assert.equal(response.body.symbols.length, 2, 'Separate SAM detections must not be unioned');
  const [first, second] = response.body.symbols;
  assert.equal(first.name, 'Unidentified symbol');
  assert.equal(first.category, 'Detected region');
  assert.equal(first.maskSpans.length, 8);
  assert.deepEqual(Array.from(first.maskSpans[0]), [4, 5, 8]);
  assert.equal(first.boundingBox.x, 250);
  assert.equal(first.boundingBox.width, 150);
  assert.equal(second.boundingBox.x, 550);
  assert.notEqual(first.id, second.id);
  classifierSymbols = [{ name: 'Celtic Knot', visualDescription: 'interwoven figures' }];
  const grouped = await context.POST({ json: async () => ({ imageDataUrl: 'data:image/png;base64,original' }) });
  assert.equal(grouped.body.symbols.length, 2);
  assert.ok(grouped.body.symbols.every(region => region.name === 'Unidentified symbol' && region.category === 'Detected region'), 'A family prompt must not become every mask instance name');
  const invalid = await context.POST({ json: async () => ({ imageDataUrl: 'data:image/png;base64,x', manualRegion: null }) });
  assert.equal(invalid.status, 400);
  console.log('Passed: box-guided detection bypasses naming gate, preserves separate full-image masks, and rejects invalid selections.');
})().catch(error => { console.error(error); process.exitCode = 1; });
