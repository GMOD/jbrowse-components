import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import type { Buffer } from 'node:buffer'

export interface PngDiff {
  widthA: number
  heightA: number
  widthB: number
  heightB: number
  sameSize: boolean
  // fraction in [0,1] of pixels that differ; 0 when sizes differ
  diffFraction: number
  // serialized PNG of the visual diff (only meaningful when sameSize)
  diffImage: Buffer
}

// Single home for the PNG-decode + pixelmatch dance shared by snapshot
// comparison, cross-backend comparison, and the worker/main-thread render
// check. `perPixelThreshold` is pixelmatch's per-pixel color tolerance (not the
// overall pass/fail threshold — callers decide that from `diffFraction`).
export function comparePngBuffers(
  bufA: Buffer | Uint8Array,
  bufB: Buffer | Uint8Array,
  perPixelThreshold = 0.1,
): PngDiff {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const a = PNG.sync.read(bufA)
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const b = PNG.sync.read(bufB)
  const sameSize = a.width === b.width && a.height === b.height
  const base = {
    widthA: a.width,
    heightA: a.height,
    widthB: b.width,
    heightB: b.height,
  }
  if (!sameSize) {
    return {
      ...base,
      sameSize: false,
      diffFraction: 0,
      diffImage: PNG.sync.write(new PNG({ width: a.width, height: a.height })),
    }
  }
  const { width, height } = a
  const diff = new PNG({ width, height })
  const numDiff = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: perPixelThreshold,
  })
  return {
    ...base,
    sameSize: true,
    diffFraction: numDiff / (width * height),
    diffImage: PNG.sync.write(diff),
  }
}
