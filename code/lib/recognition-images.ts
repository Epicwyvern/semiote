import type { RegionBox } from './discern-image'

// Use source pixels, not a screenshot of the mask/selection UI. Padding preserves
// the complete edge and crossings, while the original image retains context.
export async function recognitionCrop(src: string, box: RegionBox, pad = true): Promise<string> {
  const image = new Image()
  image.src = src
  await image.decode()
  const paddingX = pad ? Math.max(box.width * 0.08, 4) : 0
  const paddingY = pad ? Math.max(box.height * 0.08, 4) : 0
  const left = Math.max(0, Math.floor((box.x - paddingX) / 1000 * image.naturalWidth))
  const top = Math.max(0, Math.floor((box.y - paddingY) / 1000 * image.naturalHeight))
  const right = Math.min(image.naturalWidth, Math.ceil((box.x + box.width + paddingX) / 1000 * image.naturalWidth))
  const bottom = Math.min(image.naturalHeight, Math.ceil((box.y + box.height + paddingY) / 1000 * image.naturalHeight))
  if (right <= left || bottom <= top) throw new Error('The symbol region is empty')
  const scale = Math.min(1, 1600 / Math.max(right - left, bottom - top))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((right - left) * scale))
  canvas.height = Math.max(1, Math.round((bottom - top) * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the symbol close-up')
  context.drawImage(image, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
