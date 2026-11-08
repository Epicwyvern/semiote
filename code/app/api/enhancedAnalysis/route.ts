import { NextResponse } from 'next/server'
import { z } from 'zod'
import { lookupWikipedia, lookupBooks, uniqueSources, referenceImage, citationPassages, normalizedName } from '@/lib/symbol-research'
import { observationsSchema, identificationSchema, observationInstructions, comparisonInstructions, verificationSchema, verificationInstructions, candidateNames, assembleAnalysis, type Verification, type Identification, type VerificationDiagnostic } from '@/lib/symbol-recognition'

export const maxDuration = 300
const image = z.string().max(20_000_000).regex(/^data:image\/(?:png|jpeg|webp|gif);base64,/)
const requestSchema = z.object({
  imageDataUrl: image.optional(), imageBase64: z.string().max(18_000_000).optional(),
  targetImageDataUrl: image.optional(), contextImageDataUrl: image.optional(),
  selectionKind: z.enum(['painted', 'region']).optional(),
  boundingBox: z.object({ x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive(), coordinateScale: z.literal(1000).optional() })
    .refine(box => box.x + box.width <= 1000.001 && box.y + box.height <= 1000.001).optional(),
})
type Content = { type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail: 'high' | 'low' }

class RecognitionStageError extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}
function stageDiagnostic(stage: VerificationDiagnostic['stage'], error: unknown): VerificationDiagnostic {
  if (error instanceof z.ZodError) return { stage, code: 'invalid_schema', message: 'The model response did not match the required structure.', fields: error.issues.map(issue => `${issue.path.join('.')}: ${issue.code}`).slice(0, 20) }
  if (error instanceof SyntaxError) return { stage, code: 'invalid_json', message: 'The model returned invalid JSON.' }
  if (error instanceof RecognitionStageError) return { stage, code: error.code, message: error.message }
  if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)) return { stage, code: 'timeout', message: 'The request exceeded its time limit.' }
  return { stage, code: 'request_failed', message: 'The model request could not be completed.' }
}

async function vision(instructions: string, content: Content[]) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ model: process.env.OPENAI_RECOGNITION_MODEL || process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      input: [{ role: 'system', content: instructions }, { role: 'user', content }],
      text: { format: { type: 'json_object' } }, max_output_tokens: 10000,
    }),
  })
  const data = await response.json() as { status?: string; incomplete_details?: { reason?: string }; error?: { message?: string }; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  if (!response.ok) throw new RecognitionStageError(`http_${response.status}`, `The model service returned HTTP ${response.status}.`)
  if (data.status === 'incomplete') throw new RecognitionStageError('incomplete_output', 'The model response was incomplete; it may have exceeded the output limit.')
  const raw = data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text
  if (!raw) throw new RecognitionStageError('empty_output', 'The model returned no structured result.')
  // Malformed output is an error, never a fabricated successful identification.
  return JSON.parse(raw) as unknown
}

