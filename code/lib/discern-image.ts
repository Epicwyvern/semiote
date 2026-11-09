export type RegionBox = { x: number; y: number; width: number; height: number }
export type SymbolRegion = {
  id: string
  name: string
  customName?: string
  category: string
  confidence: number
  boundingBox: RegionBox
  maskWidth: number
  maskHeight: number
  maskSpans: [number, number, number][]
  manual?: boolean
  boxed?: boolean
}
export type View = { zoom: number; x: number; y: number }
export type Selection = { box: RegionBox | null; pixels: Uint8Array | null; regionId?: string; customName?: string }
export const emptySelection = (): Selection => ({ box: null, pixels: null })
export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

export function imageGeometry(imageWidth: number, imageHeight: number, width: number, height: number, view: View) {
  const fit = Math.min(width / imageWidth, height / imageHeight) || 1
  const renderedWidth = imageWidth * fit * view.zoom
  const renderedHeight = imageHeight * fit * view.zoom
  return { width: renderedWidth, height: renderedHeight, left: (width - renderedWidth) / 2 + view.x, top: (height - renderedHeight) / 2 + view.y }
}

export function zoomAt(view: View, zoom: number, x: number, y: number, width: number, height: number): View {
  const next = clamp(zoom, 1, 16)
  const ratio = next / view.zoom
  return { zoom: next, x: x - width / 2 - (x - width / 2 - view.x) * ratio, y: y - height / 2 - (y - height / 2 - view.y) * ratio }
}

export function boxFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): RegionBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

// Brush coordinates use the selection grid, never the display canvas or zoom.
export function paintLine(pixels: Uint8Array, width: number, height: number, from: { x: number; y: number }, to: { x: number; y: number }, radius: number, erase: boolean) {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / Math.max(0.5, radius / 2)))
  for (let step = 0; step <= steps; step++) {
    const cx = from.x + (to.x - from.x) * step / steps
    const cy = from.y + (to.y - from.y) * step / steps
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(height, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(width, Math.ceil(cx + radius)); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius ** 2) pixels[y * width + x] = erase ? 0 : 1
      }
    }
  }
}

export function regionFromPixels(pixels: Uint8Array, width: number, height: number, id: string): SymbolRegion | null {
  const spans: SymbolRegion['maskSpans'] = []
  let left = width, top = height, right = 0, bottom = 0
  for (let y = 0; y < height; y++) {
    let start = -1
    for (let x = 0; x <= width; x++) {
      const filled = x < width && pixels[y * width + x] !== 0
      if (filled && start < 0) start = x
      if (!filled && start >= 0) {
        spans.push([y, start, x]); left = Math.min(left, start); right = Math.max(right, x)
        top = Math.min(top, y); bottom = Math.max(bottom, y + 1); start = -1
      }
    }
  }
  if (!spans.length) return null
  return { id, name: 'Painted selection', category: 'Manual selection', manual: true, confidence: 0,
    boundingBox: { x: left / width * 1000, y: top / height * 1000, width: (right - left) / width * 1000, height: (bottom - top) / height * 1000 },
    maskWidth: width, maskHeight: height, maskSpans: spans }
}

export function pixelsFromRegion(region: SymbolRegion, width: number, height: number) {
  const pixels = new Uint8Array(width * height)
  for (const [y, start, end] of region.maskSpans) {
    const top = Math.floor(y / region.maskHeight * height), bottom = Math.ceil((y + 1) / region.maskHeight * height)
    const left = Math.floor(start / region.maskWidth * width), right = Math.ceil(end / region.maskWidth * width)
    for (let row = top; row < bottom; row++) pixels.fill(1, row * width + left, row * width + right)
  }
  return pixels
}
