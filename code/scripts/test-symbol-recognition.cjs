const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

function load(relative, overrides = {}) {
  const cache = new Map();
  function read(filename) {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const localRequire = name => {
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      if (name.startsWith('@/')) return read(path.join(__dirname, '..', name.slice(2) + '.ts'));
      if (name.startsWith('.')) return read(path.resolve(path.dirname(filename), name + '.ts'));
      return require(name);
    };
    const context = { exports, require: localRequire, console, Response, Buffer, URL, URLSearchParams, AbortSignal, Uint8Array, setTimeout,
      process: { env: {} }, fetch: () => { throw new Error('Unexpected network request'); }, ...overrides };
    vm.runInNewContext(ts.transpile(fs.readFileSync(filename, 'utf8'), { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }), context, { filename });
    return exports;
  }
  return read(path.join(__dirname, '..', relative));
}

const observations = { imageType: 'single_symbol', dominantSubject: 'fantasy emblem', family: 'star_or_cross', description: 'Four tapered rays, elongated vertically', features: ['four pointed rays', 'curved tapered edges'], embeddedSymbols: [], candidates: [{ name: 'Four-pointed star', distinguishingFeatures: ['tapered rays'] }, { name: 'Cross', distinguishingFeatures: ['parallel bars'] }], visualIdentification: { selectedCandidateName: 'Four-pointed star', descriptiveName: 'Elongated four-pointed star', status: 'likely', confidence: 8, explanation: 'Four tapered rays are visible, unlike parallel cross bars.', evidence: ['four rays', 'tapered edges'] } };
const source = { id: 'wiki-1', title: 'Four-pointed star', url: 'https://en.wikipedia.org/?curid=1', excerpt: 'A four-pointed star has four rays with tapered edges.', kind: 'wikipedia', candidateName: 'Four-pointed star' };
const crossSource = { ...source, id: 'wiki-cross', title: 'Cross', excerpt: 'A cross has intersecting bars with parallel edges.' };
const sources = [source, crossSource];
const recognition = load('lib/symbol-recognition.ts');
const names = recognition.candidateNames(observations);
const makeCheck = (id, feature, relation, referenceSource = source) => ({ id, feature,
  reference: { description: feature === 'ray_count' ? 'Four rays' : 'Tapered edges', passageIds: [referenceSource.id + ":p1"], sourceIds: [referenceSource.id], value: feature === 'ray_count' ? 4 : null },
  target: { description: 'Four tapered rays visible', location: 'center of target close-up', visibility: 'clear', value: feature === 'ray_count' ? 4 : null }, relation, discriminating: true });
const decision = { selectedCandidateName: 'Four-pointed star', descriptiveName: 'Elongated four-pointed star', category: 'Geometric motif', status: 'supported', confidence: 8, prominence: 9,
  explanation: 'Tapered rays match the star rather than cross bars.', comparisons: names.map(name => ({ candidateName: name, requiredFeatures: name === 'Four-pointed star' ? ['ray_count', 'edge_shape'] : ['edge_shape'], referenceDefinition: name === 'Four-pointed star' ? source.excerpt : crossSource.excerpt,
    checks: name === 'Four-pointed star' ? [makeCheck('rays', 'ray_count', 'match'), makeCheck('edges', 'edge_shape', 'match')] : [makeCheck('bars', 'edge_shape', 'conflict', crossSource)], verdict: name === 'Four-pointed star' ? 'strong' : 'rejected' })),
  historicalContext: { summary: 'General star history', origin: 'Unknown', timePeriod: 'Unknown', primaryUse: 'Decoration', culturalPrevalence: 'Unknown', sourceIds: ['wiki-1'] } };
