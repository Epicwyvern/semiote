import { NextResponse } from 'next/server';
import Replicate, { type Prediction } from 'replicate';

const MODEL = 'vufinder/sam3:1bf97763d5dfd3a1584adca913a8ef4b43c684fca97e04e39e4c50a3a5e09650';
const MIN_CONFIDENCE = 0.25;
const MIN_MASK_PIXELS = 16;

type ImageClassification = {
  kind: string;
  summary: string;
  candidateSymbols: Array<{ name: string; visualDescription: string }>;
  source: 'openai' | 'generic';
};

type SegmentConcept = { name: string; prompt: string };
type NormalizedBox = { x: number; y: number; width: number; height: number };

const genericImageClassification: ImageClassification = {
  kind: 'uncertain image type',
  summary: 'Inspecting visual motifs without a predefined symbol list.',
  candidateSymbols: [],
  source: 'generic',
};

type MaskSpan = [number, number, number];
type SamResultFile = {
  masks?: unknown[];
  boxes?: unknown[][];
  scores?: unknown[];
};
type SamPredictionOutput = {
  results?: unknown[];
};
type OpenAIResponse = {
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};
type SymbolRegion = {
  id: string;
  name: string;
  category: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  maskWidth: number;
  maskHeight: number;
  maskSpans: MaskSpan[];
};

async function classifyImage(imageDataUrl: string, focusedSelection = false): Promise<ImageClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return genericImageClassification;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: focusedSelection
                ? `Inspect this user-selected image crop for distinct visual symbols, emblems, glyphs, or stylized motifs. A motif does not need a conventional cultural name: use a short literal visual label such as "Elongated four-pointed star" and describe its visible shape. Do not omit a clearly visible fictional or unfamiliar emblem merely because its name or origin is unknown. Do not invent historical or cultural identities. Exclude ordinary objects, background scenery, selection boundaries, and the crop rectangle itself. If no distinct motif is visible, return an empty symbols array. Return JSON only: {"kind":"short image kind","summary":"short visual description","symbols":[{"name":"literal visual label","visualDescription":"specific shape, color, and distinguishing details"}]}.`
                : `Classify the overall image to guide symbol segmentation. Choose a short image kind such as: isolated emblem, abstract symbol composition, symbol-bearing object or artifact, photograph/scene with symbols, inscription field, or uncertain. Then list up to six distinct symbols that are actually visible and can be named specifically. Return each as {"name":"recognized symbol name","visualDescription":"brief distinguishing visual cues"}. Include common, named symbols and recognizable glyphs. Never list architecture or ordinary objects as symbols: explicitly exclude columns, pillars, walls, arches, lintels, doorways, buildings, temple interiors, generic carvings, and decorative regions unless a specific conventional symbol is depicted on them. A photograph of a temple is not itself a symbol. Do not invent cultural names for uncertain shapes; omit uncertain candidates. If no identifiable symbol is present, return an empty symbols array. Return JSON only: {"kind":"...","summary":"short scene description","symbols":[{"name":"specific candidate name","visualDescription":"distinguishing visible structure"}]}.`,
            },
            { type: 'input_image', image_url: imageDataUrl, detail: 'low' },
          ],
        }],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 350,
      }),
    });

    const result = await response.json() as OpenAIResponse;
    if (!response.ok) throw new Error(result.error?.message || `OpenAI request failed (${response.status})`);

    const raw = result.output
      ?.flatMap((item) => item.content || [])
      .find((content) => content.type === 'output_text')?.text;
    if (!raw) throw new Error('OpenAI returned an empty image classification');

    const parsed = JSON.parse(raw) as { kind?: unknown; summary?: unknown; symbols?: unknown };
    const architecturalLabel = /^(?:architectural elements?|columns?|pillars?|walls?|arches?|lintels?|doorways?|buildings?|temple(?: interior)?|stonework|carved reliefs?|decorative regions?)$/i;
    const candidateSymbols = Array.isArray(parsed.symbols)
      ? parsed.symbols
          .filter((item): item is { name?: unknown; visualDescription?: unknown } => typeof item === 'object' && item !== null)
          .map((item) => ({
            name: typeof item.name === 'string' ? item.name.trim().slice(0, 60) : '',
            visualDescription: typeof item.visualDescription === 'string' ? item.visualDescription.trim().slice(0, 100) : '',
          }))
          .filter((item) => item.name && !architecturalLabel.test(item.name))
          .slice(0, 6)
      : [];

    return {
      kind: typeof parsed.kind === 'string' ? parsed.kind.trim().slice(0, 60) : genericImageClassification.kind,
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 180) : genericImageClassification.summary,
      candidateSymbols,
      source: 'openai',
    };
  } catch (error) {
    console.warn('Image pre-classification unavailable; using a general visual-motif prompt:', (error as Error).message);
    return genericImageClassification;
  }
}

