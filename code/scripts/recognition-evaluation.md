# Discern recognition evaluation

> Historical evaluation notes: the runs and pipeline descriptions below predate the November 9 changes. Current defaults use GPT-6 Luna; tentative matches can receive web-sourced symbol information. See the root README and the 0.1.1 results archive for current behavior and remaining work.

The current recognition route keeps three independent outcomes:

- Visual identification: the image-only pass proposes an identity, status
  (likely/tentative/unidentified), evidence, explanation and uncalibrated model
  assessment before references are retrieved. Its selected name must belong to
  that image's proposed candidates. There are no fixed symbol shortlists.
- Reference verification: retrieved sources and a separate comparison audit may
  verify, contradict or leave the visual proposal inconclusive. Lookup outages,
  no results and processing failures are explicit states. They do not erase or
  upgrade the visual identity. A contradiction remains visible alongside the
  original visual proposal rather than silently rewriting it.
- Historical attribution: cited general history is retained only with verified
  reference evidence for the same candidate. It does not establish the depicted
  item's provenance, religion, age or intention. Authenticity is not scored.

Wikipedia first resolves exact titles and redirects to canonical pages, then
uses real search when needed. Redirect aliases and candidate-query associations
are retained; matching candidate text to an exact article title is no longer a
verification gate. Shared sources retain associations to all queries that found
them. Article text includes structural sections beyond the introduction.

Reference passages carry integer citation IDs. The server resolves these IDs to
canonical source records and exact text. Legacy passage IDs remain supported.
Required features separate machine-readable identifiers from descriptive text;
spelling normalization applies only to feature keys, not to symbol identities.
Unknown dimensions remain unresolved and do not discard the image-only result.

A separate audit checks target visibility, reference support, claimed relations,
required defining features and whether a difference discriminates the candidate.
Only a clear, source-backed, audited structural contradiction can reject a
candidate. Unreadable crossings, terminology, style and cultural associations
cannot substitute for opposing target/reference observations. Numeric conflicts
require known unequal counts. These safeguards are shared across symbol types.

The audit receives images, references and checks but no proposed winner/verdict.
Each vision stage retries once for invalid structured output. A failure of the
reference comparison/audit preserves the earlier valid image-only result and
reports a reference processing failure. Invalid image-only output remains an
error rather than inventing an identity. Books results are supplementary reading
and are not fed into visual naming. No sample research text is substituted.

Default model remains gpt-4o-mini; OPENAI_RECOGNITION_MODEL then
OPENAI_VISION_MODEL override it. No model setting was changed. These mechanisms
validate the evidence workflow, not broad recognition accuracy.

## Local deterministic checks (no external calls)

From code/:

    npx tsc --noEmit --incremental false
    node scripts/test-symbol-recognition.cjs
    node scripts/test-discern-image.cjs
    node scripts/test-manual-segmentation.cjs

The recognition tests mock services. They verify selection of a star despite a
misleading detector label, alternative generation, missing/unrelated citations,
missing comparisons, semantic-only rejections, unreadable structures, genuine
count mismatches, stylistic variants, direction-sensitive glyphs, previously
unseen candidate names, omitted defining features,
missing Books configuration, retrieval failures and malformed model output.
Passing these tests does not establish live model recognition accuracy.

## Live evaluation (external image processing)

Use only images approved for transmission to the configured OpenAI API.
Private fixtures and outputs belong in the ignored .temp directory.
Each fixture is a JSON request containing targetImageDataUrl (source close-up),
contextImageDataUrl (original), imageDataUrl (target), selectionKind (region or
painted), and boundingBox in original 0-1000 coordinates. No UI overlays should
appear in either image. The client prepares these automatically for normal use.

    node scripts/evaluate-recognition.cjs .temp/recognition-eval/example.json

This calls the configured local app and writes example.result.json alongside the
fixture. Wikipedia and Books receive candidate names, not the user's images.
Candidate names themselves can disclose information; use approved fixtures only.

Evaluate separately: exact-name accuracy, appropriate tentative/unknown outputs,
unsupported cultural claims, missed sub-symbols, retrieval failures, and latency.
Do not count mask confidence as name accuracy. Run multiple repetitions and keep
the model setting fixed; record outputs rather than demanding one exact model
phrase. Normalize acceptable aliases only after verifying the naming source.

Include unseen images and hard negatives: three-loop triquetras versus four-loop
knots; different four-loop crossing structures; geometric four-pointed stars
versus Latin/Greek crosses; stylized and rotated variants; blurred or occluded
crossings; unrelated ordinary objects; and fictional emblems. For the supplied
tattoo, independently verify the knot's crossings before using Bowen knot as a
ground-truth label. For the game image, geometric identification does not imply
historical or religious attribution. Do not optimize just for these two photos.

## Live observations, November 7, 2026

Before the structural-audit changes, the user approved processing both supplied images through OpenAI. The configured
model was gpt-4o-mini. In the latest knot run the route returned Bowen knot with
tentative status. Earlier runs still preferred generic knot families and included
incorrect statements about the Bowen reference. The star remained inconsistent;
the latest run returned an unidentified descriptive motif and rejected the
four-pointed-star candidate. It did not return the earlier Christian attribution.
These are diagnostic observations from two images, not an accuracy benchmark.
The naming objective is not fully achieved. Do not describe these runs as proving
reliable recognition. Compare stronger vision models on a broader reviewed set
before changing the configured default or claiming an accuracy improvement.

