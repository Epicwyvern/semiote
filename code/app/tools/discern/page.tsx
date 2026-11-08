"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowUpFromLine, ChevronLeft, ChevronRight, ExternalLink, FileSymlink, LoaderCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

import { DiscernImage } from "@/components/discern-image"
import { DiscernSources, type ResearchStatus } from "@/components/discern-sources"
import type { SymbolRegion, RegionBox } from "@/lib/discern-image"
import { createRegionAnalysisManager, regionLabel, type RegionAnalysisState } from "@/lib/region-analysis"
import { recognitionCrop } from "@/lib/recognition-images"
import type { ResearchSource } from "@/lib/symbol-research"
import type { VerifiedComparison, VisualIdentification, ReferenceVerification, HistoricalAttribution } from "@/lib/symbol-recognition"

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
  referenceVerification?: ReferenceVerification
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
    referenceVerification: data.referenceVerification && typeof data.referenceVerification === 'object' ? data.referenceVerification as ReferenceVerification : undefined,
    historicalAttribution: data.historicalAttribution && typeof data.historicalAttribution === 'object' ? data.historicalAttribution as HistoricalAttribution : undefined,
    sources: Array.isArray(data.sources) ? data.sources as ResearchSource[] : [],
    furtherReading: Array.isArray(data.furtherReading) ? data.furtherReading as ResearchSource[] : [],
    researchStatus: data.researchStatus && typeof data.researchStatus === 'object' ? data.researchStatus as ResearchStatus : undefined
  }
}

