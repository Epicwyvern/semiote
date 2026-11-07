"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowUpFromLine, ChevronLeft, ChevronRight, ExternalLink, FileSymlink, Info, LoaderCircle, Scan, X } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type SymbolRegion = {
  id: string
  name: string
  category: string
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
  maskWidth: number
  maskHeight: number
  maskSpans: [number, number, number][]
}
type RegionBox = { x: number; y: number; width: number; height: number }

type SymbolAnalysis = {
  name: string
  category: string
  confidence: number
  prominence: number
  authenticity: number
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
}

const emptyAnalysis: SymbolAnalysis = {
  name: "",
  category: "Symbol",
  confidence: 0,
  prominence: 0,
  authenticity: 0,
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
  classificationReasoning: ""
}

const asText = (value: unknown, fallback = "Unknown") => typeof value === "string" && value.trim() ? value : fallback
const asScore = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const score = value > 0 && value <= 1 ? value * 10 : value
  return Math.max(0, Math.min(10, score))
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
    classificationReasoning: asText(data.classificationReasoning, "")
  }
}

export default function DiscernPage() {
  const [images, setImages] = useState<string[]>([])
  const [imageIndex, setImageIndex] = useState(0)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [imageViewport, setImageViewport] = useState({ width: 0, height: 0 })
  const [regions, setRegions] = useState<SymbolRegion[]>([])
  const [imageClassification, setImageClassification] = useState<{ kind: string; summary: string; source: 'openai' | 'generic' } | null>(null)
  const [isDrawingRegion, setIsDrawingRegion] = useState(false)
  const [manualRegion, setManualRegion] = useState<RegionBox | null>(null)
  const [draftRegion, setDraftRegion] = useState<RegionBox | null>(null)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, SymbolAnalysis>>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [busyRegionId, setBusyRegionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imageStageRef = useRef<HTMLDivElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)

  const selectedRegion = regions.find((region) => region.id === selectedRegionId) || null
  const selectedAnalysis = selectedRegionId ? analyses[selectedRegionId] : null
  const imageScale = imageSize.width && imageSize.height && imageViewport.width && imageViewport.height
    ? Math.min(imageViewport.width / imageSize.width, imageViewport.height / imageSize.height)
    : 0
  const renderedImageWidth = imageSize.width * imageScale
  const renderedImageHeight = imageSize.height * imageScale
  const imageOffsetX = (imageViewport.width - renderedImageWidth) / 2
  const imageOffsetY = (imageViewport.height - renderedImageHeight) / 2

  const getImagePoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const stage = imageStageRef.current
    if (!stage || imageScale <= 0) return null
    const bounds = stage.getBoundingClientRect()
    const x = ((event.clientX - bounds.left - imageOffsetX) / renderedImageWidth) * 1000
    const y = ((event.clientY - bounds.top - imageOffsetY) / renderedImageHeight) * 1000
    if (x < 0 || x > 1000 || y < 0 || y > 1000) return null
    return { x, y }
  }

  const boxFromPoints = (start: { x: number; y: number }, end: { x: number; y: number }): RegionBox => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  })

  const getRegionLabel = (region: SymbolRegion) => analyses[region.id]?.name || region.name

  useEffect(() => {
    const stage = imageStageRef.current
    if (!stage) return

    const observer = new ResizeObserver(([entry]) => {
      setImageViewport({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(stage)
    return () => observer.disconnect()
  }, [images.length, imageIndex])

  useEffect(() => {
    const canvas = maskCanvasRef.current
    const firstRegion = regions[0]
    if (!canvas || !firstRegion) return

    canvas.width = firstRegion.maskWidth
    canvas.height = firstRegion.maskHeight
    const context = canvas.getContext('2d')
    if (!context) return

    const imageData = context.createImageData(canvas.width, canvas.height)
    const palette = ['#087e8b', '#a53f58', '#276749', '#6b4c9a', '#c17b2a', '#2773a5']
    const paintRegion = (region: SymbolRegion, regionIndex: number, selected: boolean) => {
      const color = selected ? '#e2a817' : palette[regionIndex % palette.length]
      const red = Number.parseInt(color.slice(1, 3), 16)
      const green = Number.parseInt(color.slice(3, 5), 16)
      const blue = Number.parseInt(color.slice(5, 7), 16)
      const alpha = selected ? 115 : 65

      for (const [y, start, end] of region.maskSpans) {
        for (let x = start; x < end; x++) {
          const offset = (y * canvas.width + x) * 4
          imageData.data[offset] = red
          imageData.data[offset + 1] = green
          imageData.data[offset + 2] = blue
          imageData.data[offset + 3] = alpha
        }
      }
    }

    regions.forEach((region, index) => {
      if (region.id !== selectedRegionId) paintRegion(region, index, false)
    })
    const selectedIndex = regions.findIndex((region) => region.id === selectedRegionId)
    if (selectedIndex >= 0) paintRegion(regions[selectedIndex], selectedIndex, true)
    context.putImageData(imageData, 0, 0)
  }, [regions, selectedRegionId])

  const analyzeRegion = async (imageDataUrl: string, region: SymbolRegion) => {
    setBusyRegionId(region.id)
    setError(null)

    try {
      const response = await fetch('/api/enhancedAnalysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          boundingBox: { ...region.boundingBox, coordinateScale: 1000 },
          symbolName: region.name
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.details || result.error || 'Symbol analysis failed')
      if (!result.analysis || typeof result.analysis !== 'object') throw new Error('The analysis response was incomplete')
      setAnalyses((previous) => ({ ...previous, [region.id]: normalizeAnalysis(result.analysis) }))
    } catch (analysisError) {
      setError((analysisError as Error).message || 'Symbol analysis failed')
    } finally {
      setBusyRegionId((current) => current === region.id ? null : current)
    }
  }

  const runSegmentation = async (imageDataUrl: string, focusedRegion?: RegionBox) => {
    setIsSegmenting(true)
    setIsDrawingRegion(false)
    setDraftRegion(null)
    setDrawStart(null)
    if (!focusedRegion) setManualRegion(null)
    setRegions([])
    setImageClassification(null)
    setSelectedRegionId(null)
    setAnalyses({})
    setError(null)

    try {
      const response = await fetch('/api/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUrl, manualRegion: focusedRegion })
      })
      const result = await response.json()
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
        return
      }
      // The dashed box is input guidance; only SAM masks remain after detection.
      if (focusedRegion) setManualRegion(null)
      setSelectedRegionId(found[0].id)
      setIsSegmenting(false)
      await analyzeRegion(imageDataUrl, found[0])
    } catch (segmentationError) {
      setError((segmentationError as Error).message || 'Image segmentation failed')
    } finally {
      setIsSegmenting(false)
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
    setImageSize({ width: 0, height: 0 })
    setManualRegion(null)
    setDraftRegion(null)
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
    if (imageDataUrl && !analyses[region.id]) void analyzeRegion(imageDataUrl, region)
  }

  const removeImage = () => {
    setImages([])
    setImageIndex(0)
    setRegions([])
    setImageClassification(null)
    setSelectedRegionId(null)
    setAnalyses({})
    setError(null)
    setManualRegion(null)
    setDraftRegion(null)
    setIsDrawingRegion(false)
  }

  const score = selectedAnalysis
    ? ((selectedAnalysis.confidence * 0.4) + (selectedAnalysis.prominence * 0.3) + (selectedAnalysis.authenticity * 0.3)).toFixed(1)
    : '0.0'

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
              ? `${imageClassification.kind}: ${imageClassification.summary}${imageClassification.source === 'generic' ? ' Â· broad detection used' : ''}`
              : 'Classify the image, then inspect each detected symbol region.'}
          </p>
        </div>
        {images.length > 1 && (
          <div className="flex shrink-0 items-center gap-1 text-base">
            <button aria-label="Previous image" disabled={imageIndex === 0 || isSegmenting} onClick={() => { const next = imageIndex - 1; setImageIndex(next); void runSegmentation(images[next]) }} className="border border-[#3A3A3A]/20 p-3 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <span className="px-2 tabular-nums">{imageIndex + 1} / {images.length}</span>
            <button aria-label="Next image" disabled={imageIndex >= images.length - 1 || isSegmenting} onClick={() => { const next = imageIndex + 1; setImageIndex(next); void runSegmentation(images[next]) }} className="border border-[#3A3A3A]/20 p-3 disabled:opacity-40"><ChevronRight size={16} /></button>
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
          <p className="mt-2 text-base text-[#6a645d]">PNG, JPG, WEBP, or SVG Â· 10 MB maximum per image</p>
          <input type="file" accept="image/*" multiple className="hidden" id="image-upload" onChange={handleFileInput} />
          <Button asChild className="mt-5 h-12 rounded-none border border-[#816719] bg-[#D4AF37] px-5 text-base text-[#0B0B0B] hover:bg-[#c29d2e]">
            <label htmlFor="image-upload" className="cursor-pointer">Choose images</label>
          </Button>
          {error && <p role="alert" className="mt-4 text-base text-[#8b342c]">{error}</p>}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(240px,42%)_minmax(0,1fr)] gap-5 overflow-hidden lg:grid-cols-[minmax(340px,1fr)_minmax(0,1.35fr)] lg:grid-rows-1">
          <section className="flex min-h-0 flex-col border border-[#3A3A3A]/20 bg-[#FDFBF6] p-3 sm:p-4">
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#3A3A3A]/15 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-widest text-[#595959]">Image</span>
                <span className="truncate text-base text-[#3A3A3A]">{regions.length ? `${regions.length} ${regions.length === 1 ? 'region' : 'regions'}` : isSegmenting ? 'Finding regions…' : 'No regions found'}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {manualRegion && !isDrawingRegion && (
                  <button
                    onClick={() => void runSegmentation(images[imageIndex], manualRegion)}
                    disabled={isSegmenting}
                    className="border border-[#816719] bg-[#D4AF37] min-h-11 px-3 py-2 text-sm font-medium text-[#0B0B0B] disabled:opacity-50"
                  >
                    Analyze selection
                  </button>
                )}
                {(manualRegion || isDrawingRegion) && (
                  <button
                    onClick={() => { setManualRegion(null); setDraftRegion(null); setDrawStart(null); setIsDrawingRegion(false) }}
                    className="border border-[#d0c5b1] min-h-11 px-3 py-2 text-sm text-[#3A3A3A] hover:bg-[#F7ECC8]"
                  >
                    Cancel
                  </button>
                )}
                {!isDrawingRegion && !manualRegion && (
                  <button
                    onClick={() => { setError(null); setIsDrawingRegion(true) }}
                    className="flex items-center gap-1 border border-[#d0c5b1] min-h-11 px-3 py-2 text-sm text-[#3A3A3A] hover:bg-[#F7ECC8]"
                  >
                    <Scan size={18} /> Select area
                  </button>
                )}
                <button onClick={removeImage} aria-label="Remove image" title="Remove image" className="border border-[#d0c5b1] flex min-h-11 min-w-11 items-center justify-center p-2 text-[#3A3A3A] hover:bg-[#F7ECC8]"><X size={18} /></button>
              </div>
            </div>
            <div ref={imageStageRef} className="relative min-h-0 flex-1 overflow-hidden bg-[#F2EFE7]">
              <img
                src={images[imageIndex]}
                alt={`Uploaded image ${imageIndex + 1}`}
                className="absolute inset-0 h-full w-full object-contain"
                onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth || 1, height: event.currentTarget.naturalHeight || 1 })}
              />
              {regions.length > 0 && imageScale > 0 && (
                <canvas
                  ref={maskCanvasRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute"
                  style={{
                    left: imageOffsetX,
                    top: imageOffsetY,
                    width: renderedImageWidth,
                    height: renderedImageHeight,
                  }}
                />
              )}
                {imageScale > 0 && regions.map((region, index) => {
                  const isSelected = region.id === selectedRegionId
                  const box = region.boundingBox
                  const color = isSelected ? '#c18b13' : ['#087e8b', '#a53f58', '#276749', '#6b4c9a'][index % 4]
                  return (
                    <button
                      key={region.id}
                      type="button"
                      aria-label={`Select ${region.name}, confidence ${Math.round(region.confidence * 100)} percent`}
                      onClick={() => selectRegion(region)}
                      className="absolute border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B0B0B]"
                      style={{
                        left: imageOffsetX + box.x / 1000 * renderedImageWidth,
                        top: imageOffsetY + box.y / 1000 * renderedImageHeight,
                        width: box.width / 1000 * renderedImageWidth,
                        height: box.height / 1000 * renderedImageHeight,
                        borderColor: color,
                        borderWidth: isSelected ? 2 : 1,
                        backgroundColor: 'transparent',
                        zIndex: isSelected ? 2 : 1
                      }}
                    >
                      <span className="absolute left-0 top-0 max-w-full truncate bg-[#0B0B0B] px-1.5 py-1 text-xs leading-none text-white" style={{ outline: `1px solid ${color}` }}>
                        {index + 1}. {getRegionLabel(region)}
                      </span>
                    </button>
                  )
                })}
                {manualRegion && imageScale > 0 && (
                  <div
                    aria-label="Selected image area"
                    className="pointer-events-none absolute border-2 border-dashed border-[#e2a817] bg-[#e2a817]/10"
                    style={{
                      left: imageOffsetX + manualRegion.x / 1000 * renderedImageWidth,
                      top: imageOffsetY + manualRegion.y / 1000 * renderedImageHeight,
                      width: manualRegion.width / 1000 * renderedImageWidth,
                      height: manualRegion.height / 1000 * renderedImageHeight,
                      zIndex: 10,
                    }}
                  />
                )}
                {isDrawingRegion && imageScale > 0 && (
                  <div
                    className="absolute inset-0 z-20 cursor-crosshair touch-none"
                    onPointerDown={(event) => {
                      const point = getImagePoint(event)
                      if (!point) return
                      event.preventDefault()
                      event.currentTarget.setPointerCapture(event.pointerId)
                      setDrawStart(point)
                      setDraftRegion({ x: point.x, y: point.y, width: 0, height: 0 })
                    }}
                    onPointerMove={(event) => {
                      if (!drawStart) return
                      const point = getImagePoint(event)
                      if (point) setDraftRegion(boxFromPoints(drawStart, point))
                    }}
                    onPointerUp={(event) => {
                      if (!drawStart) return
                      const point = getImagePoint(event)
                      if (point) {
                        const box = boxFromPoints(drawStart, point)
                        if (box.width >= 8 && box.height >= 8) {
                          setManualRegion(box)
                          setDraftRegion(box)
                        } else {
                          setError('Draw a larger box around the symbol.')
                        }
                      }
                      setDrawStart(null)
                      setIsDrawingRegion(false)
                    }}
                    onPointerCancel={() => { setDrawStart(null); setDraftRegion(null); setIsDrawingRegion(false) }}
                  >
                    {draftRegion && (
                      <div
                        className="pointer-events-none absolute border-2 border-dashed border-[#e2a817] bg-[#e2a817]/10"
                        style={{
                          left: imageOffsetX + draftRegion.x / 1000 * renderedImageWidth,
                          top: imageOffsetY + draftRegion.y / 1000 * renderedImageHeight,
                          width: draftRegion.width / 1000 * renderedImageWidth,
                          height: draftRegion.height / 1000 * renderedImageHeight,
                        }}
                      />
                    )}
                  </div>
                )}
                {isSegmenting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#FDFBF6]/75 text-base font-medium text-[#3b352c]">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Finding symbol regions
                  </div>
                )}
            </div>
            <p className="mt-3 shrink-0 text-sm text-[#595959]">
              {selectedRegion ? `Selected: ${getRegionLabel(selectedRegion)} Â· ${Math.round(selectedRegion.confidence * 100)}% visual confidence` : manualRegion ? 'Area selected. Analyze it to identify the symbol inside.' : isDrawingRegion ? 'Drag around the symbol or meaningful detail' : 'Select a highlighted region or mark an area manually'}
            </p>
          </section>

          <section className="flex min-h-0 flex-col border border-[#3A3A3A]/20 bg-[#FDFBF6]">
            <div className="flex min-h-[64px] shrink-0 items-center gap-3 border-b border-[#3A3A3A]/20 bg-[#F7ECC8] px-3 py-2">
              <span className="shrink-0 text-sm font-bold uppercase tracking-widest text-[#595959]">Symbols</span>
              <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {regions.map((region, index) => {
                  const active = region.id === selectedRegionId
                  return (
                    <button
                      key={region.id}
                      onClick={() => selectRegion(region)}
                      aria-pressed={active}
                      className={`shrink-0 border min-h-11 px-4 py-2 text-base transition-colors ${active ? 'border-[#816719] bg-[#D4AF37] font-bold text-[#0B0B0B]' : 'border-[#d2c7b4] bg-[#FDFBF6] text-[#3A3A3A] hover:bg-[#F7ECC8]'}`}
                    >
                      {index + 1}. {getRegionLabel(region)}
                    </button>
                  )
                })}
                {!regions.length && !isSegmenting && <span className="px-2 py-1 text-base text-[#595959]">No regions found</span>}
              </div>
              {selectedRegion && <span className="hidden shrink-0 text-sm tabular-nums text-[#595959] sm:block">{Math.round(selectedRegion.confidence * 100)}%</span>}
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
                {busyRegionId === selectedRegion.id && !selectedAnalysis ? (
                  <div className="flex h-full min-h-40 items-center justify-center text-base text-[#3A3A3A]">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Analyzing {selectedRegion.name}...
                  </div>
                ) : selectedAnalysis ? (
                  <div className="space-y-6">
                    <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold uppercase tracking-widest text-[#595959]">Image classification</p>
                          <h2 className="mt-1 font-garamond text-2xl font-bold capitalize">{selectedAnalysis.imageType.replace(/_/g, ' ')}</h2>
                        </div>
                        <span className="border border-[#d4c6a8] bg-[#F7ECC8] px-2 py-1 text-base text-[#3A3A3A]">{selectedAnalysis.dominantSubject}</span>
                      </div>
                      <div className="mt-3 grid gap-5 2xl:grid-cols-2">
                        <div className="py-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-[#595959]">Selected symbol</p>
                          <p className="mt-1 text-base font-medium">{selectedAnalysis.name || selectedRegion.name}</p>
                        </div>
                        <div className="py-2">
                          <p className="text-xs font-bold uppercase tracking-widest text-[#595959]">Other motifs</p>
                          <p className="mt-1 text-base">{selectedAnalysis.embeddedSymbols.length ? selectedAnalysis.embeddedSymbols.join(', ') : 'None identified'}</p>
                        </div>
                      </div>
                      <p className="mt-2 py-2 text-base leading-relaxed text-[#3A3A3A]">{selectedAnalysis.classificationReasoning}</p>
                    </section>

                    <div className="grid gap-5 2xl:grid-cols-2">
                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="break-words font-garamond text-2xl font-bold">{selectedAnalysis.name || selectedRegion.name}</h3>
                            <p className="text-base text-[#595959]">{selectedAnalysis.category || selectedRegion.category}</p>
                          </div>
                          <Link href={`/library/symbol/${(selectedAnalysis.name || selectedRegion.name).toLowerCase().replace(/\s+/g, '-')}`}>
                            <Button variant="outline" size="sm" className="h-11 shrink-0 rounded-none border-[#3A3A3A]/20 px-2 text-sm">
                              Library <ExternalLink size={16} className="ml-1" />
                            </Button>
                          </Link>
                        </div>
                        <div className="space-y-5">
                          {[
                            ['Confidence', selectedAnalysis.confidence],
                            ['Prominence', selectedAnalysis.prominence],
                            ['Authenticity', selectedAnalysis.authenticity]
                          ].map(([label, value]) => (
                            <div key={label as string}>
                              <div className="mb-1 flex justify-between text-base"><span>{label}</span><span>{Number(value).toFixed(1)} / 10</span></div>
                              <div className="h-2 border border-[#3A3A3A]/15 bg-[#F7ECC8]"><div className="h-full bg-[#D4AF37]" style={{ width: `${Number(value) * 10}%` }} /></div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6">
                        <h3 className="mb-2 font-garamond text-2xl font-bold">Overall score</h3>
                        <div className="flex items-start gap-2 py-2">
                          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#816719]" />
                          <div><p className="font-garamond text-5xl font-bold">{score}<span className="ml-2 font-lato text-base font-normal text-[#595959]">/ 10</span></p><p className="mt-1 text-base leading-relaxed text-[#3A3A3A]">{selectedAnalysis.overallScoreRationale || 'Weighted from confidence, prominence, and authenticity.'}</p></div>
                        </div>
                        <p className="mt-2 text-base leading-relaxed text-[#3A3A3A]">This score summarizes how strongly the visual evidence and historical context support the identification.</p>
                      </section>

                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6 2xl:col-span-2">
                        <h3 className="mb-2 font-garamond text-2xl font-bold">Source & origin</h3>
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
                      </section>

                      <section className="border border-[#3A3A3A]/20 bg-[#FDFBF6] p-5 sm:p-6 2xl:col-span-2">
                        <h3 className="mb-2 font-garamond text-2xl font-bold">Visual analysis</h3>
                        <div className="grid gap-5">
                          <p className="py-2 text-base leading-relaxed text-[#3A3A3A]">{selectedAnalysis.description}</p>
                          <div className="space-y-3 border-l-2 border-[#D4AF37]/50 pl-4 py-2">
                            {selectedAnalysis.thinkingProcess.length ? selectedAnalysis.thinkingProcess.map((thought, index) => (
                              <p key={index} className="text-base leading-relaxed text-[#3A3A3A]">{index + 1}. {thought}</p>
                            )) : <p className="text-base text-[#3A3A3A]">No analysis notes supplied.</p>}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-5 2xl:grid-cols-2">
                          <div className="py-2"><p className="text-xs font-bold uppercase tracking-wider text-[#595959]">Visual complexity</p><p className="mt-1 text-base">{selectedAnalysis.visualComplexity}</p></div>
                          <div className="py-2"><p className="text-xs font-bold uppercase tracking-wider text-[#595959]">Key elements</p><p className="mt-1 text-base">{selectedAnalysis.keyElements}</p></div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-40 items-center justify-center text-base text-[#3A3A3A]">
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Analyzing {selectedRegion.name}...
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