const approvedAudit = decision => ({ reviews: decision.comparisons.map(candidate => ({ candidateName: candidate.candidateName, requiredFeaturesSupported: true, checks: candidate.checks.map(check => ({ checkId: check.id, referenceSupported: true, targetSupported: true, relationSupported: true, discriminating: true, reason: 'Source and visible structure agree with the stated comparison.' })) })) });
const audit = approvedAudit(decision);
const assemble = (candidateDecision = decision, candidateSources = sources, candidateAudit = audit) => recognition.assembleAnalysis(observations, candidateDecision, names, candidateSources, candidateAudit);
assert.ok(names.includes('Cross') && names.includes('Four-pointed star'));
assert.equal(names.length, observations.candidates.length);
assert.ok(recognition.candidateNames({ ...observations, family: 'other' }).includes('Four-pointed star'));
assert.equal(recognition.candidateNames({ ...observations, family: 'knot' }).includes('Bowen knot'), false, 'Family labels must not inject a symbol shortlist');
const unseen = { ...observations, candidates: [{ name: 'Previously unseen emblem', distinguishingFeatures: ['distinctive stroke layout'] }] };
assert.deepEqual(Array.from(recognition.candidateNames(unseen)), ['Previously unseen emblem']);
assert.equal(assemble().visualIdentification.status, 'likely');
assert.equal(assemble().referenceVerification.status, 'verified');
assert.equal(assemble().historicalAttribution.status, 'source_supported');
assert.equal(assemble().identification.comparisons[0].checks[0].reference.quote, source.excerpt, 'Displayed quotations must be reconstructed from retrieved passages');
assert.equal(assemble(decision, []).visualIdentification.status, 'likely');
assert.equal(assemble(decision, []).name, 'Four-pointed star');
assert.equal(assemble(decision, []).confidence, 8);
assert.equal(assemble(decision, []).referenceVerification.status, 'no_results');
assert.equal(assemble(decision, []).authenticity, null);
assert.equal(assemble(decision, []).origin, 'Unknown');
assert.equal(recognition.assembleAnalysis(observations, decision, names, sources).referenceVerification.status, 'processing_failed', 'Missing audit must not grant reference verification');
assert.equal(recognition.assembleAnalysis(observations, decision, names, sources).visualIdentification.status, 'likely');
const incomplete = structuredClone(decision); incomplete.comparisons.pop();
assert.equal(assemble(incomplete).referenceVerification.status, 'verified', 'An unevaluated alternative does not erase independently supported evidence');
assert.match(assemble(incomplete).referenceVerification.explanation, /alternatives remain unresolved/);
assert.equal(assemble(incomplete).historicalAttribution.status, 'not_established');
const invented = { ...decision, selectedCandidateName: 'Invented identity' };
assert.equal(assemble(invented).name, 'Four-pointed star', 'A later comparison must not rewrite the image-only name');
assert.equal(assemble(invented).historicalAttribution.status, 'not_established');
const unsupportedQuote = structuredClone(decision); unsupportedQuote.comparisons[0].checks[0].reference.passageIds = ['invented:p999'];
assert.equal(assemble(unsupportedQuote).referenceVerification.status, 'inconclusive');
assert.equal(assemble(unsupportedQuote).visualIdentification.status, 'likely');
const disputedAudit = structuredClone(audit); disputedAudit.reviews[0].checks[0].targetSupported = false;
assert.equal(assemble(decision, sources, disputedAudit).referenceVerification.status, 'inconclusive');

// Exact regression: the mathematical-link definition is not a target mismatch,
// even if an overly agreeable verifier marks it as supported.
const knotSource = { ...source, id: 'wiki-solomon', title: "Solomon's knot", excerpt: "Solomon's knot is a link of two closed loops with four crossings, not a mathematical knot." };
const knotCase = { ...decision, selectedCandidateName: "Solomon's knot", comparisons: [{ candidateName: "Solomon's knot", requiredFeatures: ['component_count', 'crossing_count'], referenceDefinition: knotSource.excerpt,
  checks: [makeCheck('term', 'mathematical_terminology', 'conflict', knotSource)], verdict: 'rejected' }] };
