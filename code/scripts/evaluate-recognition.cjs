// Usage: node scripts/evaluate-recognition.cjs path/to/request.json [...]
// Request JSON contains source images prepared by the client (or an evaluation
// fixture), never a screenshot of the selection UI. Results are written beside
// each request. Keep private fixtures under the ignored .temp directory.
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (!args.length) { console.error('Provide one or more recognition request JSON files.'); process.exit(1); }
(async () => {
  await Promise.all(args.map(async filename => {
    const started = Date.now();
    const response = await fetch(`${process.env.SEMIOTE_EVAL_URL || 'http://localhost:3000'}/api/enhancedAnalysis`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: fs.readFileSync(filename, 'utf8'), signal: AbortSignal.timeout(180000),
    });
    const result = await response.json();
    fs.writeFileSync(filename.replace(/\.json$/, '') + '.result.json', JSON.stringify(result, null, 2), 'utf8');
    const analysis = result.analysis;
    console.log(JSON.stringify({ fixture: path.basename(filename), httpStatus: response.status, seconds: Math.round((Date.now() - started) / 1000),
      name: analysis?.name, visualStatus: analysis?.visualIdentification?.status, referenceStatus: analysis?.referenceVerification?.status, historicalStatus: analysis?.historicalAttribution?.status, verificationDiagnostics: analysis?.referenceVerification?.diagnostics, verificationIssues: analysis?.referenceVerification?.issues, status: analysis?.identification?.status, explanation: analysis?.identification?.explanation,
      candidates: analysis?.identification?.comparisons?.map(item => ({ name: item.candidateName, verdict: item.verdict, differences: item.contradictions, uncertainties: item.uncertainties })),
      sourceCount: analysis?.sources?.length, researchStatus: result.researchStatus, error: result.details || result.error,
    }, null, 2));
    if (!response.ok) process.exitCode = 1;
  }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
