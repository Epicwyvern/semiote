![Semiote — Let the Symbols Speak](https://github.com/user-attachments/assets/a140a852-26eb-4d0d-81ba-bb0ce9146a88)

# Semiote

Semiote is an early-stage platform for exploring symbols through image analysis, interpretation, and personal knowledge libraries. Its current prototype, **Omen 0.1.1**, focuses on **Discern**: finding visual motifs in an image and examining possible identities against reference material.

Recognition is experimental. A proposed name is not proof of a symbol's cultural origin, historical authenticity, or intended meaning.

## What's new in 0.1.1

Released November 8, 2026.

- **Image inspection tools:** zoom, pan, fit image, zoom to symbol, and an expanded image workspace.
- **Focused analysis:** draw a box to detect motifs within an area, or paint the exact pixels to analyze. Adjust brush size, erase, undo/redo, and refine a detected outline.
- **Mask controls:** toggle masks and labels and adjust overlay opacity. Recognition uses source-image pixels rather than screenshots containing selection overlays.
- **Multiple-symbol workflow:** detected regions enter a background queue automatically, with two analyses running at once. Selecting a waiting region prioritizes it; results and errors are tracked independently.
- **Clearer analysis results:** visual identification, reference verification, and historical attribution are separate outcomes. Mask confidence describes segmentation, not confidence in a symbol's name. Misleading authenticity and numeric assessment bars have been removed.
- **Visible references:** inspect retrieved Wikipedia excerpts, source links, candidate comparisons, and Google Books suggestions. Lookup failures no longer produce sample research presented as real evidence.
- **Verification diagnostics:** distinguish lookup failures, rate limits, incomplete model output, invalid response structure, and unresolved visual evidence. Wikipedia lookups use shared requests, caching, pacing, and a rate-limit cooldown.
- **UI refinement:** larger readable content, a horizontally scrolling symbol selector, and matching Image/Symbols headers using the project's Garamond/Lato typography and bone, gold, and parchment palette.
- **Deployment fixes:** recognition's function duration is compatible with the deployed Vercel Hobby project's 60-second limit, and older API clients initialize at request time rather than requiring credentials during a build.

The original **0.1.0 Omen** prototype introduced image upload, initial symbol recognition, and reference integrations. Version 0.1.1 improves those workflows; it does not establish broad recognition accuracy.

## Current capabilities

### Discern

1. Upload an image using the file picker, drag-and-drop, or clipboard paste. The current upload limit is 10 MB per image.
2. Inspect segmented regions on the image. Neutral region labels remain until each region has its own analysis.
3. View results as the background queue completes, or select a queued region to prioritize it.
4. Zoom or pan for closer inspection. Use **Box** to focus detection, or **Paint** and **Erase** to define a pixel selection, then choose **Analyze selection**.
5. Review the visual proposal, reference status, structural comparisons, historical attribution, and sources independently.

### Planned tools

- **Decipher:** explore meanings and interpretations in context.
- **Define:** create and archive personal symbolic interpretations.

Decipher, Define, and a complete personal-library workflow remain planned. Navigation and prototype UI should not be taken as completed functionality.

## How recognition works

- **Image classification and segmentation:** OpenAI supplies visual descriptions to guide a hosted SAM 3 model on Replicate. Segmentation locates regions; its labels do not determine the final symbol name.
- **Visual identification:** a vision-language model examines a source-pixel crop and image context to propose candidates and observable distinguishing features.
- **Reference retrieval:** Wikipedia exact titles, redirects, and search provide article excerpts and available reference thumbnails. Retrieved material is evidence to assess, not automatic confirmation.
- **Structural comparison and audit:** separate model passes compare visible features against cited reference passages. A rejection requires an audited structural conflict; missing or unreadable details remain uncertain.
- **Historical attribution:** cited general history is kept separate from visual identity and is withheld when the evidence requirements are not met. It does not establish the depicted item's provenance or intention.
- **Further reading:** Google Books results are supplementary suggestions, not evidence establishing visual identity or guaranteed scholarly validation.

Reference results can be supported, contradicted, inconclusive, unavailable, or fail processing. The interface exposes the distinction and preserves the original visual proposal. Even a supported reference comparison remains model-assisted, and unresolved alternatives may prevent a unique identification.

## Technology

- Next.js 14, React 18, and TypeScript
- Tailwind CSS, Radix UI, and Lucide icons
- OpenAI Responses API for the current Discern workflow
- Replicate-hosted `vufinder/sam3` for segmentation
- Wikipedia / MediaWiki and Google Books APIs for references

The current Discern default is **`gpt-4o-mini`**. Configurable model settings are described below; alternate providers and visual retrieval have not been implemented.

## Local setup

Use **Node.js 22.x** to match the current Vercel deployment, and npm. You will need an OpenAI API key and a Replicate API token for the complete Discern workflow. A Google Books key is optional.

```sh
git clone https://github.com/Epicwyvern/semiote.git
cd semiote/code
npm ci
```

Create `code/.env.local` (relative to the repository root):

```dotenv
OPENAI_API_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_api_token

# Optional: supplementary book search
GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# Optional: current defaults shown below
OPENAI_VISION_MODEL=gpt-4o-mini
OPENAI_RECOGNITION_MODEL=gpt-4o-mini
```

`REPLICATE_API_KEY` is also accepted and takes precedence over `REPLICATE_API_TOKEN`.

`OPENAI_VISION_MODEL` controls full-image classification. For per-region visual analysis, reference comparison, and audit, the model is chosen in this order: `OPENAI_RECOGNITION_MODEL`, then `OPENAI_VISION_MODEL`, then `gpt-4o-mini`. A model override must support the request's image inputs and JSON output; changing the name alone does not guarantee compatibility, latency, or quality. These overrides apply to the current Discern pipeline; the older `/api/analyzeSymbol` and `/api/initialIdentify` endpoints still use their own model setting in code.

Start the app from `code/`:

```sh
npm run dev
```

Open [Discern](http://localhost:3000/tools/discern). For a production build, stop the dev server first so it does not hold the same `.next` files:

```sh
npm run build
npm start
```

## Validation

Run from `code/`:

```sh
npx tsc --noEmit --incremental false
node scripts/test-symbol-recognition.cjs
node scripts/test-region-analysis.cjs
node scripts/test-discern-image.cjs
node scripts/test-manual-segmentation.cjs
```

These deterministic checks cover evidence handling, invalid-output diagnostics, retrieval behavior, queue concurrency and cancellation, region-state isolation, image-selection geometry, and box-guided segmentation. They do not establish recognition accuracy across real-world symbols.

For evaluation details and live-test observations, see [recognition evaluation notes](code/scripts/recognition-evaluation.md). The live evaluation script accepts prepared request JSON files; those calls use the configured paid services. Keep image fixtures and results outside version control, for example under `code/.temp/`.

## Deployment and limitations

The Vercel project uses `code/` as its root directory. Configure the API credentials in Vercel's environment settings for the relevant deployment environment; local `.env.local` files are not deployed.

- **Runtime limits:** `/api/enhancedAnalysis` declares `maxDuration = 60` for the current Hobby deployment. Several sequential model calls, lookups, and retries can still exceed this limit. The browser's two-region queue is not a durable server-side job system; longer workflows may require background processing.
- **Recognition quality:** similar designs can receive broad or incorrect names. Fine distinctions among related motifs remain under evaluation. No fixed symbol shortlist is injected into candidate generation.
- **External dependencies:** segmentation and recognition require their providers to be available. Reference APIs can rate-limit requests or lack the structural detail needed for verification.
- **Cost:** every detected region is now analyzed automatically. A complete region can involve three model calls, plus retries. Concurrency changes waiting time, not the number of billable calls. Actual token usage and cost are not yet recorded per analysis.
- **Data flow:** image data is sent to OpenAI and Replicate for analysis and segmentation. Candidate names are sent to Wikipedia and, when configured, Google Books. Source excerpts and available Wikipedia reference thumbnails may be sent to OpenAI for comparison. Keep credentials out of source control.
- **Layout:** the workspace is optimized primarily for desktop inspection; smaller screens need further usability testing.

## Future exploration

Investigate **visual retrieval**: retrieve similar labeled reference images using visual embeddings, then compare distinguishing structures before assigning a name. This would use a curated library across symbol families and retain uncertainty for unfamiliar motifs. DINOv2 is one possible encoder to evaluate; licensing, coverage, fine structural accuracy, latency, and cost remain open questions.

This is a research direction, not a feature in 0.1.1. See [project notes](memory-bank/activeContext.md).

## Contributing

Issues and pull requests are welcome. For recognition problems, include reproducible steps, expected versus observed behavior, and an image you have permission to share. Do not include API keys or authorization headers.

## Brand

**Let the Symbols Speak.** Semiote's core values are Knowledge, Discovery, Archiving, and Interpretation. See the [brand and design guidelines](Process/Brand%20Design%20Guidelines/Semiote%20BrandDesign%20Guidelines.pdf).

## License

See [LICENSE](LICENSE) for the repository's GNU General Public License, version 3.
