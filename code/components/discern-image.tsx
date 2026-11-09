"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react"
import { Brush, Eraser, Hand, Maximize2, Minimize2, Redo2, Scan, Undo2, X, ZoomIn, ZoomOut } from "lucide-react"
import { boxFromPoints, clamp, emptySelection, imageGeometry, paintLine, regionFromPixels, zoomAt, type Selection, type SymbolRegion, type View } from "@/lib/discern-image"

type Tool = 'inspect' | 'pan' | 'box' | 'paint' | 'erase'
type Point = { x: number; y: number }
type Props = {
  src: string
  regions: SymbolRegion[]
  selectedId: string | null
  analysisBusy?: boolean
  finding: boolean
  discoveryComplete: boolean
  onFindSymbols: () => void
  label: (region: SymbolRegion) => string
  detectedDrafts: SymbolRegion[]
  onSelect: (region: SymbolRegion) => void
  onAnalyzeSelection: (drafts: { region: SymbolRegion; image?: string }[]) => Promise<void>
  onRemove: () => void
}

const regionColors = ['#3F5BA9', '#42824B', '#B13C39', '#8054A0', '#AD671D', '#087F86']

const draftLabel = (region: SymbolRegion, index: number) => region.customName?.trim() || `Draft ${index + 1}`
const draftColor = (index: number) => regionColors[index % regionColors.length]

const initialView = (): View => ({ zoom: 1, x: 0, y: 0 })
const button = 'inline-flex min-h-11 items-center justify-center gap-2 border border-[#3A3A3A]/20 px-3 py-2 text-sm hover:bg-[#F7ECC8] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#816719]'

