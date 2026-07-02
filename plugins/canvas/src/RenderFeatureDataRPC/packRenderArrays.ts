import type { FeatureDataResult } from './rpcTypes.ts'

export interface RectData {
  start: number
  end: number
  y: number
  height: number
  color: number
  strand: number
  flatbushIdx: number
  // Whole-feature box glyphs (variants, plain BED) fade to a density texture
  // when collapsed sub-pixel; gene subfeature rects (CDS/exon/UTR) never do.
  densityFade: boolean
}

export interface LineData {
  start: number
  end: number
  y: number
  color: number
  direction: number
  flatbushIdx: number
}

export interface ArrowData {
  x: number
  y: number
  direction: number
  color: number
  flatbushIdx: number
}

// Filters a per-feature accumulator down to the visible bp window and packs
// into the parallel typed arrays the GPU/Canvas2D renderers consume. Color
// is already a packed RGBA32 u32 on the producer side — copied straight to
// the vertex buffer, shader unpacks.
export function packRenderArrays(
  rects: RectData[],
  lines: LineData[],
  arrows: ArrowData[],
  regionStart: number,
  regionEnd: number,
): Pick<
  FeatureDataResult,
  | 'rectPositions'
  | 'rectYs'
  | 'rectHeights'
  | 'rectColors'
  | 'rectStrands'
  | 'rectDensityFade'
  | 'rectFeatureIndices'
  | 'linePositions'
  | 'lineYs'
  | 'lineColors'
  | 'lineDirections'
  | 'lineFeatureIndices'
  | 'arrowXs'
  | 'arrowYs'
  | 'arrowDirections'
  | 'arrowColors'
  | 'arrowFeatureIndices'
> {
  const visibleRects = rects.filter(
    r => r.end > regionStart && r.start < regionEnd,
  )
  const visibleLines = lines.filter(
    l => l.end > regionStart && l.start < regionEnd,
  )
  const visibleArrows = arrows.filter(
    a => a.x >= regionStart && a.x < regionEnd,
  )

  const rectPositions = new Uint32Array(visibleRects.length * 2)
  const rectYs = new Float32Array(visibleRects.length)
  const rectHeights = new Float32Array(visibleRects.length)
  const rectColors = new Uint32Array(visibleRects.length)
  const rectStrands = new Float32Array(visibleRects.length)
  const rectDensityFade = new Uint32Array(visibleRects.length)
  const rectFeatureIndices = new Uint32Array(visibleRects.length)

  for (const [i, rect] of visibleRects.entries()) {
    rectPositions[i * 2] = rect.start
    rectPositions[i * 2 + 1] = rect.end
    rectYs[i] = rect.y
    rectHeights[i] = rect.height
    rectColors[i] = rect.color
    rectStrands[i] = rect.strand
    rectDensityFade[i] = rect.densityFade ? 1 : 0
    rectFeatureIndices[i] = rect.flatbushIdx
  }

  const linePositions = new Uint32Array(visibleLines.length * 2)
  const lineYs = new Float32Array(visibleLines.length)
  const lineColors = new Uint32Array(visibleLines.length)
  const lineDirections = new Int8Array(visibleLines.length)
  const lineFeatureIndices = new Uint32Array(visibleLines.length)

  for (const [i, line] of visibleLines.entries()) {
    linePositions[i * 2] = line.start
    linePositions[i * 2 + 1] = line.end
    lineYs[i] = line.y
    lineColors[i] = line.color
    lineDirections[i] = line.direction
    lineFeatureIndices[i] = line.flatbushIdx
  }

  const arrowXs = new Uint32Array(visibleArrows.length)
  const arrowYs = new Float32Array(visibleArrows.length)
  const arrowDirections = new Int8Array(visibleArrows.length)
  const arrowColors = new Uint32Array(visibleArrows.length)
  const arrowFeatureIndices = new Uint32Array(visibleArrows.length)

  for (const [i, arrow] of visibleArrows.entries()) {
    arrowXs[i] = arrow.x
    arrowYs[i] = arrow.y
    arrowDirections[i] = arrow.direction
    arrowColors[i] = arrow.color
    arrowFeatureIndices[i] = arrow.flatbushIdx
  }

  return {
    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    rectStrands,
    rectDensityFade,
    rectFeatureIndices,
    linePositions,
    lineYs,
    lineColors,
    lineDirections,
    lineFeatureIndices,
    arrowXs,
    arrowYs,
    arrowDirections,
    arrowColors,
    arrowFeatureIndices,
  }
}