function buildConcepts(classification: ImageClassification, focusedSelection = false): SegmentConcept[] {
  const candidateConcepts = classification.candidateSymbols.map(({ name, visualDescription }) => ({
    name,
    prompt: `the ${focusedSelection ? "visible motif" : "specific named symbol"} "${name}"${visualDescription ? `, identified by these visual features: ${visualDescription}` : ''}; segment the symbol itself, not nearby architecture or the whole scene`,
  }));
  if (focusedSelection) {
    // A conventional-name classifier must never prevent a selected crop from
    // reaching segmentation. Text prompts target visible shapes, not the box.
    return candidateConcepts.length ? candidateConcepts : [{
      name: 'Unidentified motif',
      prompt: 'the distinct foreground emblem, glyph, or stylized symbol; segment its visible strokes and pointed rays, excluding the background and image rectangle',
    }];
  }
  if (classification.source === 'openai') return candidateConcepts;

  return [{ name: 'Visual motif', prompt: 'a distinct foreground symbol, emblem or glyph; segment its visible design, excluding ordinary objects, architecture, background scenery and the image rectangle' }];
}

function maskMatrix(mask: unknown): unknown[][] | null {
  let value = mask;
  while (Array.isArray(value) && value.length === 1 && Array.isArray(value[0]) && Array.isArray(value[0][0])) {
    value = value[0];
  }
  return Array.isArray(value) && Array.isArray(value[0]) ? value as unknown[][] : null;
}

function extractRegions(result: SamResultFile, conceptIndex: number, concepts: SegmentConcept[]): SymbolRegion[] {
  const regions: SymbolRegion[] = [];
  const masks = Array.isArray(result.masks) ? result.masks : [];
  const scores = Array.isArray(result.scores) ? result.scores : [];

  masks.forEach((rawMask, detectionIndex) => {
    const confidenceValue = scores[detectionIndex];
    const confidence = typeof confidenceValue === 'number' ? confidenceValue : Number(confidenceValue);
    if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) return;

    const matrix = maskMatrix(rawMask);
    if (!matrix?.length || !matrix[0]?.length) return;

    const height = matrix.length;
    const width = matrix[0].length;
    const spans: MaskSpan[] = [];
    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;
    let pixelCount = 0;

    for (let y = 0; y < height; y++) {
      const row = matrix[y];
      let start = -1;
      for (let x = 0; x <= width; x++) {
        const value = x < width ? Number(row[x]) : 0;
        const filled = value > 0.5;
        if (filled && start === -1) start = x;
        if (!filled && start !== -1) {
          spans.push([y, start, x]);
          left = Math.min(left, start);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y + 1);
          pixelCount += x - start;
          start = -1;
        }
      }
    }

    if (pixelCount < MIN_MASK_PIXELS || right <= left || bottom <= top) return;

    regions.push({
      id: `symbol-${conceptIndex + 1}-${detectionIndex + 1}`,
      name: concepts[conceptIndex].name,
      category: 'Recognized symbol',
      confidence: Math.max(0, Math.min(1, confidence)),
      boundingBox: {
        x: left / width * 1000,
        y: top / height * 1000,
        width: (right - left) / width * 1000,
        height: (bottom - top) / height * 1000,
      },
      maskWidth: width,
      maskHeight: height,
      maskSpans: spans,
    });
  });

  return regions;
}

function intersectionOverUnion(a: SymbolRegion, b: SymbolRegion) {
  const left = Math.max(a.boundingBox.x, b.boundingBox.x);
  const top = Math.max(a.boundingBox.y, b.boundingBox.y);
  const right = Math.min(a.boundingBox.x + a.boundingBox.width, b.boundingBox.x + b.boundingBox.width);
  const bottom = Math.min(a.boundingBox.y + a.boundingBox.height, b.boundingBox.y + b.boundingBox.height);
  const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
  const areaA = a.boundingBox.width * a.boundingBox.height;
  const areaB = b.boundingBox.width * b.boundingBox.height;
  return intersection / (areaA + areaB - intersection || 1);
}

function deduplicateRegions(regions: SymbolRegion[]) {
  const ranked = [...regions].sort((a, b) => b.confidence - a.confidence);
  return ranked.filter((region, index) => !ranked.slice(0, index).some((accepted) => {
    const overlap = intersectionOverUnion(region, accepted);
    const samePromptFamily = region.name === accepted.name;
    return (samePromptFamily && overlap > 0.55) || overlap > 0.85;
  }));
}