async function validatedVision<S extends z.ZodTypeAny>(schema: S, instructions: string, content: Content[]): Promise<z.output<S>> {
  let correction: Content[] = []
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return schema.parse(await vision(instructions, [...content, ...correction])) }
    catch (error) {
      if (attempt || !(error instanceof z.ZodError || error instanceof SyntaxError)) throw error
      const issues = error instanceof z.ZodError ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') : 'Invalid JSON syntax'
      correction = [{ type: 'input_text', text: `Return the complete required JSON shape. The previous response failed validation: ${issues}. Use actual JSON null where appropriate, numbers for scores, arrays for feature lists, and only the enumerated status values. Do not fabricate an identity to satisfy the format.` }]
    }
  }
  throw new Error('No valid recognition result')
}

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>
  try { body = requestSchema.parse(await request.json()) }
  catch { return NextResponse.json({ error: 'Invalid image or selected region' }, { status: 400 }) }
  const original = body.contextImageDataUrl || body.imageDataUrl || (body.imageBase64 ? `data:image/jpeg;base64,${body.imageBase64}` : '')
  if (!original) return NextResponse.json({ error: 'Image data is required' }, { status: 400 })
  let stage = 'observations'
  try {
    const target = body.targetImageDataUrl || body.imageDataUrl || original
    const images: Content[] = [
      { type: 'input_text', text: body.selectionKind === 'painted' ? 'EXACT PAINTED SELECTION: only these source pixels were selected; omitted strokes are unknown.' : 'TARGET CLOSE-UP: inspect this symbol.' },
      { type: 'input_image', image_url: target, detail: 'high' },
    ]
    if (target !== original) images.push({ type: 'input_text', text: `ORIGINAL CONTEXT. Target bounds in original normalized 0-1000 coordinates: ${JSON.stringify(body.boundingBox || null)}. Identify the close-up, not a different nearby motif.` }, { type: 'input_image', image_url: original, detail: 'high' })
    else if (body.boundingBox) images.unshift({ type: 'input_text', text: `Inspect only this normalized 0-1000 region in the supplied image: ${JSON.stringify(body.boundingBox)}` })

    const observations = await validatedVision(observationsSchema, observationInstructions, images)
    const names = candidateNames(observations)
    // Unrelated search results can be rejected in the comparison. They are not
    // automatically accepted as references for the photographed symbol.
    const wiki = await Promise.all(names.map(name => lookupWikipedia(name)))
    const sources = uniqueSources(wiki.flatMap(result => result.sources))
    const passages = citationPassages(sources)
    const research = sources.map(source => ({ ...source, passages: passages.filter(passage => passage.sourceId === source.id) }))
    const referenceImages = await Promise.all(sources.filter(source => source.imageUrl).slice(0, 3).map(async source => ({ source, image: await referenceImage(source) })))
    const references: Content[] = referenceImages.flatMap(({ source, image }) => image ? [
      { type: 'input_text' as const, text: `REFERENCE ONLY (not the target): ${source.id}, ${source.title}. Compare the drawing's structure; do not assume it matches.` },
      { type: 'input_image' as const, image_url: image, detail: 'high' as const },
    ] : [])
    const diagnostics: VerificationDiagnostic[] = wiki.flatMap((result, index) => result.status === 'unavailable' ? [{ stage: 'lookup' as const, code: result.failureCode || 'lookup_unavailable', message: `Reference lookup was unavailable for ${names[index]}.` }] : [])
    stage = 'comparison'
    let identification: Identification | undefined
    try {
      if (sources.length) identification = await validatedVision(identificationSchema, comparisonInstructions, [
      ...images, { type: 'input_text', text: JSON.stringify({ observations, candidateNames: names, research, referenceImageSourceIds: referenceImages.filter(item => item.image).map(item => item.source.id) }) }, ...references,
      ])
    } catch (error) { const diagnostic = stageDiagnostic('comparison', error); diagnostics.push(diagnostic); console.warn('Reference processing:', diagnostic) }
    let audit: Verification | undefined
    try {
      if (identification) audit = await validatedVision(verificationSchema, verificationInstructions, [
        ...images,
        { type: 'input_text', text: JSON.stringify({ candidateNames: names, research,
          // Do not give the auditor a preferred name, status or proposed verdict.
          comparisons: identification.comparisons.map(({ candidateName, referenceDefinition, requiredFeatures, checks }) => ({ candidateName, referenceDefinition, requiredFeatures, checks })),
        }) }, ...references,
      ])
    } catch (error) {
      const diagnostic = stageDiagnostic('audit', error); diagnostics.push(diagnostic); console.warn('Reference processing:', diagnostic)
    }
    const preferred = observations.visualIdentification.selectedCandidateName
    const preferredLookups = wiki.filter((_, index) => normalizedName(names[index]) === normalizedName(preferred || ''))
    const lookupStatus = preferredLookups.some(result => result.sources.length) ? 'available' : preferredLookups.some(result => result.status === 'unavailable') ? 'unavailable' : 'no_results'
    const analysis = assembleAnalysis(observations, identification, names, sources, audit, { lookupStatus, comparisonAvailable: Boolean(identification), diagnostics })
    // Book search is supplementary reading after identification, not evidence
    // that can turn a loose keyword match into a named visual identity.
    const books = analysis.visualIdentification.selectedCandidateName ? await lookupBooks(analysis.visualIdentification.selectedCandidateName) : { sources: [], status: 'no_results' as const }
    const furtherReading = books.sources

    return NextResponse.json({ success: true, analysis, observations,
      wikiInfoAvailable: wiki.some(result => result.sources.length > 0),
      booksInfoAvailable: furtherReading.length > 0, furtherReading,
      researchStatus: { wikipedia: wiki.map((result, index) => ({ candidate: names[index], status: result.status })), books: { status: books.status } },
    })
  } catch (error) {
    console.error('Symbol recognition failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Symbol recognition could not be completed', ...(process.env.NODE_ENV === 'development' && error instanceof z.ZodError ? { diagnostics: { stage, fields: error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code })) } } : {}), details: error instanceof z.ZodError ? 'The model returned an incomplete identification. Please retry.' : error instanceof SyntaxError ? 'The model returned invalid JSON. Please retry.' : (error as Error).message }, { status: 502 })
  }
}
