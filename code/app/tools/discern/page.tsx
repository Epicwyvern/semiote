"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowUpFromLine, ChevronLeft, ChevronRight, ExternalLink, FileSymlink, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

import { DiscernImage } from "@/components/discern-image"
import { DiscernSources, type ResearchStatus } from "@/components/discern-sources"
import type { SymbolRegion } from "@/lib/discern-image"
import { createRegionAnalysisManager, regionLabel, type RegionAnalysisState } from "@/lib/region-analysis"
import { recognitionCrop } from "@/lib/recognition-images"
import type { ResearchSource } from "@/lib/symbol-research"
import type { VerifiedComparison, VisualIdentification, HistoricalAttribution } from "@/lib/symbol-recognition"

type SymbolAnalysis = {
  name: string
  category: string
  confidence: number | null
  prominence: number | null
  authenticity: number | null
  description: string
  overallScoreRationale: string
  contextDescription: string
  origin: string
  timePeriod: string
  primaryUse: string
  culturalPrevalence: string
  visualComplexity: string
  keyElements: string
  thinkingProcess: string[]
  imageType: string
  dominantSubject: string
  embeddedSymbols: string[]
  classificationReasoning: string
  identification?: { status: string; descriptiveName: string; explanation: string; comparisons: VerifiedComparison[]; verificationAvailable?: boolean; historicalSourceIds: string[] }
  visualIdentification?: VisualIdentification
  historicalAttribution?: HistoricalAttribution
  sources: ResearchSource[]
  furtherReading: ResearchSource[]
  researchStatus?: ResearchStatus
}

const emptyAnalysis: SymbolAnalysis = {
  name: "",
  category: "Symbol",
  confidence: null,
  prominence: null,
  authenticity: null,
  description: "",
  overallScoreRationale: "",
  contextDescription: "",
  origin: "Unknown",
  timePeriod: "Unknown",
  primaryUse: "Unknown",
  culturalPrevalence: "Unknown",
  visualComplexity: "Unknown",
  keyElements: "Unknown",
  thinkingProcess: [],
  imageType: "ambiguous",
  dominantSubject: "Unknown subject",
  embeddedSymbols: [],
  classificationReasoning: "",
  sources: [],
  furtherReading: []
}

const asText = (value: unknown, fallback = "Unknown") => typeof value === "string" && value.trim() ? value : fallback
const withoutInlineLinks = (value: string) => value.replace(/\[([^\]]+)\]\((?:https?:\/\/[^)]+)\)/gi, '$1')
  .replace(/\(?https?:\/\/[^\s)]+\)?/gi, '').replace(/\(\s*[a-z0-9.-]+\.[a-z]{2,}\s*\)/gi, '')
  .replace(/\s{2,}/g, ' ').trim()
const asScore = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(10, value))
}

function normalizeAnalysis(data: Record<string, unknown>): SymbolAnalysis {
  const embeddedSymbols = Array.isArray(data.embeddedSymbols)
    ? data.embeddedSymbols.filter((item): item is string => typeof item === "string")
    : []
  const thinkingProcess = Array.isArray(data.thinkingProcess)
    ? data.thinkingProcess.filter((item): item is string => typeof item === "string")
    : []

  return {
    ...emptyAnalysis,
    name: asText(data.name, "Symbol"),
    category: asText(data.category, "Symbol"),
    confidence: asScore(data.confidence),
    prominence: asScore(data.prominence),
    authenticity: asScore(data.authenticity),
    description: asText(data.description, "No visual description returned."),
    overallScoreRationale: asText(data.overallScoreRationale, ""),
    contextDescription: asText(data.contextDescription, ""),
    origin: asText(data.origin),
    timePeriod: asText(data.timePeriod),
    primaryUse: asText(data.primaryUse),
    culturalPrevalence: asText(data.culturalPrevalence),
    visualComplexity: asText(data.visualComplexity),
    keyElements: asText(data.keyElements),
    thinkingProcess,
    imageType: asText(data.imageType, "ambiguous"),
    dominantSubject: asText(data.dominantSubject),
    embeddedSymbols,
    classificationReasoning: asText(data.classificationReasoning, ""),
    identification: data.identification && typeof data.identification === 'object' ? data.identification as SymbolAnalysis['identification'] : undefined,
    visualIdentification: data.visualIdentification && typeof data.visualIdentification === 'object' ? data.visualIdentification as VisualIdentification : undefined,
    historicalAttribution: data.historicalAttribution && typeof data.historicalAttribution === 'object' ? data.historicalAttribution as HistoricalAttribution : undefined,
    sources: Array.isArray(data.sources) ? data.sources as ResearchSource[] : [],
    furtherReading: Array.isArray(data.furtherReading) ? data.furtherReading as ResearchSource[] : [],
    researchStatus: data.researchStatus && typeof data.researchStatus === 'object' ? data.researchStatus as ResearchStatus : undefined
  }
}