async function runSegmentation(imageDataUrl: string, concepts: SegmentConcept[], manualRegion?: NormalizedBox): Promise<SymbolRegion[]> {
  const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
  if (!apiKey) throw new Error('Configure REPLICATE_API_KEY in code/.env.local to enable symbol segmentation.');

  const prompts = manualRegion
    ? [JSON.stringify({ positive_boxes: [[
        (manualRegion.x + manualRegion.width / 2) / 1000,
        (manualRegion.y + manualRegion.height / 2) / 1000,
        manualRegion.width / 1000,
        manualRegion.height / 1000,
      ]] })]
    : concepts.map(({ prompt }) => JSON.stringify({ text: prompt }));

  const replicate = new Replicate({ auth: apiKey, useFileOutput: false });
  replicate.fetch = (url, options) => fetch(url, { ...options, cache: 'no-store' });
  let prediction = await replicate.predictions.create({
    version: MODEL.split(':')[1],
    wait: 60,
    input: {
      image: imageDataUrl,
      prompts,
      confidence_threshold: MIN_CONFIDENCE,
      split_output: true,
      visualize: false,
      offset_masks: false,
      concat_input: false,
      backbone_output: false,
    },
  }) as Prediction;

  if (prediction.status === 'starting' || prediction.status === 'processing') {
    prediction = await replicate.wait(prediction);
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(typeof prediction.error === 'string' ? prediction.error : `SAM-3 prediction ended with status "${prediction.status}"`);
  }
  const output = prediction.output as SamPredictionOutput | undefined;

  if (!Array.isArray(output?.results)) throw new Error('SAM-3 returned no per-concept result files');

  const resultFiles = await Promise.all(output.results.map(async (item) => {
    const url = typeof item === 'string'
      ? item
      : item && typeof item === 'object' && 'url' in item && typeof item.url === 'string'
        ? item.url
        : '';
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not read a SAM-3 result (${response.status})`);
    return response.json() as Promise<SamResultFile>;
  }));

  const regions = resultFiles.flatMap((result, index) => result ? extractRegions(result, index, concepts) : []);
  // Box prompts locate foreground masks; never union them into a selection-shaped symbol.
  return deduplicateRegions(regions);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { imageDataUrl?: unknown; imageBase64?: unknown; manualRegion?: unknown; focusedSelection?: unknown };
    const imageDataUrl = typeof body.imageDataUrl === 'string'
      ? body.imageDataUrl
      : typeof body.imageBase64 === 'string'
        ? `data:image/jpeg;base64,${body.imageBase64}`
        : '';

    if (!imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: 'A valid image data URL is required' }, { status: 400 });
    }

    let manualRegion: NormalizedBox | undefined;
    if (body.manualRegion !== undefined) {
      if (!body.manualRegion || typeof body.manualRegion !== 'object') {
        return NextResponse.json({ error: 'The selected region is invalid' }, { status: 400 });
      }
      const box = body.manualRegion as Partial<NormalizedBox>;
      const values = [box.x, box.y, box.width, box.height];
      if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
        return NextResponse.json({ error: 'The selected region is invalid' }, { status: 400 });
      }
      const [x, y, width, height] = values as number[];
      if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1000 || y + height > 1000) {
        return NextResponse.json({ error: 'The selected region must fit within the image' }, { status: 400 });
      }
      manualRegion = { x, y, width, height };
    }

    const focusedSelection = body.focusedSelection === true;
    const imageClassification = await classifyImage(imageDataUrl, focusedSelection);
    const concepts = manualRegion
      ? [{ name: 'Detected motif', prompt: 'the foreground motif inside the user-selected area' }]
      : buildConcepts(imageClassification, focusedSelection);
    if (!manualRegion && imageClassification.source === 'openai' && concepts.length === 0) {
      return NextResponse.json({ success: true, coordinateScale: 1000, imageClassification, symbols: [] });
    }
    const detected = await runSegmentation(imageDataUrl, concepts, manualRegion);
    // SAM finds instances of a prompt; its prompt name is not an identity for
    // each instance. Only region-specific recognition can assign a name.
    const symbols = detected.map((region) => ({ ...region, name: 'Unidentified symbol', category: 'Detected region' }));
    return NextResponse.json({ success: true, coordinateScale: 1000, imageClassification, symbols });
  } catch (error) {
    console.error('Error in SAM-3 segmentation:', error);
    const message = (error as Error).message || 'Failed to segment image';
    return NextResponse.json(
      { error: 'Failed to segment image', details: message },
      { status: 500 }
    );
  }
}