## Structural audit regression coverage

The active suite covers the invalid mathematical-terminology rejection reported
for Solomon's knot, unresolved/partial visibility, genuine count contradictions,
consistent versus inconsistent numeric relations, style-only claims, orientation
when it defines a direction-sensitive glyph, a previously unseen candidate name,
invalid passage IDs, missing audit checks, and omitted defining features. Specific
symbol names in these fixtures are test examples; no recognition name branch or
candidate seed list is used in the application.

Live model output may still omit or misclassify features and candidates. An
unresolved verdict is expected when evidence or citations cannot be verified;
it does not establish that a candidate is wrong. These safeguards should not be
reported as a broad visual-accuracy benchmark.

## Multi-region web UI observation, November 7, 2026

Ran the user-supplied 2x3 image through the actual Discern web UI, before and after
neutral-label changes, then selected all six detected regions to completion.
No programmatic replacement of analysis responses was used.

Before the change, all six mask instances inherited the segmentation prompt's
name. The user's screenshot showed Celtic Knot; the reproduced run showed
Endless Knot on all six instances. Only the first region automatically analyzed.
The shared prompt label was not an independent identity for each detected mask.
The loading overlay also blocked the image tools while the first region analyzed.

After the change, each detection starts as a numbered Unidentified symbol with
Not analyzed status. Analysis is selected per region, with independent progress
and results. Requests for the same pending region are shared. Inspection, pan,
zoom and completed results remain usable while other selected regions analyze.
Editing is disabled during analysis. Errors and retry belong to a particular
region. New image sessions abort requests and ignore late results from old images.
An unidentified result retains its neutral title and does not link to a library
entry based on an unverified proposed name.

The fixed run found six regions and all six analyses completed. Region numbers
follow detection order, not reading order: bottom-middle four-loop figure (1),
top-middle multi-loop woven figure (2), top-right intricate triangular figure (3),
bottom-right simple three-lobed figure (4), bottom-left angular figure (5), and
top-left triple spiral (6). Their visual descriptions differed appropriately,
showing independent target crops, and revisiting completed tabs showed cached
results. All six identities remained unidentified under the evidence checks.
Some descriptions still mixed visual statements with proposed identities or
symbolic meaning; neutral tab labels do not solve that recognition-layer issue.
Retrieved references/passages and missing evidence remain a separate limitation.
The overall image classifier also called the collection an isolated emblem;
that broad scene classification is not used as each region's identity.

The 1280x720 view left little image space beneath wrapped controls; the larger
viewport showed the image clearly. Tabs scroll horizontally when labels exceed
the available width. No browser console errors were observed in the tested flow.

Local regressions:

    node scripts/test-region-analysis.cjs
    node scripts/test-manual-segmentation.cjs

These cover neutral prompt-instance labels, per-region request deduplication,
independent completion/error states, retry, and stale-image response isolation.

## Separate-outcome regressions

Current tests require image-only names, evidence and assessment values to survive
missing research, unavailable retrieval, invalid citations, omitted defining
features and failed audits. Valid reference contradictions produce a separate
warning without replacing the visual proposal. Historical fields remain Unknown
without independently supported citations. Redirects, canonical title variants,
shared-source alias associations, integer citations and structured feature keys
are tested without symbol-specific application rules.

A live approved tattoo test returned Celtic knot / visual likely / reference
inconclusive / history not established. The approved star test remained visually
unidentified. These results demonstrate independent outcomes, not resolution of
fine-grained naming accuracy. Earlier UI observations above describe behavior
before this separation and should not be read as the current status contract.


## Verification reliability follow-up

- Reference processing now records safe stage-specific diagnostics: lookup,
  comparison, and audit. HTTP errors, timeouts, incomplete output, invalid JSON,
  and schema paths are distinguished without recording image data, credentials,
  or raw upstream error messages.
- Numbered citations no longer require redundant legacy citation arrays.
- Comparison output has a larger output allowance and instructions to keep checks
  concise. Incomplete provider output is detected explicitly.
- A strongly audited candidate may have reference support even when an alternative
  is unresolved. The UI explanation explicitly says that this does not establish
  a unique identity. Competing strong candidates remain inconclusive. Historical
  attribution remains withheld while alternatives are unresolved.
- Inconclusive outcomes expose the selected candidate's actual evidence gaps.
- Wikipedia requests are paced and identical in-flight requests are shared.
  Successful lookups are cached in memory for an hour; failures for 15 seconds.
  Exact titles are tried first, followed by a search without parenthetical
  qualifiers. Retrieved articles still require structural comparison.
- Live tests of the approved tattoo and star images completed their comparison
  stages. Tattoo retrieval failed for a parenthetical candidate name; the star's
  unavailable lookups were diagnosed as Wikipedia HTTP 429 responses. These
  motivated retrieval fixes, rather than a change to identity labels.

- A follow-up live tattoo run retrieved a Celtic-knot article and completed both
  comparison and audit with no processing diagnostics. Its visual pass selected
  no identity, so reference status was not_requested and structural comparisons
  remained unresolved. This is not a successful specific-symbol identification.
- HTTP 429 responses start a shared upstream cooldown, honoring Retry-After
  within a 15-second to five-minute bound. Queued requests report the rate limit
  without immediately making more upstream requests. Covered by a regression.
