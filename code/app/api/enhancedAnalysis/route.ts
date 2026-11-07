import { NextResponse } from 'next/server';

const DEFAULT_MODEL = 'gpt-4o-mini';

type ResponsesApiResult = {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type ImageClassificationResult = {
  imageType?: string;
  dominantSubject?: string;
  dominantSymbol?: string | null;
  embeddedSymbols?: string[];
  reasoning?: string;
  symbolDensity?: string;
};

async function requestOpenAI(
  imageDataUrl: string,
  prompt: string,
  json = false
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: imageDataUrl, detail: 'auto' },
          ],
        },
      ],
      ...(json ? { text: { format: { type: 'json_object' } } } : {}),
      max_output_tokens: json ? 2000 : 100,
    }),
  });

  const result = await response.json() as ResponsesApiResult & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(result.error?.message || `OpenAI request failed (${response.status})`);
  }

  const text = result.output
    ?.flatMap((item) => item.content || [])
    .find((content) => content.type === 'output_text')?.text;

  if (!text) {
    throw new Error('OpenAI returned an empty response');
  }

  return text;
}

function parseJsonField(raw: string, fallback: Record<string, unknown>) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  try {
    const { imageDataUrl, imageBase64, boundingBox, symbolName: requestedSymbolName } = await request.json();
    const resolvedImageDataUrl = imageDataUrl || (imageBase64 ? `data:image/jpeg;base64,${imageBase64}` : '');

    if (!resolvedImageDataUrl) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    const classificationPrompt = `
You are evaluating an image before symbol analysis. Decide what kind of visual content this is and whether the image contains one dominant symbol or multiple embedded symbols.

Return JSON with this exact structure:
{
  "imageType": "single_symbol" | "object_with_symbol" | "symbolic_scene" | "ornamental_pattern" | "ambiguous",
  "dominantSubject": "short description of the main subject",
  "dominantSymbol": "best single symbol label if one is present, otherwise null",
  "embeddedSymbols": ["up to 5 candidate motifs or sub-symbols found inside the image"],
  "symbolDensity": "single" | "moderate" | "dense",
  "reasoning": "2-3 sentences explaining the classification"
}

Important:
- If the image is mostly one central emblem, classify as \"single_symbol\".
- If the image is an object with a symbol painted or carved onto it, classify as \"object_with_symbol\".
- If the image contains many repeated or surrounding symbolic forms, classify as \"symbolic_scene\".
- If the image is mostly abstract decorative geometry with unclear symbolic meaning, classify as \"ornamental_pattern\".
- Do not return markdown or extra text outside JSON.
`;

    const classificationRaw = await requestOpenAI(resolvedImageDataUrl, classificationPrompt, true);
    const classification = parseJsonField(classificationRaw, {
      imageType: 'ambiguous',
      dominantSubject: 'unknown',
      dominantSymbol: null,
      embeddedSymbols: [],
      symbolDensity: 'single',
      reasoning: 'Unable to classify the image confidently.'
    }) as ImageClassificationResult;

    const imageType = classification.imageType || 'ambiguous';
    const dominantSubject = classification.dominantSubject || 'unknown';
    const dominantSymbol = classification.dominantSymbol || null;
    const embeddedSymbols = Array.isArray(classification.embeddedSymbols) ? classification.embeddedSymbols : [];
    const symbolDensity = classification.symbolDensity || 'single';

    const initialPrompt = `
You are identifying the primary symbol ${boundingBox ? 'inside the selected image region' : 'in the image'}. If the image is an object with symbol decoration, name the symbol rather than the object itself.

Current image classification:
- imageType: ${imageType}
- dominantSubject: ${dominantSubject}
- symbolDensity: ${symbolDensity}
- embeddedSymbols: ${embeddedSymbols.length ? embeddedSymbols.join(', ') : 'none'}
${boundingBox ? `- selectedRegion (normalized 0-1000 coordinates): ${JSON.stringify(boundingBox)}\n- candidateRegionLabel (verify visually): ${typeof requestedSymbolName === 'string' ? requestedSymbolName.slice(0, 100) : 'none'}` : ''}

${boundingBox ? `Analyze the symbol inside this selected image region, whose normalized 0-1000 bounding box is ${JSON.stringify(boundingBox)}. Identify the symbol inside the box even if it is a secondary motif in the full composition.${typeof requestedSymbolName === 'string' ? ` The segment detector labeled this region "${requestedSymbolName}"; verify that label against the image rather than blindly accepting it.` : ''}` : 'Analyze the most prominent symbol in the full image.'}

Return JSON with this exact structure:
{
  "name": "primary symbol name",
  "category": "symbol category",
  "reasoning": "brief explanation"
}

If a region is selected, identify only the symbol inside that region, even if it is a secondary motif in the full composition. Verify any candidate label against the image. If there is no clear standalone symbol in the selected region, return the most likely symbolic motif in that region. Do not substitute the overall composition for a selected embedded motif.
Do not return markdown or extra text outside JSON.
`;

    const initialResult = parseJsonField(
      await requestOpenAI(resolvedImageDataUrl, initialPrompt, true),
      { name: dominantSymbol || 'Unknown Symbol', category: 'General', reasoning: 'No clear primary symbol identified.' }
    ) as { name?: string; category?: string; reasoning?: string };

    const symbolName = (initialResult.name || dominantSymbol || 'Unknown Symbol').trim();

    const wikiResponse = await fetch(new URL('/api/wikiLookup', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbolName })
    });

    const wikiData = await wikiResponse.json();

    let booksData = 'Unable to retrieve book information at this time.';
    let booksInfoAvailable = false;

    try {
      const booksResponse = await fetch(new URL('/api/googleBooksLookup', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbolName }),
      });

      if (booksResponse.ok) {
        const booksResult = await booksResponse.json();

        if (booksResult.success) {
          booksData = booksResult.bookData;
          booksInfoAvailable = true;

          if (booksResult.note && booksResult.note.includes('sample data')) {
            console.log('Using sample book data:', booksResult.note);
          }
        } else {
          console.error('Google Books lookup returned failure:', booksResult);
        }
      } else {
        console.error(`Google Books lookup failed with status: ${booksResponse.status}`);
      }
    } catch (error) {
      console.error('Error during Google Books lookup:', error);
    }

    const enhancedPrompt = `
You are an expert in symbolic analysis with deep knowledge of historical, religious, and cultural symbols.

IMAGE CLASSIFICATION:
- imageType: ${imageType}
- dominantSubject: ${dominantSubject}
- symbolDensity: ${symbolDensity}
- embeddedSymbols: ${embeddedSymbols.length ? embeddedSymbols.join(', ') : 'none'}

PRIMARY SYMBOL CANDIDATE: ${symbolName}

RESEARCH FROM WIKIPEDIA:
${wikiData.success ? wikiData.info : 'No Wikipedia information available'}

RESEARCH FROM BOOKS:
${booksData}

Analyze the image as a ${imageType} and determine whether the symbol is a single dominant emblem or a scene that includes embedded motifs.${boundingBox ? ` Focus on the selected region, specified in normalized 0-1000 image coordinates: ${JSON.stringify(boundingBox)}.` : ''}

Return JSON with the following structure:
{
  "name": string,
  "category": string,
  "confidence": number (0-10),
  "prominence": number (0-10),
  "authenticity": number (0-10),
  "description": string,
  "overallScoreRationale": string,
  "contextDescription": string,
  "origin": string,
  "timePeriod": string,
  "primaryUse": string,
  "culturalPrevalence": string,
  "visualComplexity": string,
  "keyElements": string,
  "thinkingProcess": [string],
  "imageType": "single_symbol" | "object_with_symbol" | "symbolic_scene" | "ornamental_pattern" | "ambiguous",
  "dominantSubject": string,
  "embeddedSymbols": [string],
  "classificationReasoning": string
}

Important:
- Return confidence, prominence, and authenticity as numbers from 0 to 10, not fractions from 0 to 1.
- For a single emblem, the dominant symbol is central and primary.
- For an object with a symbol decoration, call out both the object and the symbol.
- For a symbolic scene, include multiple embedded motifs when relevant.
- Keep the output valid JSON and do not include markdown fences.
`;

    const analysisResult = parseJsonField(
      await requestOpenAI(resolvedImageDataUrl, enhancedPrompt, true),
      {
        name: symbolName,
        category: initialResult.category || 'General',
        confidence: 7,
        prominence: 7,
        authenticity: 7,
        description: 'Image analyzed with layered symbol classification.',
        overallScoreRationale: 'Score based on visual prominence and cultural context.',
        contextDescription: 'Classification completed with available image context.',
        origin: 'Unknown',
        timePeriod: 'Unknown',
        primaryUse: 'Unknown',
        culturalPrevalence: 'Unknown',
        visualComplexity: 'Medium',
        keyElements: embeddedSymbols.join(', ') || 'Symbolic form',
        thinkingProcess: ['Classified the image type first.', 'Identified the dominant symbolic motif.', 'Checked for embedded sub-symbols.'],
        imageType,
        dominantSubject,
        embeddedSymbols,
        classificationReasoning: classification.reasoning || 'Image classified based on visual composition.'
      }
    ) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      initialIdentification: symbolName,
      imageType,
      dominantSubject,
      dominantSymbol,
      embeddedSymbols,
      classificationReasoning: classification.reasoning || 'Image classified based on visual composition.',
      wikiInfoAvailable: wikiData.success,
      booksInfoAvailable,
      analysis: analysisResult
    });
  } catch (error) {
    console.error('Error in enhanced analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze symbol with enhanced data', details: (error as Error).message },
      { status: 500 }
    );
  }
} 