export default function DiscernPage() {
  const [images, setImages] = useState<string[]>([])
  const [imageIndex, setImageIndex] = useState(0)
  const [regions, setRegions] = useState<SymbolRegion[]>([])
  const [imageClassification, setImageClassification] = useState<{ kind: string; summary: string; source: 'openai' | 'generic' } | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, SymbolAnalysis>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [analysisStates, setAnalysisStates] = useState<Record<string, RegionAnalysisState>>({})
  const [error, setError] = useState<string | null>(null)

  const selectedRegion = regions.find((region) => region.id === selectedRegionId) || null
  const selectedAnalysis = selectedRegionId ? analyses[selectedRegionId] : null
  const getRegionLabel = (region: SymbolRegion) => regionLabel(analyses[region.id])
  const isAnyAnalysisRunning = Object.values(analysisStates).some(state => state.status === 'analyzing' || state.status === 'queued')
  const imageSession = useRef(0)
  const segmentationController = useRef<AbortController | null>(null)
  const analysisManager = useRef<ReturnType<typeof createRegionAnalysisManager<SymbolAnalysis>> | null>(null)
  if (!analysisManager.current) analysisManager.current = createRegionAnalysisManager<SymbolAnalysis>({
    onState: (id, state) => setAnalysisStates(previous => ({ ...previous, [id]: state })),
    onResult: (id, result) => setAnalyses(previous => ({ ...previous, [id]: result })),
  })
  useEffect(() => () => { analysisManager.current?.reset(); segmentationController.current?.abort() }, [])

  const manualImages = useRef<Record<string, string>>({})

  const analyzeRegion = (imageDataUrl: string, region: SymbolRegion, priority = false) => analysisManager.current!.run(region.id, async signal => {
    const targetImageDataUrl = manualImages.current[region.id] || await recognitionCrop(imageDataUrl, region.boundingBox)
    const response = await fetch('/api/enhancedAnalysis', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: targetImageDataUrl, targetImageDataUrl, contextImageDataUrl: imageDataUrl,
        selectionKind: region.manual ? 'painted' : 'region', boundingBox: { ...region.boundingBox, coordinateScale: 1000 } }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.details || result.error || 'Symbol analysis failed')
    if (!result.analysis || typeof result.analysis !== 'object') throw new Error('The analysis response was incomplete')
    return normalizeAnalysis({ ...result.analysis, furtherReading: result.furtherReading, researchStatus: result.researchStatus })
  }, priority)

  const runSegmentation = async (imageDataUrl: string, focusedRegion?: RegionBox) => {
    const session = ++imageSession.current
    analysisManager.current!.reset()
    segmentationController.current?.abort()
    const controller = new AbortController()
    segmentationController.current = controller
    setAnalysisStates({})
    setIsSegmenting(true)
    setRegions([])
    manualImages.current = {}
    setImageClassification(null)
    setSelectedRegionId(null)
    setAnalyses({})
    setError(null)

    try {
      const response = await fetch('/api/segment', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl, manualRegion: focusedRegion })
      })
      const result = await response.json()
      if (session !== imageSession.current) return false
      if (!response.ok) throw new Error(result.details || result.error || 'Image segmentation failed')
      if (result.imageClassification && typeof result.imageClassification === 'object') {
        setImageClassification(result.imageClassification)
      }
      const found = Array.isArray(result.symbols) ? result.symbols as SymbolRegion[] : []
      setRegions(found)
      if (found.length === 0) {
        setError(focusedRegion
          ? 'No distinct motif could be segmented inside that selection. Try including a little background around the motif.'
          : 'No named symbols were detected. You can select an area to inspect it manually.')
        return false
      }
      setSelectedRegionId(found[0].id)
      setIsSegmenting(false)
      for (const region of found) void analyzeRegion(imageDataUrl, region)
      return true
    } catch (segmentationError) {
      if (session === imageSession.current) setError((segmentationError as Error).message || 'Image segmentation failed')
      return false
    } finally {
      if (session === imageSession.current) setIsSegmenting(false)
    }
  }

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
    setImages(dataUrls)
    setImageIndex(0)
    void runSegmentation(dataUrls[0])
  }

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length) void readFiles(files)
    event.target.value = ''
  }

  const selectRegion = (region: SymbolRegion) => {
    setSelectedRegionId(region.id)
    const imageDataUrl = images[imageIndex]
    if (imageDataUrl && !analyses[region.id]) void analyzeRegion(imageDataUrl, region, true)
  }

  const removeImage = () => {
    imageSession.current++
    analysisManager.current!.reset()
    segmentationController.current?.abort()
    setAnalysisStates({})
    setIsSegmenting(false)
    setImages([])
    setImageIndex(0)
    setRegions([])
    manualImages.current = {}
    setImageClassification(null)
    setSelectedRegionId(null)
    setAnalyses({})
    setError(null)
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
            {imageClassification
              ? `${imageClassification.kind}: ${imageClassification.summary}${imageClassification.source === 'generic' ? ' · broad detection used' : ''}`
              : 'Classify the image, then inspect each detected symbol region.'}
          </p>
        </div>
        {images.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-base">
            <button aria-label="Previous image" disabled={imageIndex === 0 || isSegmenting || isAnyAnalysisRunning} onClick={() => { const next = imageIndex - 1; setImageIndex(next); void runSegmentation(images[next]) }} className="border border-[#3A3A3A]/20 p-3 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="px-2 tabular-nums">{imageIndex + 1} / {images.length}</span>
            <button aria-label="Next image" disabled={imageIndex >= images.length - 1 || isSegmenting || isAnyAnalysisRunning} onClick={() => { const next = imageIndex + 1; setImageIndex(next); void runSegmentation(images[next]) }} className="border border-[#3A3A3A]/20 p-3 disabled:opacity-40"><ChevronRight size={16} /></button>
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
            selectedId={selectedRegionId}
            busy={isSegmenting}
            analysisBusy={isAnyAnalysisRunning}
            label={getRegionLabel}
            onSelect={selectRegion}
            onBoxAnalyze={async (box) => {
              if (!await runSegmentation(images[imageIndex], box)) throw new Error('No mask was found. Adjust the box and try again.')
            }}
            onPaintAnalyze={async (region, imageDataUrl) => {
              const session = imageSession.current
              const previousRegion = regions.find(item => item.id === region.id)
              const previousImage = manualImages.current[region.id]
              const previousAnalysis = analyses[region.id]
              const previousSelected = selectedRegionId
              manualImages.current[region.id] = imageDataUrl
              setRegions(previous => [...previous.filter(item => item.id !== region.id), region])
              setAnalyses(previous => { const next = { ...previous }; delete next[region.id]; return next })
              setSelectedRegionId(region.id)
              if (!await analyzeRegion(images[imageIndex], region)) {
                if (session !== imageSession.current) return
                if (previousImage) manualImages.current[region.id] = previousImage
                else delete manualImages.current[region.id]
                setRegions(previous => [...previous.filter(item => item.id !== region.id), ...(previousRegion ? [previousRegion] : [])])
                if (previousAnalysis) setAnalyses(previous => ({ ...previous, [region.id]: previousAnalysis }))
                setSelectedRegionId(previousSelected)
                throw new Error('Analysis failed. Your painted selection is kept so you can retry.')
              }
            }}
            onRemove={removeImage}
          />

          <section className="flex min-h-0 flex-col border border-[#3A3A3A]/20 bg-[#FDFBF6]">
            <div className="shrink-0 border-b border-[#3A3A3A]/20 p-3 sm:p-4">
              <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
                <div className="flex items-center gap-2"><h2 className="font-lato text-sm font-bold uppercase tracking-widest text-[#595959]">Symbols</h2><span className="text-sm text-[#595959]">{regions.length} {regions.length === 1 ? 'region' : 'regions'}</span></div>
                {selectedRegion && <span className="text-sm text-[#595959]">Selected region {regions.findIndex(region => region.id === selectedRegionId) + 1}</span>}
              </div>
              <div className="flex min-w-0 gap-2 overflow-x-auto border-t border-[#3A3A3A]/15 pt-3 pb-2" role="group" aria-label="Detected symbols">
                {regions.map((region, index) => {
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
                      className={`flex min-h-11 shrink-0 items-center gap-2 border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#816719] ${active ? 'border-[#816719] bg-[#F7ECC8] text-[#0B0B0B]' : 'border-[#3A3A3A]/15 bg-[#FDFBF6] text-[#3A3A3A] hover:border-[#816719]/50 hover:bg-[#F7ECC8]/30'}`}
                    >
                      <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums ${active ? 'bg-[#D4AF37] font-bold text-[#0B0B0B]' : 'bg-[#3A3A3A]/5 text-[#595959]'}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block whitespace-nowrap text-sm leading-snug ${active ? 'font-bold' : ''}`}>{pending ? `Region ${index + 1}` : label}</span>
                        {(pending || state === 'error') && <span className="mt-0.5 flex items-center gap-1.5 text-xs text-[#595959]">{state === 'analyzing' && <LoaderCircle aria-hidden="true" className="h-3 w-3 animate-spin" />}{state === 'analyzing' ? 'Analyzing…' : state === 'error' ? 'Analysis failed' : state === 'queued' ? 'Queued' : 'Ready to analyze'}</span>}
                      </span>
                    </button>
                  )
                })}
                {!regions.length && !isSegmenting && <span className="py-1 text-sm text-[#595959]">No regions found</span>}
              </div>
            </div>

            {isSegmenting ? (
              <div className="flex min-h-0 flex-1 items-center justify-center text-base text-[#3A3A3A]">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Classifying image and segmenting symbols...
              </div>
            ) : !selectedRegion ? (
              <div className="flex min-h-0 flex-1 items-center justify-center px-5 text-center text-base text-[#3A3A3A]">
                {error || 'No symbol regions are available for this image.'}
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
                        <p className="mt-2 inline-block border border-[#816719]/30 bg-[#F7ECC8] px-3 py-1 font-bold capitalize">{selectedAnalysis.visualIdentification?.status || selectedAnalysis.identification?.status || 'Not assessed'}</p>
                        <p className="mt-4 text-base leading-relaxed">{selectedAnalysis.visualIdentification?.explanation || selectedAnalysis.identification?.explanation || selectedAnalysis.classificationReasoning}</p>
                        {selectedAnalysis.visualIdentification?.evidence.length ? <ul className="mt-4 list-disc space-y-2 pl-5 text-base">{selectedAnalysis.visualIdentification.evidence.map((item, index) => <li key={index}>{item}</li>)}</ul> : null}
                        <details className="mt-4 border-t border-[#3A3A3A]/15 pt-2 text-sm text-[#595959]">
                          <summary className="min-h-11 cursor-pointer py-3">How to read this assessment</summary>
                          <p className="pb-3 leading-relaxed">The name is an image-based proposal. Reference support is assessed separately. Model assessments are not measured probabilities, and mask confidence describes the selected outline. Appearance alone cannot establish authenticity.</p>
                        </details>
                      </section>

                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6" aria-label="Reference verification">
                        <h3 className="mb-2 font-garamond text-2xl font-bold">Reference verification</h3>
                        <p className="mb-3 inline-block border border-[#816719]/30 bg-[#F7ECC8] px-3 py-1 font-bold capitalize">{selectedAnalysis.referenceVerification?.status.replace(/_/g, ' ') || 'Not saved'}</p>
                        <p>{selectedAnalysis.referenceVerification?.explanation || 'Reference verification was not saved with this result. Analyze the image again to check its sources.'}</p>
                        {(selectedAnalysis.referenceVerification?.issues.length || selectedAnalysis.referenceVerification?.diagnostics?.length) ? <details className="mt-3">
                          <summary className="min-h-11 cursor-pointer py-3 text-sm">Verification details</summary>
                          <ul className="list-disc space-y-2 pl-5 text-sm text-[#595959]">
                            {selectedAnalysis.referenceVerification?.diagnostics?.map((item, index) => <li key={`diagnostic-${index}`}><strong className="capitalize">{item.stage}</strong>: {item.message} <span className="font-mono text-xs">({item.code})</span>{item.fields?.length ? <p className="mt-1 break-words font-mono text-xs">{item.fields.join('; ')}</p> : null}</li>)}
                            {selectedAnalysis.referenceVerification?.issues.map((issue, index) => <li key={`issue-${index}`}>{issue}</li>)}
                          </ul>
                        </details> : null}
                      </section>

                      {selectedAnalysis.identification?.comparisons?.length ? (
                        <section className="border border-[#3A3A3A]/20 p-5 sm:p-6 2xl:col-span-2">
                          <h3 className="mb-4 font-garamond text-2xl font-bold">Candidate comparison</h3>
                          <details className="mb-3 text-sm text-[#595959]"><summary className="min-h-11 cursor-pointer py-3">What do the comparison labels mean?</summary><p className="pb-3">Rejected indicates a verified structural conflict. Less likely ranks a candidate lower without ruling it out. Unresolved means the evidence is incomplete.</p></details>
                          <div className="space-y-4">
                            {selectedAnalysis.identification.comparisons.map(candidate => (
                              <details key={candidate.candidateName} className="border-b border-[#3A3A3A]/15 pb-3">
                                <summary className="cursor-pointer py-2 font-bold">{candidate.candidateName} <span className="ml-2 text-sm font-normal text-[#595959]">{candidate.verdict.replace(/_/g, ' ')}</span></summary>
                                <div className="space-y-3 pt-2 text-base">
                                  <p className="text-sm text-[#595959]">{candidate.verificationSummary}</p>
                                  <p><strong>Reference definition:</strong> {candidate.referenceDefinition}</p>
                                  {candidate.requiredFeatures?.length > 0 && <p className="text-sm text-[#595959]">Distinguishing features to resolve: {candidate.requiredFeatures.map(feature => feature.replace(/_/g, ' ')).join(', ')}</p>}
                                  {candidate.checks?.length > 0 && <div className="space-y-3">
                                    {candidate.checks.map(check => (
                                      <details key={check.id} className="border-l-2 border-[#D4AF37]/50 pl-4">
                                        <summary className="cursor-pointer py-2 text-sm font-bold">{check.feature.replace(/_/g, ' ')} · {check.relation} · {check.verification}</summary>
                                        <div className="space-y-2 py-2">
                                          <p><strong>Reference:</strong> {check.reference.description}</p>
                                          <p><strong>In this image:</strong> {check.target.description}</p>
                                          <p className="text-sm text-[#595959]">Location: {check.target.location} · Visibility: {check.target.visibility}</p>
                                          <p className="text-sm">{check.verificationReason}</p>
                                          {check.reference.sourceIds.length > 0 && <blockquote className="border-l border-[#3A3A3A]/20 pl-3 text-sm text-[#595959]">{check.reference.quote}</blockquote>}
                                        </div>
                                      </details>
                                    ))}
                                  </div>}
                                  {candidate.matchedFeatures.length > 0 && <p><strong>Matches:</strong> {candidate.matchedFeatures.join('; ')}</p>}
                                  {candidate.contradictions.length > 0 && <p><strong>Differences:</strong> {candidate.contradictions.join('; ')}</p>}
                                  {candidate.uncertainties.length > 0 && <p><strong>Uncertain:</strong> {candidate.uncertainties.join('; ')}</p>}
                                  <div className="flex flex-wrap gap-3">{candidate.sourceIds.map(id => { const source = selectedAnalysis.sources.find(item => item.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#816719] underline">{source.title}</a> : null })}</div>
                                </div>
                              </details>
                            ))}
                          </div>
                        </section>
                      ) : null}
                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6 2xl:col-span-2">
                        <h3 className="mb-2 font-garamond text-2xl font-bold">Historical attribution</h3>
                        <p className="mb-3 inline-block border border-[#816719]/30 bg-[#F7ECC8] px-3 py-1 font-bold capitalize">{selectedAnalysis.historicalAttribution?.status.replace(/_/g, ' ') || 'Not established'}</p>
                        <p className="mb-4 text-sm text-[#595959]">General history of the proposed symbol, where supported by sources. This does not establish the image's provenance or intended meaning.</p>
                        {selectedAnalysis.historicalAttribution?.status === 'source_supported' ? <>
                        <div className="mb-3 flex flex-wrap gap-3">{selectedAnalysis.identification?.historicalSourceIds.map(id => { const source = selectedAnalysis.sources.find(item => item.id === id); return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#816719] underline">{source.title}</a> : null })}</div>
                        <div className="grid gap-5 2xl:grid-cols-2">
                          <div className="py-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-[#595959]">Context</p>
                            <p className="mt-1 text-base leading-relaxed text-[#3A3A3A]">{selectedAnalysis.contextDescription || 'No historical context returned.'}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {[
                              ['Origin', selectedAnalysis.origin],
                              ['Time period', selectedAnalysis.timePeriod],
                              ['Primary use', selectedAnalysis.primaryUse],
                              ['Cultural prevalence', selectedAnalysis.culturalPrevalence]
                            ].map(([label, value]) => (
                              <div key={label} className="min-w-0 py-2">
                                <p className="text-xs font-bold uppercase tracking-wider text-[#595959]">{label}</p>
                                <p className="mt-1 break-words text-base">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                        </> : <p className="text-base text-[#595959]">{selectedAnalysis.historicalAttribution?.explanation || 'No source-supported historical attribution is available for this result.'}</p>}
                      </section>

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
