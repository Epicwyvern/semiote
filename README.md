![Semiote — Let the Symbols Speak](https://github.com/user-attachments/assets/a140a852-26eb-4d0d-81ba-bb0ce9146a88)

# Semiote

Semiote is an early-stage platform for exploring symbols through image analysis, interpretation, and personal knowledge libraries. Its current prototype, **Omen 0.1.1**, focuses on **Discern**: finding visual motifs in an image and examining possible identities against reference material.

Recognition is experimental. A proposed name is not proof of a symbol's cultural origin, historical authenticity, or intended meaning.

## What's new in 0.1.1

Initial release November 8, 2026; development findings updated November 9, 2026.

- **Image inspection tools:** zoom, pan, fit image, zoom to symbol, and an expanded image workspace.
- **Focused analysis:** draw a box to detect motifs within an area, or paint the exact pixels to analyze. Adjust brush size, erase, undo/redo, and refine a detected outline.
- **Mask controls:** toggle masks and labels and adjust overlay opacity. Recognition uses source-image pixels rather than screenshots containing selection overlays.
- **Multiple-symbol workflow:** detected and manually drawn regions remain editable drafts in the image workspace. Review, rename, remove, or refine them before explicitly analyzing. Submitted regions use a two-worker queue with independent results and errors.
- **Clearer analysis results:** visual identification, reference verification, and historical attribution are separate outcomes. Mask confidence describes segmentation, not confidence in a symbol's name. Misleading authenticity and numeric assessment bars have been removed.
- **Visible references:** inspect retrieved Wikipedia excerpts, source links, candidate comparisons, and Google Books suggestions. Lookup failures no longer produce sample research presented as real evidence.
- **Verification diagnostics:** distinguish lookup failures, rate limits, incomplete model output, invalid response structure, and unresolved visual evidence. Wikipedia lookups use shared requests, caching, pacing, and a rate-limit cooldown.
- **UI refinement:** larger readable content, a horizontally scrolling symbol selector, and matching Image/Symbols headers using the project's Garamond/Lato typography and bone, gold, and parchment palette.
- **Deployment fixes:** recognition's function duration is compatible with the deployed Vercel Hobby project's 60-second limit, and older API clients initialize at request time rather than requiring credentials during a build.

The original **0.1.0 Omen** prototype introduced image upload, initial symbol recognition, and reference integrations. Version 0.1.1 improves those workflows; it does not establish broad recognition accuracy.

## Current capabilities

### Discern

1. Upload an image using the file picker, drag-and-drop, or clipboard paste. The current upload limit is 10 MB per image.
2. Choose **Find symbols in image**, or create a selection with **Box** or **Paint**. Add manual selections with **Add region**.
3. Review draft regions in the image workspace. Edit masks or boxes, rename in place, or delete regions. Matching colors and names connect drafts with their image overlays. Detection alone does not start analysis.
4. Choose **Analyze region** or **Analyze N regions** when ready. Submitted regions appear in the Symbols panel as the queue completes.
5. Review visual identification, candidate comparisons, **Symbol information**, and **Sources**. Tentative results have a distinct badge; the standalone reference-verification panel has been removed.

### Planned tools

- **Decipher:** explore meanings and interpretations in context.
- **Define:** create and archive personal symbolic interpretations.

Decipher, Define, and a complete personal-library workflow remain planned. Navigation and prototype UI should not be taken as completed functionality.

## How recognition works

- **Image classification and segmentation:** OpenAI supplies visual descriptions to guide a hosted SAM 3 model on Replicate. Segmentation locates regions; its labels do not determine the final symbol name.
- **Visual identification:** a vision-language model examines a source-pixel crop and image context to propose candidates and observable distinguishing features.
- **Web-assisted matching:** uncertain or broad visual proposals may trigger image-assisted web research. Retrieved identity-match links are included in Sources.
- **Reference retrieval:** Wikipedia exact titles, redirects, and search provide article excerpts and available reference thumbnails. Retrieved material is evidence to assess, not automatic confirmation.
- **Structural comparison and audit:** separate model passes compare visible features against cited reference passages. A rejection requires an audited structural conflict; missing or unreadable details remain uncertain.
- **Symbol information:** web research and Wikipedia can populate origin, time period, primary use, and cultural context, including for tentative identifications. Logo research focuses on the mark rather than the owner biography. Links are collected under Sources instead of repeated in the information fields. Background about a proposed identity does not establish the pictured item's provenance or intention.
- **Further reading:** Google Books queries and filtering incorporate retrieved identity context to reduce unrelated namesakes. This is a heuristic, not guaranteed relevance; absent Wikipedia context can currently leave the section empty.

Reference results can be supported, contradicted, inconclusive, unavailable, or fail processing. The interface exposes the distinction and preserves the original visual proposal. Even a supported reference comparison remains model-assisted, and unresolved alternatives may prevent a unique identification.

## Technology

- Next.js 14, React 18, and TypeScript
- Tailwind CSS, Radix UI, and Lucide icons
- OpenAI Responses API for the current Discern workflow
- Replicate-hosted `vufinder/sam3` for segmentation
- Wikipedia / MediaWiki and Google Books APIs for references

The current Discern default is **`gpt-6-luna`** for image classification, recognition, comparison/audit, and web research. SAM 3 remains the segmentation model. These defaults replace the previous image and more expensive research defaults; quality and cost improvements have not been established by a controlled benchmark.

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
OPENAI_VISION_MODEL=gpt-6-luna
OPENAI_RECOGNITION_MODEL=gpt-6-luna
OPENAI_SYMBOL_SEARCH_MODEL=gpt-6-luna
```

`REPLICATE_API_KEY` is also accepted and takes precedence over `REPLICATE_API_TOKEN`.

`OPENAI_VISION_MODEL` controls full-image classification. For per-region visual analysis, reference comparison, and audit, the model is chosen in this order: `OPENAI_RECOGNITION_MODEL`, then `OPENAI_VISION_MODEL`, then `gpt-6-luna`. `OPENAI_SYMBOL_SEARCH_MODEL` controls web-assisted matching and symbol/logo research. A model override must support the request's image inputs and JSON output; changing the name alone does not guarantee compatibility, latency, or quality.

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
- **Cost:** detection and explicit region analysis incur separate costs. A region can involve observation, web matching, information research, comparison, audit, and retries. Concurrency changes waiting time, not the number of billable calls. Actual token usage and cost are not yet recorded per analysis.
- **Data flow:** image data is sent to OpenAI and Replicate for analysis and segmentation. Candidate names and context are sent to Wikipedia, web search through OpenAI, and, when configured, Google Books. Source excerpts and available Wikipedia reference thumbnails may be sent to OpenAI for comparison. Keep credentials out of source control.
- **Layout:** the workspace is optimized primarily for desktop inspection; smaller screens need further usability testing.

## Findings and remaining work (November 9)

These are observations from manual runs, across changing prompts and models, rather than an accuracy benchmark. See the [0.1.1 results archive](Process/Results%20-%200.1.1/README.md) for successes, failures, and earlier UI states.

- **Recognition gains:** Eye of Horus, Half-Life and Linkin Park logos, and the classic ouroboros were generally recognized. Luna runs identified Dagaz and Othala after earlier failures. Finding a region and identifying it remain separate capabilities.
- **Characters and glyphs:** calligraphic Arabic Sheen still failed. Earlier runs confused Eihwaz with other runes, Xi with Sigma, and missed stylized Mannaz. Investigate image preparation, disconnected marks, resolution, candidate generation, and reference coverage across scripts; avoid rune-specific fixes or fixed cultural shortlists.
- **Pictorial and composite identities:** Monas Hieroglyphica was called Mercury or left unidentified; Blake's Four Zoas diagram was split into parts and remained unidentified as a whole. Bowen-style knotting was generalized to Celtic knot. Investigate relationships between components and whole compositions, plus distinguishing details.
- **Shared iconography:** Duamutef was repeatedly labeled Anubis from canine-headed features. Candidate generation now asks for meaningful alternatives and distinguishing evidence when identities share a form. This prompt revision needs repeated evaluation; do not assume it solves the ambiguity.
- **Comparison consistency:** some runs described visible features correctly but labeled their checks insufficient. Comparison/audit prompts now explicitly address internal disagreement. Stable evidence associations, reference support, and distinguishing power still need investigation; agreement of model prose is not independent proof.
- **Research reliability:** tentative matches can now populate information and web sources, but timeout budgets, sparse references, invalid output, and fallback behavior can still leave sections empty. Improve source provenance (separate model explanations from source excerpts), retain all useful match citations, and make web-source labels appropriate for non-logo symbols.
- **Books:** evaluate contextual filtering against unrelated namesakes and useful relevant books. Current keyword filtering can be too broad or too restrictive and depends on Wikipedia context.
- **Region duplicates:** duplicate or fragmented detections remain possible. Lower priority for now because users can edit, remove, or create regions before analysis.
- **Evaluation:** repeat the same inputs and selections across models, retaining stage outputs, timings, and costs. Include unfamiliar scripts, stylized characters, composite designs, and shared iconography. Latest prompts and research changes still need live end-to-end regression runs.

## Future exploration

Investigate **visual retrieval**: retrieve similar labeled reference images using visual embeddings, then compare distinguishing structures before assigning a name. This would use a curated library across symbol families and retain uncertainty for unfamiliar motifs. DINOv2 is one possible encoder to evaluate; licensing, coverage, fine structural accuracy, latency, and cost remain open questions.

This is a research direction, not a feature in 0.1.1. See [project notes](memory-bank/activeContext.md).

## Contributing

Issues and pull requests are welcome. For recognition problems, include reproducible steps, expected versus observed behavior, and an image you have permission to share. Do not include API keys or authorization headers.

## Brand

**Let the Symbols Speak.** Semiote's core values are Knowledge, Discovery, Archiving, and Interpretation. See the [brand and design guidelines](Process/Brand%20Design%20Guidelines/Semiote%20BrandDesign%20Guidelines.pdf).

## License

See [LICENSE](LICENSE) for the repository's GNU General Public License, version 3.