function Control({ children, title, active, ...props }: { children: ReactNode; title: string; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" title={title} aria-label={title} aria-pressed={active} className={`${button} ${active ? 'bg-[#F7ECC8] border-[#816719]' : ''}`} {...props}>{children}</button>
}

export function DiscernImage({ src, regions, selectedId, analysisBusy = false, finding, discoveryComplete, onFindSymbols, label, detectedDrafts, onSelect, onAnalyzeSelection, onRemove }: Props) {
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [viewport, setViewport] = useState({ width: 1, height: 1 })
  const [view, setView] = useState(initialView)
  const [tool, setTool] = useState<Tool>('box')
  const [drafts, setDrafts] = useState<{ region: SymbolRegion; image?: string; selection?: Selection }[]>([])
  useEffect(() => {
    if (detectedDrafts.length) {
      setDrafts(current => [...current, ...detectedDrafts.filter(region => !current.some(draft => draft.region.id === region.id)).map(region => ({ region: { ...region, name: 'Detected region' } }))])
    }
  }, [detectedDrafts])
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selection, setSelection] = useState<Selection>(emptySelection)
  const [undo, setUndo] = useState<Selection[]>([])
  const [redo, setRedo] = useState<Selection[]>([])
  const [showMasks, setShowMasks] = useState(true)
  const [showLabels, setShowLabels] = useState(true)
  const [opacity, setOpacity] = useState(40)
  const [brush, setBrush] = useState(24)
  const [expanded, setExpanded] = useState(false)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const selectionRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const gesture = useRef<{ before: Selection; start: Point; previous: Point; view: View; pixels?: Uint8Array; pointer: number; mode: Tool } | null>(null)
  const touches = useRef(new Map<number, Point>())
  const pinch = useRef<{ distance: number; center: Point; view: View } | null>(null)
  const wheelView = useRef(view)
  wheelView.current = view
  const selected = regions.find(region => region.id === selectedId)
  const geometry = imageGeometry(size.width, size.height, viewport.width, viewport.height, view)
  const gridScale = Math.min(1, 1024 / Math.max(size.width, size.height))
  const gridWidth = Math.max(1, Math.round(size.width * gridScale))
  const gridHeight = Math.max(1, Math.round(size.height * gridScale))
  const editingBusy = analysisBusy || finding || submitting
  const paintActive = tool === 'paint' || tool === 'erase'
  const pixelRegion = useMemo(() => selection.pixels ? regionFromPixels(selection.pixels, gridWidth, gridHeight, 'draft') : null, [selection.pixels, gridWidth, gridHeight])
  const editingDraftIndex = drafts.findIndex(draft => draft.region.id === selection.regionId)
  const editingColor = draftColor(regions.length + (editingDraftIndex < 0 ? drafts.length : editingDraftIndex))
  const hasSelection = Boolean(selection.box || pixelRegion)
  const findDisabled = editingBusy || discoveryComplete
  const analyzeDisabled = editingBusy || Boolean(rename) || (hasSelection || editingDraftIndex >= 0 || !drafts.length)
  const primaryAction = 'border-[#816719] bg-[#D4AF37] font-bold discern-action-cue'

  const commit = (next: Selection, previous = selection) => {
    setUndo(history => [...history.slice(-29), previous]); setRedo([]); setSelection(next)
    setLocalError(null)
  }
  const undoSelection = () => {
    if (!undo.length || gesture.current) return
    setRedo(history => [...history, selection]); setSelection(undo[undo.length - 1]); setUndo(undo.slice(0, -1))
  }
  const redoSelection = () => {
    if (!redo.length || gesture.current) return
    setUndo(history => [...history, selection]); setSelection(redo[redo.length - 1]); setRedo(redo.slice(0, -1))
  }
  const changeTool = (next: Tool) => { setTool(next); setCursor(null); setLocalError(null) }
  const point = (clientX: number, clientY: number, constrain = true) => {
    const bounds = stageRef.current!.getBoundingClientRect()
    const x = (clientX - bounds.left - geometry.left) / geometry.width * 1000
    const y = (clientY - bounds.top - geometry.top) / geometry.height * 1000
    if (!constrain && (x < 0 || x > 1000 || y < 0 || y > 1000)) return null
    return { x: clamp(x, 0, 1000), y: clamp(y, 0, 1000) }
  }
  const localPoint = (event: PointerEvent) => {
    const bounds = stageRef.current!.getBoundingClientRect()
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
  }
  const gridPoint = (p: Point) => ({ x: p.x / 1000 * gridWidth, y: p.y / 1000 * gridHeight })
  const zoom = (factor: number) => setView(current => zoomAt(current, current.zoom * factor, viewport.width / 2, viewport.height / 2, viewport.width, viewport.height))
  const zoomToSymbol = () => {
    if (!selected) return
    const fit = Math.min(viewport.width / size.width, viewport.height / size.height)
    const box = selected.boundingBox
    const z = clamp(Math.min(viewport.width / (box.width / 1000 * size.width * fit), viewport.height / (box.height / 1000 * size.height * fit)) * 0.8, 1, 16)
    setView({ zoom: z, x: (0.5 - (box.x + box.width / 2) / 1000) * size.width * fit * z, y: (0.5 - (box.y + box.height / 2) / 1000) * size.height * fit * z })
  }

  useEffect(() => {
    const stage = stageRef.current!
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(stage)
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (gesture.current) return
      const bounds = stage.getBoundingClientRect()
      setView(zoomAt(wheelView.current, wheelView.current.zoom * Math.exp(-event.deltaY * 0.002), event.clientX - bounds.left, event.clientY - bounds.top, bounds.width, bounds.height))
    }
    stage.addEventListener('wheel', wheel, { passive: false })
    return () => { observer.disconnect(); stage.removeEventListener('wheel', wheel) }
  }, [])

  // Draw each model mask in its own coordinate grid, including manual selections.
  const pendingDrafts = useMemo(() => drafts.filter(({ region }) => !regions.some(item => item.id === region.id)), [drafts, regions])

  useEffect(() => {
    const canvas = overlayRef.current!
    const scale = Math.min(1, 1600 / Math.max(size.width, size.height))
    canvas.width = Math.max(1, Math.round(size.width * scale)); canvas.height = Math.max(1, Math.round(size.height * scale))
    const context = canvas.getContext('2d')!
    const colorOrder = [...regions, ...pendingDrafts.map(draft => draft.region)]
    for (const region of [...regions.filter(r => r.id !== selectedId), ...regions.filter(r => r.id === selectedId), ...pendingDrafts.map(draft => draft.region)]) {
      if (region.id === selection.regionId) continue
      context.fillStyle = region.id === selectedId ? '#D4AF37' : regionColors[colorOrder.indexOf(region) % regionColors.length]
      for (const [y, left, right] of region.maskSpans) {
        context.fillRect(left / region.maskWidth * canvas.width, y / region.maskHeight * canvas.height, (right - left) / region.maskWidth * canvas.width, Math.max(1, canvas.height / region.maskHeight))
      }
    }
  }, [regions, selectedId, size, pendingDrafts, selection.regionId])

  useEffect(() => {
    const canvas = selectionRef.current!
    canvas.width = gridWidth; canvas.height = gridHeight
    const context = canvas.getContext('2d')!
    if (!selection.pixels) return
    const data = context.createImageData(gridWidth, gridHeight)
    const rgb = Number.parseInt(editingColor.slice(1), 16)
    const rgba = [rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255]
    for (let i = 0; i < selection.pixels.length; i++) {
      if (!selection.pixels[i]) continue
      data.data.set(rgba, i * 4)
    }
    context.putImageData(data, 0, 0)
  }, [selection, gridWidth, gridHeight, editingColor])

  useEffect(() => {
    if (!expanded) return
    const previousFocus = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => previousFocus?.focus()
  }, [expanded])

  const prepareSelection = () => {
      if (selection.box) {
        return { region: {
          id: selection.regionId || `box-${crypto.randomUUID()}`, name: 'Box selection', category: 'Manual selection',
          boundingBox: selection.box, manual: true, boxed: true, confidence: 0,
          maskWidth: 0, maskHeight: 0, maskSpans: [],
        } }
      }
      else if (pixelRegion && imageRef.current) {
        const region = { ...pixelRegion, id: selection.regionId || `manual-${crypto.randomUUID()}` }
        // Export original image pixels through the exact painted mask. No UI,
        // labels, model highlights, or selection colors enter the analysis image.
        const mask = document.createElement('canvas')
        mask.width = gridWidth; mask.height = gridHeight
        const maskContext = mask.getContext('2d')!
        maskContext.fillStyle = '#000'
        for (const [y, left, right] of region.maskSpans) maskContext.fillRect(left, y, right - left, 1)
        const bounds = region.boundingBox
        const left = Math.floor(bounds.x / 1000 * size.width), top = Math.floor(bounds.y / 1000 * size.height)
        const right = Math.ceil((bounds.x + bounds.width) / 1000 * size.width), bottom = Math.ceil((bounds.y + bounds.height) / 1000 * size.height)
        const crop = document.createElement('canvas')
        const scale = Math.min(1, 2048 / Math.max(right - left, bottom - top))
        crop.width = Math.max(1, Math.round((right - left) * scale)); crop.height = Math.max(1, Math.round((bottom - top) * scale))
        const context = crop.getContext('2d')!
        context.drawImage(imageRef.current, left, top, right - left, bottom - top, 0, 0, crop.width, crop.height)
        context.globalCompositeOperation = 'destination-in'
        context.imageSmoothingEnabled = false
        context.drawImage(mask, left / size.width * gridWidth, top / size.height * gridHeight, (right - left) / size.width * gridWidth, (bottom - top) / size.height * gridHeight, 0, 0, crop.width, crop.height)
        context.globalCompositeOperation = 'destination-over'; context.fillStyle = '#FDFBF6'; context.fillRect(0, 0, crop.width, crop.height)
        return { region, image: crop.toDataURL('image/png') }
      }
  }

  const queueSelection = () => {
    const draft = prepareSelection()
    if (!draft) return drafts
    const saved = { ...draft, region: { ...draft.region, customName: selection.customName }, selection: { ...selection, regionId: draft.region.id } }
    const next = editingDraftIndex >= 0 ? drafts.map((item, index) => index === editingDraftIndex ? saved : item) : [...drafts, saved]
    setDrafts(next)
    setSelection(emptySelection()); setUndo([]); setRedo([])
    if (tool === 'erase') changeTool('paint')
    return next
  }

  const analyze = async () => {
    setLocalError(null)
    setSubmitting(true)
    try {
      const batch = drafts
      setDrafts([])
      setRename(null)
      await onAnalyzeSelection(batch)
      changeTool('inspect')
    } catch (error) {
      setLocalError((error as Error).message || 'Could not analyze the selection')
    } finally {
      setSubmitting(false)
    }
  }

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (submitting || (event.button !== 0 && event.button !== 1)) return
    const local = localPoint(event)
    touches.current.set(event.pointerId, local)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (touches.current.size === 2) {
      if (gesture.current) setSelection(gesture.current.before)
      gesture.current = null
      const [a, b] = [...touches.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view }
      return
    }
    const mode = event.button === 1 ? 'pan' : tool
    if (mode === 'inspect' || (analysisBusy && mode !== 'pan')) return
    const imagePoint = point(event.clientX, event.clientY, false)
    if (mode !== 'pan' && !imagePoint) return
    event.preventDefault()
    const start = mode === 'pan' ? local : imagePoint!
    const pixels = mode === 'paint' || mode === 'erase' ? (selection.pixels?.slice() || new Uint8Array(gridWidth * gridHeight)) : undefined
    gesture.current = { before: selection, start, previous: start, view, pixels, pointer: event.pointerId, mode }
    if (pixels) {
      paintLine(pixels, gridWidth, gridHeight, gridPoint(start), gridPoint(start), brush / geometry.width * gridWidth / 2, mode === 'erase')
      setSelection({ box: null, pixels: pixels.slice(), regionId: selection.regionId, customName: selection.customName })
    } else if (mode === 'box') setSelection({ ...selection, box: { ...start, width: 0, height: 0 }, pixels: null })
  }
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const local = localPoint(event)
    setCursor(local)
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, local)
    if (pinch.current && touches.current.size === 2) {
      const [a, b] = [...touches.current.values()]
      const base = pinch.current
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const next = zoomAt(base.view, base.view.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, base.distance), base.center.x, base.center.y, viewport.width, viewport.height)
      setView({ ...next, x: next.x + center.x - base.center.x, y: next.y + center.y - base.center.y })
      return
    }
    const current = gesture.current
    if (!current || current.pointer !== event.pointerId) return
    if (current.mode === 'pan') {
      setView({ ...current.view, x: current.view.x + local.x - current.start.x, y: current.view.y + local.y - current.start.y }); return
    }
    const next = point(event.clientX, event.clientY)!
    if (current.mode === 'box') setSelection({ ...current.before, box: boxFromPoints(current.start, next), pixels: null })
    else if (current.pixels) {
      paintLine(current.pixels, gridWidth, gridHeight, gridPoint(current.previous), gridPoint(next), brush / geometry.width * gridWidth / 2, current.mode === 'erase')
      setSelection({ box: null, pixels: current.pixels.slice(), regionId: current.before.regionId, customName: current.before.customName })
    }
    current.previous = next
  }
  const pointerEnd = (event: PointerEvent<HTMLDivElement>, cancel = false) => {
    touches.current.delete(event.pointerId)
    if (pinch.current) { if (touches.current.size < 2) pinch.current = null; return }
    const current = gesture.current
    if (!current || current.pointer !== event.pointerId) return
    gesture.current = null
    if (cancel) { setSelection(current.before); return }
    if (current.mode === 'pan') return
    if (current.mode === 'box') {
      const box = boxFromPoints(current.start, point(event.clientX, event.clientY)!)
      if (box.width < 2 || box.height < 2) { setSelection(current.before); return }
      commit({ box, pixels: null, regionId: current.before.regionId, customName: current.before.customName }, current.before)
    } else commit({ box: null, pixels: current.pixels!.slice(), regionId: current.before.regionId, customName: current.before.customName }, current.before)
  }

  return (
    <section ref={panelRef} tabIndex={-1} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label="Image workspace"
      className={`${expanded ? 'fixed inset-3 z-50 shadow-2xl sm:inset-6' : 'relative'} flex min-h-0 min-w-0 flex-col border border-[#3A3A3A]/20 bg-[#FDFBF6] p-3 sm:p-4`}
      onKeyDown={event => {
        if (event.key === 'Escape') { if (expanded) setExpanded(false); else changeTool('inspect') }
        if (expanded && event.key === 'Tab') {
          const controls = [...panelRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
          const first = controls[0], last = controls[controls.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus() }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
        }
        if (editingBusy || (event.target as HTMLElement).tagName === 'INPUT') return
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redoSelection() : undoSelection() }
      }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="text-sm font-bold uppercase tracking-widest text-[#595959]">Image</span><span className="text-sm text-[#595959]">{`${regions.length + drafts.length} ${regions.length + drafts.length === 1 ? 'region' : 'regions'}${analysisBusy ? ' · Analyzing selections' : ''}`}</span></div>
        <div className="flex gap-2">
          <button ref={expandRef} type="button" className={button} onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Close expanded image' : 'Expand image'} title={expanded ? 'Close expanded image (Esc)' : 'Expand image'}>{expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
          <Control title="Remove image" disabled={editingBusy} onClick={onRemove}><X size={18} /></Control>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 border-y border-[#3A3A3A]/15 py-3" role="toolbar" aria-label="Image tools">
        <Control title="Inspect analyzed symbols" active={tool === 'inspect'} onClick={() => changeTool('inspect')}><Scan size={18} /> Inspect</Control>
        <Control title="Pan image" active={tool === 'pan'} onClick={() => changeTool('pan')}><Hand size={18} /> Pan</Control>
        <Control title="Select area" active={tool === 'box'} disabled={editingBusy} onClick={() => changeTool('box')}><Scan size={18} /> Box</Control>
        <Control title="Paint selection" active={tool === 'paint'} disabled={editingBusy} onClick={() => changeTool('paint')}><Brush size={18} /> Paint</Control>
        <Control title="Erase selection" active={tool === 'erase'} disabled={editingBusy || !selection.pixels} onClick={() => changeTool('erase')}><Eraser size={18} /> Erase</Control>
        <Control title="Undo selection (Ctrl+Z)" disabled={editingBusy || !undo.length} onClick={undoSelection}><Undo2 size={18} /></Control>
        <Control title="Redo selection (Ctrl+Shift+Z)" disabled={editingBusy || !redo.length} onClick={redoSelection}><Redo2 size={18} /></Control>

      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1">
          <Control title="Zoom out" disabled={view.zoom <= 1} onClick={() => zoom(1 / 1.3)}><ZoomOut size={18} /></Control>
          <output aria-label="Zoom level" className="min-w-14 text-center tabular-nums">{Math.round(view.zoom * 100)}%</output>
          <Control title="Zoom in" disabled={view.zoom >= 16} onClick={() => zoom(1.3)}><ZoomIn size={18} /></Control>
        </div>
        <button type="button" className={button} onClick={() => setView(initialView())}>Fit image</button>
        <button type="button" className={button} disabled={!selected} onClick={zoomToSymbol}>Zoom to symbol</button>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showMasks} onChange={e => setShowMasks(e.target.checked)} className="h-4 w-4 accent-[#816719]" /> Masks</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} className="h-4 w-4 accent-[#816719]" /> Labels</label>
        <label className="flex min-h-11 items-center gap-2">Opacity<input aria-label="Mask opacity" type="range" min="0" max="80" value={opacity} onChange={e => setOpacity(Number(e.target.value))} className="w-20 accent-[#816719]" /><span className="w-8 tabular-nums">{opacity}%</span></label>
      </div>
      {paintActive && <label className="mb-3 flex flex-wrap items-center gap-3 text-sm">Brush size<input aria-label="Brush size" type="range" min="4" max="100" value={brush} onChange={e => setBrush(Number(e.target.value))} className="accent-[#816719]" /><span className="tabular-nums">{brush} px</span><span className="text-[#595959]">{tool === 'erase' ? 'Remove pixels from your selection.' : 'Paint the pixels you want to analyze.'}</span></label>}
      <div ref={stageRef} tabIndex={0} aria-label="Image viewer. Scroll to zoom; choose Pan to move the image." className={`relative min-h-24 flex-1 touch-none overflow-hidden bg-[#F2EFE7] ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : tool === 'box' ? 'cursor-crosshair' : paintActive ? 'cursor-none' : ''}`}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)} onLostPointerCapture={event => { if (gesture.current?.pointer === event.pointerId) pointerEnd(event, true) }} onPointerLeave={() => setCursor(null)}
        onKeyDown={event => {
          if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.3) }
          if (event.key === '-') { event.preventDefault(); zoom(1 / 1.3) }
          if (event.key === '0') setView(initialView())
          const offsets: Record<string, Point> = { ArrowLeft: { x: 40, y: 0 }, ArrowRight: { x: -40, y: 0 }, ArrowUp: { x: 0, y: 40 }, ArrowDown: { x: 0, y: -40 } }
          if (offsets[event.key]) { event.preventDefault(); const delta = offsets[event.key]; setView(current => ({ ...current, x: current.x + delta.x, y: current.y + delta.y })) }
        }}>
        <div className="pointer-events-none absolute" style={{ left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height }}>
          <img ref={imageRef} src={src} alt="Uploaded image for symbol analysis" draggable={false} className="absolute inset-0 h-full w-full select-none" onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
          <canvas ref={overlayRef} aria-hidden="true" className="absolute inset-0 h-full w-full" style={{ opacity: showMasks ? opacity / 100 : 0 }} />
          {regions.map((region, index) => <button key={region.id} type="button" tabIndex={showLabels || tool === 'inspect' ? 0 : -1} aria-pressed={region.id === selectedId} aria-label={`Select region ${index + 1}: ${label(region)}`} onPointerDown={event => event.stopPropagation()} onClick={() => onSelect(region)} className={`absolute border text-left ${tool === 'inspect' ? 'pointer-events-auto' : 'pointer-events-none'}`} style={{ left: `${region.boundingBox.x / 10}%`, top: `${region.boundingBox.y / 10}%`, width: `${region.boundingBox.width / 10}%`, height: `${region.boundingBox.height / 10}%`, borderColor: region.manual && !region.boxed ? 'transparent' : region.id === selectedId ? '#D4AF37' : showMasks ? regionColors[index % regionColors.length] : 'transparent', borderWidth: region.id === selectedId ? 3 : 1, boxShadow: region.id === selectedId && (!region.manual || region.boxed) ? '0 0 0 1px #0B0B0B' : undefined }}>
            {showLabels && <span className={`pointer-events-auto absolute left-0 top-0 z-10 max-w-full cursor-pointer truncate bg-[#0B0B0B] px-2 py-1 text-xs leading-tight ${region.id === selectedId ? 'font-bold text-[#D4AF37]' : 'text-white'}`}>{label(region) === `Region ${index + 1}` ? label(region) : `${index + 1}. ${label(region)}`}</span>}
          </button>)}
          {pendingDrafts.map(({ region }, index) => (
            <div key={region.id} className={`absolute ${region.id !== selection.regionId && region.boxed ? 'border-2 border-dashed' : ''}`} style={{ left: `${region.boundingBox.x / 10}%`, top: `${region.boundingBox.y / 10}%`, width: `${region.boundingBox.width / 10}%`, height: `${region.boundingBox.height / 10}%`, borderColor: regionColors[(regions.length + index) % regionColors.length] }}>
              {showLabels && <span className="absolute left-0 top-0 bg-[#0B0B0B] px-2 py-1 text-xs text-white" style={{ backgroundColor: regionColors[(regions.length + index) % regionColors.length] }}>{draftLabel(region, index)}</span>}
            </div>
          ))}
          <canvas ref={selectionRef} aria-hidden="true" className="absolute inset-0 h-full w-full" style={{ opacity: showMasks ? opacity / 100 : 0 }} />
          {selection.box && <div aria-label="Selected image area" className="absolute border-2 border-dashed" style={{ borderColor: editingColor, left: `${selection.box.x / 10}%`, top: `${selection.box.y / 10}%`, width: `${selection.box.width / 10}%`, height: `${selection.box.height / 10}%` }} />}
        </div>
        {paintActive && cursor && <div aria-hidden="true" className="pointer-events-none absolute rounded-full border border-white bg-black/10 ring-1 ring-black/60" style={{ left: cursor.x - brush / 2, top: cursor.y - brush / 2, width: brush, height: brush }} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-[#595959]">{localError || (hasSelection ? selection.box ? 'Box selected. Add region to save it for analysis.' : 'Paint one symbol at a time. Add region to save it for analysis.' : tool === 'box' ? 'Drag a box around the symbol.' : tool === 'pan' ? 'Drag to pan. Scroll or pinch to zoom.' : selected ? `${label(selected)}${selected.manual ? ' · manual selection' : ` · ${Math.round(selected.confidence * 100)}% mask confidence`}` : 'Select a symbol, draw a box, or paint an area.')}</p>
        {drafts.length > 0 && (
          <div aria-label="Draft regions" role="group" className="flex w-full gap-2 overflow-x-auto pt-2">
            {drafts.map((draft, index) => (
              <div key={draft.region.id} className="flex shrink-0 border border-[#3A3A3A]/15 bg-[#FDFBF6]">
                {rename?.id === draft.region.id ? (
                  <div className="flex min-h-11 items-center gap-2 px-3 py-2">
                    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-white" style={{ backgroundColor: regionColors[(regions.length + index) % regionColors.length] }}>{index + 1}</span>
                    <span>
                      <span className="relative block text-sm">
                        <span aria-hidden="true" className="invisible">{draftLabel(draft.region, index)}</span>
                        <input
                          autoFocus aria-label={`Rename draft ${index + 1}`} maxLength={80} value={rename.name}
                          className="absolute inset-0 w-full border-0 bg-transparent p-0 text-sm outline-none focus-visible:underline focus-visible:decoration-[#816719] focus-visible:underline-offset-4"
                          onFocus={event => event.currentTarget.select()}
                          onChange={event => setRename({ id: draft.region.id, name: event.target.value })}
                          onBlur={event => {
                            const customName = event.currentTarget.value.trim()
                            setDrafts(current => current.map(item => item.region.id === draft.region.id ? { ...item, region: { ...item.region, customName } } : item))
                            setRename(null)
                          }}
                          onKeyDown={event => {
                            if (event.nativeEvent.isComposing) return
                            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
                            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setRename(null) }
                          }}
                        />
                      </span>
                      <span className="block text-xs text-[#595959]">{index === editingDraftIndex ? 'Editing' : 'Draft · Click to edit'}</span>
                    </span>
                  </div>
                ) : <>
                <button type="button" className="flex min-h-11 items-center gap-2 px-3 py-2 text-left hover:bg-[#F7ECC8]/30 disabled:opacity-50" disabled={editingBusy || hasSelection || editingDraftIndex >= 0} onClick={() => {
                  setRename(null)
                  const { region } = draft
                  let editable = draft.selection
                  if (!editable) {
                    const pixels = region.maskSpans.length ? new Uint8Array(gridWidth * gridHeight) : null
                    if (pixels) {
                      for (const [y, left, right] of region.maskSpans) {
                        const top = Math.floor(y * gridHeight / region.maskHeight)
                        const bottom = Math.ceil((y + 1) * gridHeight / region.maskHeight)
                        const start = Math.floor(left * gridWidth / region.maskWidth)
                        const end = Math.ceil(right * gridWidth / region.maskWidth)
                        for (let row = top; row < bottom; row++) pixels.fill(1, row * gridWidth + start, row * gridWidth + end)
                      }
                    }
                    editable = { box: pixels ? null : region.boundingBox, pixels, regionId: region.id }
                  }
                  setSelection({ ...editable, customName: region.customName }); setUndo([]); setRedo([])
                  changeTool(editable.box ? 'box' : 'paint')
                }}>
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-white" style={{ backgroundColor: regionColors[(regions.length + index) % regionColors.length] }}>{index + 1}</span>
                  <span><span className="block text-sm">{draftLabel(draft.region, index)}</span><span className="block text-xs text-[#595959]">{index === editingDraftIndex ? 'Editing' : 'Draft · Click to edit'}</span></span>
                </button>
                <button type="button" className="px-3 text-sm text-[#816719] hover:underline" disabled={editingBusy || editingDraftIndex >= 0} aria-pressed={rename?.id === draft.region.id} onClick={() => setRename({ id: draft.region.id, name: draftLabel(draft.region, index) })}>Rename</button>
                <button type="button" className={button} disabled={editingBusy || editingDraftIndex >= 0} aria-label={`Delete draft ${index + 1}`} onClick={() => { if (rename?.id === draft.region.id) setRename(null); setDrafts(current => current.filter(item => item.region.id !== draft.region.id)) }}><X size={16} /></button>
                </>}
              </div>
            ))}
          </div>
        )}
        <div role="group" aria-label="Image analysis actions" className="flex flex-wrap items-center gap-2">
        {(hasSelection || editingDraftIndex >= 0) && <button type="button" className={button} disabled={editingBusy} onClick={() => {
          if (editingDraftIndex < 0) commit(emptySelection())
          else { setSelection(emptySelection()); setUndo([]); setRedo([]); if (tool === 'erase') changeTool('paint') }
        }}>{editingDraftIndex >= 0 ? 'Cancel edit' : 'Clear'}</button>}
        {hasSelection && <button type="button" className={`${button} ${!editingBusy ? primaryAction : ""}`} disabled={editingBusy} onClick={() => {
          try { setLocalError(null); queueSelection() }
          catch (error) { setLocalError((error as Error).message || 'Could not save the region') }
        }}>{editingDraftIndex >= 0 ? 'Save changes' : 'Add region'}</button>}
        <button type="button" className={`${button} ${!hasSelection && !drafts.length && !findDisabled ? primaryAction : ''}`} disabled={findDisabled} onClick={onFindSymbols}>
          {finding ? 'Finding symbols…' : discoveryComplete ? 'Image scanned' : 'Find symbols in image'}
        </button>
        <button type="button" className={`${button} ${!analyzeDisabled ? primaryAction : ''}`} disabled={analyzeDisabled} onClick={() => void analyze()}>{drafts.length > 1 ? `Analyze ${drafts.length} regions` : 'Analyze region'}</button>
        </div>
      </div>
    </section>
  )
}
