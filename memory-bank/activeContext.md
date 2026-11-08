# Active Context

## Current Focus
- Symbol Detection & Recognition
- Semiote Library
- User-Defined Semiotes: Developing features related to user-defined symbols and their analysis.

## Recent Changes
Implemented initial symbol detection and recognition functionality.

## Next Steps
- Finalize the demo flow
- Test the demo
- Prepare presentation materials

## Active Decisions
- Prioritize features for the demo
- Decide on temporary workarounds

## Open Questions
- Specific symbols or datasets for the demo
- Expected audience interests

## Current Challenges
- Balancing a polished demo with limited time
- Ensuring demo stability.

## Future Exploration: Visual Retrieval
Recorded November 8, 2026. User requested retaining this idea for later exploration; it is not an implementation commitment.

- Explore a reference-image retrieval stage for Discern: segment the symbol, retrieve visually similar labeled examples, then compare distinguishing structures before assigning a specific name.
- Investigate visual embeddings (for example, DINOv2) over a curated symbol-image library. Retrieved examples supply candidates and evidence, not automatic identity confirmation.
- Cover multiple symbol families (knots, stars, glyphs, religious symbols, emblems) without fixed symbol-specific decision rules. Preserve uncertainty for unfamiliar symbols and ambiguous matches.
- Keep visual identity separate from historical or cultural attribution. A similar-looking reference does not establish provenance or intended meaning.
- Evaluate on varied depictions and near-neighbor symbols, including rotations, stylization, tattoos, game imagery, and unknown symbols. Measure retrieval recall, correct specific identifications, confident errors, latency, and cost against the current pipeline.
- Prerequisites to investigate: reference-image licensing and source attribution, label quality, coverage and variants, embedding/index hosting costs, and whether retrieval actually improves fine structural distinctions.
- Candidate implementation shape: segmentation → reference-image retrieval → structural comparison → supported name or explicit uncertainty. No model/provider switch has been selected for this exploration.

Reference: https://github.com/facebookresearch/dinov2
