import { PNG } from 'pngjs'

import type { Buffer } from 'node:buffer'

export interface CanvasContentStats {
  distinctColors: number
  nonBgFraction: number
}

// Quantize a captured canvas to a color histogram and report how much of it is
// not the dominant (background) color. Shared by the explicit
// `assertCanvasHasContent` gate and by `canvasSnapshot`, so a shader that
// compiles but draws nothing is caught the same way in both. Kept dependency-
// free (no helpers/snapshot imports) to avoid a circular import between those.
export function analyzeCanvasPng(buf: Buffer | Uint8Array): CanvasContentStats {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const { data, width, height } = PNG.sync.read(buf)
  const total = width * height
  // 4 bits/channel so antialiasing noise isn't counted as a distinct color.
  // The background is the most common bucket (these displays are mostly empty
  // canvas with sparse features) — more robust than sampling a corner pixel
  // that may land on real content.
  const histogram = new Map<number, number>()
  for (let i = 0; i < data.length; i += 4) {
    const key =
      ((data[i]! >> 4) << 8) | ((data[i + 1]! >> 4) << 4) | (data[i + 2]! >> 4)
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }
  let bgCount = 0
  for (const count of histogram.values()) {
    if (count > bgCount) {
      bgCount = count
    }
  }
  return {
    distinctColors: histogram.size,
    nonBgFraction: (total - bgCount) / total,
  }
}

// Throws a descriptive error if the stats look blank. Thresholds default lenient
// so a sparse-but-real track (a single synteny ribbon, a handful of variants)
// passes while a truly empty frame (shader drew nothing, GL error, wrong
// uniforms) fails loudly.
export function assertNonBlank(
  stats: CanvasContentStats,
  label: string,
  { minDistinctColors = 3, minNonBgFraction = 0.0005 } = {},
) {
  if (
    stats.distinctColors < minDistinctColors ||
    stats.nonBgFraction < minNonBgFraction
  ) {
    throw new Error(
      `${label} looks blank — ${stats.distinctColors} distinct colors ` +
        `(need ${minDistinctColors}), ` +
        `${(stats.nonBgFraction * 100).toFixed(3)}% non-background pixels ` +
        `(need ${(minNonBgFraction * 100).toFixed(3)}%). ` +
        // Was "usually means a shader/upload regression, not a snapshot drift",
        // which is the wrong half to name first under `--swiftshader`: a
        // SwiftShader screenshot of a WebGL canvas comes back empty for a
        // compositing reason, and the self-report cannot contradict it (see
        // canvasSelfReport). Read the note this label carries, then re-run the
        // one test with `--real-gpu` before opening a shader.
        `A shader/upload regression looks like this, and so does a SwiftShader ` +
        `compositing blank — read the self-report note above, then re-run this ` +
        `one test with --real-gpu, which only the first survives.`,
    )
  }
}