let result = recognition.verifyComparisons(knotCase, ["Solomon's knot"], [knotSource], approvedAudit(knotCase))[0];
assert.equal(result.verdict, 'unresolved'); assert.equal(result.contradictions.length, 0);
assert.equal(result.checks[0].verification, 'inapplicable');
for (const feature of ['rendering_style', 'cultural_association']) {
  const variant = structuredClone(knotCase); variant.comparisons[0].checks[0].feature = feature;
  assert.equal(recognition.verifyComparisons(variant, ["Solomon's knot"], [knotSource], approvedAudit(variant))[0].verdict, 'unresolved');
}
// A real count conflict may rule out a candidate only when both counts can be
// seen and the independent audit confirms that this distinction matters.
const componentConflict = makeCheck('components', 'component_count', 'conflict', knotSource);
componentConflict.reference.value = 2; componentConflict.reference.description = 'Two separate closed components';
componentConflict.target.value = 1; componentConflict.target.description = 'One continuously traced component';
const structuralCase = structuredClone(knotCase); structuralCase.comparisons[0].checks = [componentConflict];
assert.equal(recognition.verifyComparisons(structuralCase, ["Solomon's knot"], [knotSource], approvedAudit(structuralCase))[0].verdict, 'rejected');
const blurry = structuredClone(structuralCase); blurry.comparisons[0].checks[0].target.visibility = 'unreadable';
assert.equal(recognition.verifyComparisons(blurry, ["Solomon's knot"], [knotSource], approvedAudit(blurry))[0].verdict, 'unresolved');
const equal = structuredClone(structuralCase); equal.comparisons[0].checks[0].target.value = 2;
assert.equal(recognition.verifyComparisons(equal, ["Solomon's knot"], [knotSource], approvedAudit(equal))[0].verdict, 'unresolved');
const nonDiscriminating = approvedAudit(structuralCase); nonDiscriminating.reviews[0].checks[0].discriminating = false;
assert.equal(recognition.verifyComparisons(structuralCase, ["Solomon's knot"], [knotSource], nonDiscriminating)[0].verdict, 'unresolved');
const untraceable = structuredClone(structuralCase); untraceable.comparisons[0].checks[0].relation = 'unknown'; untraceable.comparisons[0].checks[0].target.value = null;
assert.equal(recognition.verifyComparisons(untraceable, ["Solomon's knot"], [knotSource], approvedAudit(untraceable))[0].verdict, 'unresolved');
const lowerRanked = structuredClone(decision); lowerRanked.comparisons[0].requiredFeatures = ['edge_shape']; lowerRanked.comparisons[0].checks = [makeCheck('one', 'edge_shape', 'match')]; lowerRanked.comparisons[0].verdict = 'less_likely';
assert.equal(recognition.verifyComparisons(lowerRanked, names, sources, approvedAudit(lowerRanked))[0].verdict, 'less_likely');
const omittedDefinition = structuredClone(audit); omittedDefinition.reviews[0].requiredFeaturesSupported = false;
assert.equal(assemble(decision, sources, omittedDefinition).referenceVerification.status, 'inconclusive');
const glyphSource = { ...source, id: 'wiki-glyph', title: 'Direction-sensitive glyph', excerpt: 'The glyph has an upward-pointing stroke; its inverted form is a different glyph.' };
const glyphCase = { ...decision, comparisons: [{ candidateName: glyphSource.title, referenceDefinition: glyphSource.excerpt, requiredFeatures: ['orientation'], checks: [makeCheck('direction', 'orientation', 'conflict', glyphSource)], verdict: 'rejected' }] };
assert.equal(recognition.verifyComparisons(glyphCase, [glyphSource.title], [glyphSource], approvedAudit(glyphCase))[0].verdict, 'rejected', 'Reference-supported direction can distinguish glyphs without a special rule for a named symbol');
const missingReferences = structuredClone(decision);
missingReferences.comparisons[0].checks.forEach(check => { check.reference.passageIds = []; check.reference.sourceIds = []; check.relation = 'unknown'; });
missingReferences.comparisons[0].verdict = 'unknown';
const parsedMissing = recognition.identificationSchema.parse(missingReferences);
assert.equal(parsedMissing.comparisons[0].verdict, 'unresolved');
assert.equal(recognition.verifyComparisons(parsedMissing, names, [], approvedAudit(parsedMissing))[0].verdict, 'unresolved', 'Missing research should become uncertainty, not a failed analysis or fabricated evidence');
const multilingual = { ...observations, candidates: [{ name: '\u7d50', distinguishingFeatures: ['one arrangement'] }, { name: '\u661f', distinguishingFeatures: ['another arrangement'] }] };
assert.equal(recognition.candidateNames(multilingual).length, 2, 'Names in non-Latin scripts must not collapse to the same empty key');
const unsupportedDimension = structuredClone(decision); unsupportedDimension.comparisons[0].requiredFeatures.push('unmodeled_visual_dimension');
const parsedDimension = recognition.identificationSchema.parse(unsupportedDimension);
assert.equal(assemble(parsedDimension).referenceVerification.status, 'inconclusive', 'An unfamiliar feature must remain unresolved, not crash or be silently discarded');
// A reference outage affects verification, never the image-only judgment.
const outage = recognition.assembleAnalysis(observations, undefined, names, [], undefined, { lookupStatus: 'unavailable', comparisonAvailable: false });
assert.equal(outage.name, 'Four-pointed star'); assert.equal(outage.confidence,8);
assert.equal(outage.visualIdentification.status,'likely'); assert.equal(outage.referenceVerification.status,'unavailable');
assert.equal(outage.origin,'Unknown'); assert.equal(outage.historicalAttribution.status,'not_established');
const noVisual = { ...observations, visualIdentification: { ...observations.visualIdentification, selectedCandidateName: null, status:'unidentified', evidence: [] } };
assert.equal(recognition.assembleAnalysis(noVisual, decision, names, sources, audit).visualIdentification.status,'unidentified');
const invalidVisual = { ...observations, visualIdentification: { ...observations.visualIdentification, selectedCandidateName:'Not proposed from the image' } };
assert.equal(recognition.assembleAnalysis(invalidVisual, decision, names, sources, audit).confidence,null);
const aliasSources = [{ ...source, title:'Canonical star article', aliases:['Four-pointed star'] }, crossSource];
assert.equal(assemble(decision,aliasSources).referenceVerification.status,'verified', 'Canonical title spelling must not block audited reference evidence');
const conflictDecision = structuredClone(decision);
conflictDecision.comparisons[0].checks[0].relation = 'conflict'; conflictDecision.comparisons[0].checks[0].target.value = 3;
const conflict = assemble(conflictDecision,sources,approvedAudit(conflictDecision));
assert.equal(conflict.visualIdentification.status,'likely'); assert.equal(conflict.name,'Four-pointed star');
assert.equal(conflict.referenceVerification.status,'contradicted'); assert.equal(conflict.historicalAttribution.status,'not_established');
// Structured feature identifiers and prose descriptions are distinct.
const structuredRequirements = structuredClone(decision);
structuredRequirements.comparisons[0].requiredFeatures = [{feature:'ray count',description:'Four rays visible'},{feature:'edge-shape',description:'Tapered edges'}];
assert.equal(assemble(structuredRequirements).referenceVerification.status,'verified');
const numericCitations = structuredClone(decision);
numericCitations.comparisons[0].checks.forEach(check => { check.reference.citationIds = [1]; check.reference.passageIds = []; check.reference.sourceIds = []; });
assert.equal(assemble(numericCitations).referenceVerification.status,'verified');
assert.equal(assemble(numericCitations).identification.comparisons[0].checks[0].reference.quote,source.excerpt);
// Numeric citations do not require redundant legacy citation arrays.
const modernCitations = structuredClone(numericCitations);
modernCitations.comparisons[0].checks.forEach(check => { delete check.reference.passageIds; delete check.reference.sourceIds; });
assert.equal(assemble(recognition.identificationSchema.parse(modernCitations)).referenceVerification.status, 'verified');
const competing = structuredClone(decision);
competing.comparisons[1] = { ...structuredClone(competing.comparisons[0]), candidateName: 'Cross' };
assert.equal(assemble(competing, sources, approvedAudit(competing)).referenceVerification.status, 'inconclusive', 'Two strongly supported candidates must remain ambiguous');
(async () => {
  let fetches = 0;
  const research = load('lib/symbol-research.ts', { fetch: async url => {
    fetches++;
    const query = new URL(url).searchParams;
    if (query.has('titles')) return Response.json({ query: { pages: [{ title: 'Bowen knot', missing: true }] } });
    assert.equal(query.get('generator'), 'search');
    assert.equal(query.get('gsrsearch'), 'Bowen knot');
    assert.equal(query.has('titles'), false);
    assert.equal(query.has('exintro'), false, 'Structural reference sections must not be excluded');
    return Response.json({ query: { pages: [{ pageid: 1, title: 'Bowen knot', extract: 'A four-loop heraldic knot.' }] } });
  } });
  const books = await research.lookupBooks('Bowen knot');
  assert.equal(books.status, 'unavailable'); assert.equal(books.sources.length, 0); assert.equal(fetches, 0);
  assert.equal((await research.lookupWikipedia('Bowen knot')).sources[0].title, 'Bowen knot');
  assert.equal(research.wikipediaSearchTerm('Emblem (stylized variation)'), 'Emblem');
  let sharedFetches = 0;
  const sharedLookup = load('lib/symbol-research.ts', {fetch: async () => {
    sharedFetches++;
    return Response.json({query:{pages:[{pageid:123,title:'Emblem',extract:'An emblem.'}]}});
  }});
  await Promise.all([sharedLookup.lookupWikipedia('Emblem'),sharedLookup.lookupWikipedia('Emblem')]);
  await sharedLookup.lookupWikipedia('Emblem');
  assert.equal(sharedFetches,1,'Concurrent regions and subsequent requests share a cached lookup');
  const qualified = load('lib/symbol-research.ts', {fetch: async url => {
    const params = new URL(url).searchParams;
    if (params.has('titles')) return Response.json({query:{pages:[{missing:true}]}});
    assert.equal(params.get('gsrsearch'),'Emblem');
    return Response.json({query:{pages:[{pageid:123,title:'Emblem',extract:'An emblem.'}]}});
  }});
  assert.equal((await qualified.lookupWikipedia('Emblem (variation)')).sources[0].candidateName,'Emblem (variation)');
  let rateRequests = 0;
  const rateLimited = load('lib/symbol-research.ts', {fetch: async () => {rateRequests++; return new Response('',{status:429,headers:{'retry-after':'30'}});}});
  const rateResults = await Promise.all([rateLimited.lookupWikipedia('First emblem'),rateLimited.lookupWikipedia('Second emblem')]);
  assert.equal(rateRequests,1,'An upstream rate limit prevents queued requests from immediately hitting the same service');
  assert.ok(rateResults.every(result => result.failureCode === 'http_429'));
  const redirected = load('lib/symbol-research.ts', { fetch: async url => {
    assert.equal(new URL(url).searchParams.get('titles'),'Alias emblem');
    return Response.json({ query: { redirects: [{from:'Alias emblem',to:'Canonical emblem'}], pages:[{pageid:42,title:'Canonical emblem',extract:'A documented symbolic emblem.'}] } });
  } });
  const canonical = await redirected.lookupWikipedia('Alias emblem');
  assert.equal(canonical.sources[0].title,'Canonical emblem'); assert.ok(canonical.sources[0].aliases.includes('Alias emblem'));
  const shared = redirected.uniqueSources([canonical.sources[0],{...canonical.sources[0],candidateName:'Canonical emblem',candidateNames:['Canonical emblem']}]);
  assert.deepEqual(Array.from(shared[0].candidateNames),['Alias emblem','Canonical emblem']);
  const failed = load('lib/symbol-research.ts', { process: { env: { GOOGLE_BOOKS_API_KEY: 'test' } }, fetch: async () => new Response('', { status: 503 }) });
  assert.equal((await failed.lookupBooks('cross')).sources.length, 0);
  assert.equal((await failed.lookupWikipedia('cross')).status, 'unavailable');
  assert.equal((await failed.lookupWikipedia('cross')).failureCode, 'http_503');
  let modelCalls = [];
  const route = load('app/api/enhancedAnalysis/route.ts', {
    process: { env: { OPENAI_API_KEY: 'test' } },
    fetch: async (url, options) => {
      if (url.includes('/responses')) {
        const body = JSON.parse(options.body); modelCalls.push(body);
        return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(modelCalls.length === 1 ? observations : modelCalls.length === 2 ? decision : audit) }] }] });
      }
      return Response.json({ query: { pages: [{ pageid: 1, title: 'Four-pointed star', extract: source.excerpt }, { pageid: 'cross', title: 'Cross', extract: crossSource.excerpt }] } });
    },
  });
  const response = await route.POST(new Request('http://localhost/api/enhancedAnalysis', { method: 'POST', body: JSON.stringify({ imageDataUrl: 'data:image/png;base64,target', targetImageDataUrl: 'data:image/png;base64,target', contextImageDataUrl: 'data:image/png;base64,original', symbolName: 'DETECTOR_ONLY_LABEL' }) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.analysis.name, 'Four-pointed star');
  assert.equal(modelCalls.length, 3);
  const verifierPayload = JSON.parse(modelCalls[2].input[1].content.find(item => item.type === 'input_text' && item.text.startsWith('{')).text);
  assert.equal('selectedCandidateName' in verifierPayload, false);
  assert.ok(verifierPayload.comparisons.every(item => !('verdict' in item)));
  assert.equal(modelCalls[0].input[1].content.filter(item => item.type === 'input_image').length, 2);
  assert.equal(JSON.stringify(modelCalls).includes('DETECTOR_ONLY_LABEL'), false, 'The detector label must not anchor identification');
  let degradedCalls = 0;
  const degraded = load('app/api/enhancedAnalysis/route.ts', {
    console: { error() {}, warn() {} }, process: { env: { OPENAI_API_KEY: 'test' } },
    fetch: async url => {
      if (url.includes('/responses')) { degradedCalls++; return Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(degradedCalls === 1 ? observations : degradedCalls === 2 ? decision : {}) }] }] }); }
      return Response.json({ query: { pages: [{ pageid: 1, title: 'Four-pointed star', extract: source.excerpt }, { pageid: 'cross', title: 'Cross', extract: crossSource.excerpt }] } });
    },
  });
  const degradedResponse = await degraded.POST(new Request('http://localhost/api/enhancedAnalysis', { method: 'POST', body: JSON.stringify({ imageDataUrl: 'data:image/png;base64,target' }) }));
  const degradedResult = await degradedResponse.json();
  assert.equal(degradedResponse.status, 200);
  assert.equal(degradedResult.analysis.identification.verificationAvailable, false);
  assert.equal(degradedResult.analysis.visualIdentification.status, 'likely');
  assert.equal(degradedResult.analysis.name, 'Four-pointed star');
  assert.equal(degradedResult.analysis.referenceVerification.status, 'processing_failed');
  assert.equal(degradedResult.analysis.origin, 'Unknown');
  assert.equal(degradedResult.analysis.referenceVerification.diagnostics[0].stage, 'audit');
  assert.equal(degradedResult.analysis.referenceVerification.diagnostics[0].code, 'invalid_schema');
  assert.ok(degradedResult.analysis.referenceVerification.diagnostics[0].fields.includes('reviews: invalid_type'));
  assert.ok(degradedResult.analysis.identification.comparisons.every(candidate => candidate.verdict !== 'rejected'));
  for (const [code, modelResponse] of [
    ['http_429', () => Response.json({error:{message:'PRIVATE_UPSTREAM_DETAILS'}}, {status:429})],
    ['incomplete_output', () => Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[]})],
  ]) {
    let calls = 0;
    const broken = load('app/api/enhancedAnalysis/route.ts', {
      console: {error() {}, warn() {}}, process:{env:{OPENAI_API_KEY:'test'}},
      fetch: async url => {
        if (url.includes('/responses')) { calls++; return calls === 1 ? Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(observations)}]}]}) : modelResponse(); }
        return Response.json({query:{pages:[{pageid:1,title:source.title,extract:source.excerpt}]}});
      },
    });
    const response = await broken.POST(new Request('http://localhost/api/enhancedAnalysis', {method:'POST',body:JSON.stringify({imageDataUrl:'data:image/png;base64,target'})}));
    const body = await response.json();
    assert.equal(response.status,200);
    assert.equal(body.analysis.referenceVerification.diagnostics[0].stage,'comparison');
    assert.equal(body.analysis.referenceVerification.diagnostics[0].code,code);
    assert.equal(JSON.stringify(body).includes('PRIVATE_UPSTREAM_DETAILS'),false);
    assert.equal(body.analysis.visualIdentification.status,'likely');
  }
  const invalid = await route.POST(new Request('http://localhost/api/enhancedAnalysis', { method: 'POST', body: JSON.stringify({ imageDataUrl: 'not-an-image' }) }));
  assert.equal(invalid.status, 400);
  const malformed = load('app/api/enhancedAnalysis/route.ts', { process: { env: { OPENAI_API_KEY: 'test' } }, console: { error() {} }, fetch: async () => Response.json({ output: [{ content: [{ type: 'output_text', text: '{}' }] }] }) });
  const failure = await malformed.POST(new Request('http://localhost/api/enhancedAnalysis', { method: 'POST', body: JSON.stringify({ imageDataUrl: 'data:image/png;base64,target' }) }));
  assert.equal(failure.status, 502, 'Malformed model output must never become a successful 7/10 result');
  console.log('Passed: separate visual/reference/history outcomes, reference outages, contradiction warnings, redirects/aliases, numeric citations, structured features, semantic-rejection regression, structural contradictions, unresolved crossings, style variants, discriminating evidence, count consistency, exact quotes, independent audit, missing-audit safeguards, real retrieval, and invalid-output handling.');
})().catch(error => { console.error(error); process.exitCode = 1; });