export default function DiscernPage() {
  const [images, setImages] = useState<string[]>([])
  const [imageIndex, setImageIndex] = useState(0)
  const [detectedDrafts, setDetectedDrafts] = useState<SymbolRegion[]>([])
  const [regions, setRegions] = useState<SymbolRegion[]>([])
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, SymbolAnalysis>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [analysisStates, setAnalysisStates] = useState<Record<string, RegionAnalysisState>>({})
  const [finding, setFinding] = useState(false)
  const [discoveryComplete, setDiscoveryComplete] = useState(false)
  const discovery = useRef<AbortController | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedRegion = regions.find((region) => region.id === selectedRegionId) || null
  const selectedAnalysis = selectedRegionId ? analyses[selectedRegionId] : null
  const getRegionLabel = (region: SymbolRegion) => {
    const analysis = analyses[region.id]
    return analysis ? regionLabel(analysis) : region.customName?.trim() || region.name
  }
  const isAnyAnalysisRunning = Object.values(analysisStates).some(state => state.status === 'analyzing' || state.status === 'queued')
  const imageSession = useRef(0)
  const analysisManager = useRef<ReturnType<typeof createRegionAnalysisManager<SymbolAnalysis>> | null>(null)
  if (!analysisManager.current) analysisManager.current = createRegionAnalysisManager<SymbolAnalysis>({
    onState: (id, state) => setAnalysisStates(previous => ({ ...previous, [id]: state })),
    onResult: (id, result) => setAnalyses(previous => ({ ...previous, [id]: result })),
  }, 1)
  useEffect(() => () => { analysisManager.current?.reset(); discovery.current?.abort() }, [])

  const manualImages = useRef<Record<string, string>>({})

  const analyzeRegion = (imageDataUrl: string, region: SymbolRegion, priority = false) => analysisManager.current!.run(region.id, async signal => {
    const targetImageDataUrl = manualImages.current[region.id] || await recognitionCrop(imageDataUrl, region.boundingBox, !region.boxed)
    const response = await fetch('/api/enhancedAnalysis', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(region.boxed
        ? { imageDataUrl: targetImageDataUrl }
        : { targetImageDataUrl, contextImageDataUrl: imageDataUrl,
            selectionKind: region.manual ? 'painted' : 'region',
            boundingBox: { ...region.boundingBox, coordinateScale: 1000 } }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.details || result.error || 'Symbol analysis failed')
    if (!result.analysis || typeof result.analysis !== 'object') throw new Error('The analysis response was incomplete')
    return normalizeAnalysis({ ...result.analysis, furtherReading: result.furtherReading, researchStatus: result.researchStatus })
  }, priority)

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const imageItem = Array.from(event.clipboardData?.items || []).find((item) => item.type.startsWith('image/'))
      const file = imageItem?.getAsFile()
      if (!file) return
      event.preventDefault()
      void readFiles([file])
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  const readFiles = async (files: File[]) => {
    const accepted = files.filter((file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024)
    if (accepted.length === 0) {
      setError('Choose an image under 10 MB in PNG, JPG, WEBP, or SVG format.')
      return
    }
    if (accepted.length < files.length) setError('Some files were skipped because they are not supported images or exceed 10 MB.')

    const dataUrls = await Promise.all(accepted.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'))
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
      reader.readAsDataURL(file)
    })))
    resetAnalysis()
    setImages(dataUrls)
    setImageIndex(0)
  }

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length) void readFiles(files)
    event.target.value = ''
  }

  const selectRegion = (region: SymbolRegion) => setSelectedRegionId(region.id)

  const findSymbols = async () => {
    if (discovery.current) return
    const controller = new AbortController()
    discovery.current = controller
    setFinding(true)
    setError(null)
    try {
      const response = await fetch('/api/segment', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl: images[imageIndex], discover: true }),
      })
      const result = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error(result.details || result.error || 'Could not find symbols.')
      const found: SymbolRegion[] = Array.isArray(result.symbols) ? result.symbols : []
      setDetectedDrafts(found)
      if (found.length) setDiscoveryComplete(true)
      else setError('No candidate regions found. Draw a box around a motif to analyze it directly.')
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not find symbols.')
    } finally {
      if (discovery.current === controller) {
        discovery.current = null
        setFinding(false)
      }
    }
  }

  const resetAnalysis = () => {
    discovery.current?.abort()
    discovery.current = null
    setFinding(false)
    setDiscoveryComplete(false)
    imageSession.current++
    analysisManager.current!.reset()
    setAnalysisStates({})
    setRegions([])
    setDetectedDrafts([])
    manualImages.current = {}
    setSelectedRegionId(null)
    setAnalyses({})
    setError(null)
  }

  const removeImage = () => {
    resetAnalysis()
    setImages([])
    setImageIndex(0)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#FDFBF6] px-4 py-4 font-lato text-base leading-relaxed text-[#0B0B0B] sm:px-6 sm:py-6">
      <header className="mb-5 flex shrink-0 items-center justify-between gap-3 border-b border-[#3A3A3A]/20 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#816719]">
            <FileSymlink size={19} />
            <h1 className="font-garamond text-4xl font-bold uppercase tracking-wide">Discern</h1>
          </div>
          <p className="mt-2 max-w-4xl text-base text-[#3A3A3A]">
            Select a symbol to analyze, or find candidate regions across the image.
          </p>
        </div>
        {images.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-base">
            <button aria-label="Previous image" disabled={imageIndex === 0 || isAnyAnalysisRunning} onClick={() => { const next = imageIndex - 1; resetAnalysis(); setImageIndex(next) }} className="border border-[#3A3A3A]/20 p-3 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="px-2 tabular-nums">{imageIndex + 1} / {images.length}</span>
            <button aria-label="Next image" disabled={imageIndex >= images.length - 1 || isAnyAnalysisRunning} onClick={() => { const next = imageIndex + 1; resetAnalysis(); setImageIndex(next) }} className="border border-[#3A3A3A]/20 p-3 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        )}
      </header>

      {images.length === 0 ? (
        <div
          className={`flex min-h-0 flex-1 flex-col items-center justify-center border border-dashed p-6 text-center transition-colors ${isDragging ? 'border-[#816719] bg-[#eee4d1]' : 'border-[#cfc4af] bg-[#FDFBF6]'}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => { event.preventDefault(); setIsDragging(false); void readFiles(Array.from(event.dataTransfer.files)) }}
        >
          <ArrowUpFromLine className="mb-4 h-8 w-8 text-[#816719]" />
          <p className="text-base text-[#2d2a27]">Drop images here, paste from clipboard, or choose files</p>
          <p className="mt-2 text-base text-[#6a645d]">PNG, JPG, WEBP, or SVG · 10 MB maximum per image</p>
          <input type="file" accept="image/*" multiple className="hidden" id="image-upload" onChange={handleFileInput} />
          <Button asChild className="mt-5 h-12 rounded-none border border-[#816719] bg-[#D4AF37] px-5 text-base text-[#0B0B0B] hover:bg-[#c29d2e]">
            <label htmlFor="image-upload" className="cursor-pointer">Choose images</label>
          </Button>
          {error && <p role="alert" className="mt-4 text-base text-[#8b342c]">{error}</p>}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(500px,60vh)_minmax(500px,1fr)] gap-5 overflow-y-auto lg:overflow-hidden lg:grid-cols-[minmax(340px,1fr)_minmax(0,1.35fr)] lg:grid-rows-1">
          <DiscernImage
            key={images[imageIndex]}
            src={images[imageIndex]}
            regions={regions}
            detectedDrafts={detectedDrafts}
            selectedId={selectedRegionId}
            analysisBusy={isAnyAnalysisRunning}
            finding={finding}
            discoveryComplete={discoveryComplete}
            onFindSymbols={() => void findSymbols()}
            label={getRegionLabel}
            onSelect={selectRegion}
            onAnalyzeSelection={async (drafts) => {
              if (!drafts.length) return
              const submitted = drafts.map(draft => draft.region)
              for (const { region, image } of drafts) {
                if (image) manualImages.current[region.id] = image
              }
              setRegions(previous => [...previous, ...submitted])
              setSelectedRegionId(submitted[0].id)
              await Promise.all(submitted.map(region => analyzeRegion(images[imageIndex], region)))
            }}
            onRemove={removeImage}
          />

          <section className="flex min-h-0 flex-col border border-[#3A3A3A]/20 bg-[#FDFBF6]">
            <div className="shrink-0 border-b border-[#3A3A3A]/20 p-3 sm:p-4">
              <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
                <div className="flex items-center gap-2"><h2 className="font-lato text-sm font-bold uppercase tracking-widest text-[#595959]">Symbols</h2><span className="text-sm text-[#595959]">{regions.length} {regions.length === 1 ? 'region' : 'regions'}</span></div>

              </div>
              <div className="flex min-w-0 gap-2 overflow-x-auto border-t border-[#3A3A3A]/15 pt-3 pb-2" role="group" aria-label="Symbol selections">
                {regions.map(region => {
                  const index = regions.indexOf(region)
                  const active = region.id === selectedRegionId
                  const state = analysisStates[region.id]?.status
                  const label = getRegionLabel(region)
                  const pending = !analyses[region.id]
                  return (
                    <button
                      key={region.id}
                      onClick={() => selectRegion(region)}
                      aria-label={`Region ${index + 1}: ${label}${state === 'analyzing' ? ', analyzing' : state === 'error' ? ', analysis failed' : state === 'queued' ? ', queued' : ''}`}
                      aria-pressed={active}
                      aria-busy={state === 'analyzing'}
                      className={`flex min-h-11 shrink-0 items-center gap-2 border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#816719] ${active ? 'border-[#816719] bg-[#F7ECC8] text-[#0B0B0B]' : 'border-[#3A3A3A]/15 bg-[#FDFBF6] text-[#3A3A3A] hover:border-[#816719]/50 hover:bg-[#F7ECC8]/30'} ${pending && !state && !active ? 'discern-action-cue' : ''}`}
                    >
                      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center discern-region-number rounded-full text-sm tabular-nums ${active ? 'bg-[#D4AF37] font-bold text-[#0B0B0B]' : 'bg-[#3A3A3A]/5 text-[#595959]'}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block whitespace-nowrap text-sm leading-snug ${active ? 'font-bold' : ''}`}>{label}</span>
                        {(pending || state === 'error') && <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[#595959]">{state === 'analyzing' && <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />}{state === 'analyzing' ? 'Analyzing…' : state === 'error' ? 'Analysis failed' : state === 'queued' ? 'Queued' : 'Preparing…'}</span>}
                      </span>
                    </button>
                  )
                })}
                {!regions.length && <span className="py-1 text-sm text-[#595959]">No analyses yet</span>}
              </div>

            </div>

            {error && <p role="status" className="border-b border-[#3A3A3A]/15 px-4 py-3 text-sm text-[#595959]">{error}</p>}
            {!selectedRegion ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center text-base text-[#3A3A3A]">
                {finding ? 'Scanning the image for candidate regions…' : discoveryComplete ? 'Review the detected regions in the image workspace before analyzing.' : 'Draw a box around a symbol or paint it, then choose Add region before analyzing.'}
              </div>
            ) : (
              <div key={selectedRegion.id} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
                {['queued', 'analyzing'].includes(analysisStates[selectedRegion.id]?.status) && !selectedAnalysis ? (
                  <div className="flex h-full min-h-40 items-center justify-center text-base text-[#3A3A3A]">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> {analysisStates[selectedRegion.id]?.status === 'queued' ? 'Queued — this region will be analyzed next.' : 'Analyzing selected region...'}
                  </div>
                ) : analysisStates[selectedRegion.id]?.status === 'error' ? (
                  <div role="alert" className="space-y-4 p-5 text-center">
                    <p>{analysisStates[selectedRegion.id].error}</p>
                    <Button variant="outline" onClick={() => void analyzeRegion(images[imageIndex], selectedRegion)}>Retry this region</Button>
                  </div>
                ) : selectedAnalysis ? (
                  <div className="space-y-6">
                    <div className="grid gap-5 2xl:grid-cols-2">
                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words font-garamond text-2xl font-bold">{getRegionLabel(selectedRegion)}</h3>
                            <p className="text-base text-[#595959]">{selectedAnalysis.category || selectedRegion.category}</p>
                          </div>
                          {(selectedAnalysis.visualIdentification?.status || selectedAnalysis.identification?.status) !== 'unidentified' && <Link href={`/library/symbol/${(selectedAnalysis.name || selectedRegion.name).toLowerCase().replace(/\s+/g, '-')}`}>
                            <Button variant="outline" size="sm" className="h-11 shrink-0 rounded-none border-[#3A3A3A]/20 px-2 text-sm">
                              Library <ExternalLink size={16} className="ml-1" />
                            </Button>
                          </Link>}
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest text-[#595959]">Visual identification</p>
                        <p className={`mt-2 inline-block rounded-none border px-3 py-1 text-sm font-bold capitalize ${selectedAnalysis.visualIdentification?.status === 'tentative' ? 'border-[#6D5A8C]/30 bg-[#EEE9F5] text-[#514268]' : 'border-[#816719]/20 bg-[#F7ECC8] text-[#594613]'}`}>{selectedAnalysis.visualIdentification?.status || selectedAnalysis.identification?.status || 'Not assessed'}</p>
                        <p className="mt-4 text-base leading-relaxed">{selectedAnalysis.visualIdentification?.explanation || selectedAnalysis.identification?.explanation || selectedAnalysis.classificationReasoning}</p>
                        {selectedAnalysis.visualIdentification?.evidence.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-base">{selectedAnalysis.visualIdentification.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul> : null}
                        <details className="mt-4 border-t border-[#3A3A3A]/15 pt-2 text-sm text-[#595959]">
                          <summary className="min-h-11 cursor-pointer py-3">How to read this assessment</summary>
                          <p className="pb-3 leading-relaxed">The name is an image-based proposal. Reference support is assessed separately. Model assessments are not measured probabilities, and mask confidence describes the selected outline. Appearance alone cannot establish authenticity.</p>
                        </details>
                      </section>

                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6">
                        <h3 className="mb-2 font-garamond text-2xl font-bold">Symbol information</h3>
                        <p className="mb-4 text-sm text-[#595959]">Background on the proposed identity: {selectedAnalysis.name}.</p>
                        {selectedAnalysis.historicalAttribution?.status === 'source_supported' ? <>
                        <div className="space-y-3">
                          <div className="py-2">
                            <p className="text-sm text-[#595959]">{selectedAnalysis.historicalAttribution.explanation}</p>
                            {selectedAnalysis.contextDescription && <p className="mt-1 text-base leading-relaxed text-[#3A3A3A]">{withoutInlineLinks(selectedAnalysis.contextDescription)}</p>}
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {[
                              ['Origin', selectedAnalysis.origin],
                              ['Time period', selectedAnalysis.timePeriod],
                              ['Primary use', selectedAnalysis.primaryUse],
                              ['Cultural context', selectedAnalysis.culturalPrevalence]
                            ].map(([label, value]) => (
                              <div key={label} className="min-w-0 py-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#595959]">{label}</p>
                                <p className="mt-1 break-words text-base">{value && value.toLowerCase() !== 'unknown' ? withoutInlineLinks(value) : 'Not established'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        </> : <p className="text-base text-[#595959]">{selectedAnalysis.historicalAttribution?.explanation || 'No historical background was retrieved for this result.'}</p>}
                      </section>

                      {selectedAnalysis.identification?.comparisons?.length ? (
                        <section className="border border-[#3A3A3A]/20 p-5 sm:p-6 2xl:col-span-2">
                          <h3 className="mb-4 font-garamond text-2xl font-bold">Candidate comparison</h3>
                          <details className="mb-3 text-sm text-[#595959]"><summary className="min-h-11 cursor-pointer py-3">What do the comparison labels mean?</summary><p className="pb-3">Rejected indicates a verified structural conflict. Strong means the defining features passed review. Possible means some features match but the evidence is incomplete. Less likely ranks a candidate lower. Unresolved means there is no reliable match yet.</p></details>
                          <div className="space-y-4">
                            {selectedAnalysis.identification.comparisons.map(candidate => (
                              <details key={candidate.candidateName} className="rounded-none border border-[#3A3A3A]/15 bg-white/40 px-4 py-2">
                                <summary className="cursor-pointer py-2 font-bold">{candidate.candidateName} <span className="ml-2 inline-block rounded-none bg-[#F2EFE7] px-2 py-0.5 text-xs font-medium capitalize text-[#595959]">{candidate.verdict.replace(/_/g, ' ')}</span></summary>
                                <div className="space-y-3 pt-2 text-base">
                                  <p className="text-sm text-[#595959]">{candidate.verificationSummary}</p>
                                  <p><strong>Reference definition:</strong> {candidate.referenceDefinition}</p>
                                  {candidate.checks?.length > 0 && <div className="space-y-3">
                                    {candidate.checks.map(check => (
                                      <details key={check.id} className="border-l-2 border-[#D4AF37]/50 pl-4">
                                        <summary className="cursor-pointer py-2 text-sm font-bold">{check.feature.replace(/_/g, ' ')} · {check.verification === 'verified' ? check.relation === 'match' ? 'Supports comparison' : 'Conflict' : 'Insufficient evidence'}</summary>
                                        <div className="space-y-2 py-2">
                                          <p><strong>Reference:</strong> {check.reference.description}</p>
                                          <p><strong>In this image:</strong> {check.target.description}</p>
                                          <p className="text-sm text-[#595959]">Location: {check.target.location} · Visibility: {check.target.visibility}</p>
                                          {check.reference.sourceIds.length > 0 && <blockquote className="border-l border-[#3A3A3A]/20 pl-3 text-sm text-[#595959]">{check.reference.quote}</blockquote>}
                                        </div>
                                      </details>
                                    ))}
                                  </div>}
                                  {candidate.contradictions.length > 0 && <p><strong>Differences:</strong> {candidate.contradictions.join('; ')}</p>}
                                  <div className="flex flex-wrap gap-3">{candidate.sourceIds.map(id => { const source = selectedAnalysis.sources.find(item => item.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#816719] underline">{source.title}</a> : null })}</div>
                                </div>
                              </details>
                            ))}
                          </div>
                        </section>
                      ) : null}


                      <details className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6 2xl:col-span-2">
                        <summary className="min-h-11 cursor-pointer font-garamond text-2xl font-bold">Image details</summary>
                        <p className="mt-3 text-sm capitalize text-[#595959]">{selectedAnalysis.imageType.replace(/_/g, ' ')} · {selectedAnalysis.dominantSubject}</p>
                        <div className="grid gap-5">
                          <p className="py-2 text-base leading-relaxed text-[#3A3A3A]">{selectedAnalysis.description}</p>
                        </div>
                        <div className="mt-2 grid gap-5 2xl:grid-cols-2">
                          <div className="py-2"><p className="text-xs font-bold uppercase tracking-wider text-[#595959]">Visual complexity</p><p className="mt-1 text-base">{selectedAnalysis.visualComplexity}</p></div>
                          <div className="py-2"><p className="text-xs font-bold uppercase tracking-wider text-[#595959]">Key elements</p><p className="mt-1 text-base">{selectedAnalysis.keyElements}</p></div>
                        </div>
                      </details>
                      <DiscernSources
                        sources={selectedAnalysis.sources}
                        furtherReading={selectedAnalysis.furtherReading}
                        comparedIds={selectedAnalysis.identification?.comparisons.flatMap(candidate => candidate.sourceIds) || []}
                        historicalIds={selectedAnalysis.identification?.historicalSourceIds || []}
                        status={selectedAnalysis.researchStatus}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-40 items-center justify-center text-base text-[#3A3A3A]">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> {analysisStates[selectedRegion.id]?.status === 'queued' ? 'Queued — this region will be analyzed next.' : 'Analyzing selected region...'}
                  </div>
                )}
              </div>
            )}
          </section>

          {error && <p role="alert" className="absolute bottom-3 left-1/2 z-10 max-w-[90%] -translate-x-1/2 border border-[#c9958c] bg-[#f7e7e3] px-3 py-2 text-base text-[#672c29]">{error}</p>}
        </div>
      )}
    </div>
  )
}
