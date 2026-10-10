import { rampLutOf, stopsFromRampLut } from '@jbrowse/core/util/colorRamp'
import { colord } from '@jbrowse/core/util/colord'

import { bakedColorScale } from '../LinearAlignmentsDisplay/bakedColorScale.ts'
import {
  buildReadColorCategories,
  readColorFromCategoryIndex,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import { buildReadFillColors } from '../LinearAlignmentsDisplay/readFillColors.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import { baseWorkerPileupData } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { packReadSegments } from '../features/read/mark.ts'
import { alignmentsColorEncoding } from '../shared/alignmentsColor.ts'
import { RC_MAPQ, RC_MAPQ_UNAVAILABLE } from './slang/read.consts.generated.ts'
import {
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_WORDS,
} from './slang/read.iface.generated.ts'

const palette = makeTestPalette({ colorPairLR: [0.5, 0.5, 0.5] })

function mapqRegion(written: { domain?: string[] } = {}) {
  const n = 256
  const base = {
    readYs: new Uint16Array(n),
    readStrands: new Int8Array(n).fill(1),
    readFlags: new Uint16Array(n),
    readPairOrientations: new Uint8Array(n),
    readFillColors: new Uint32Array(0),
    readMapqs: Uint8Array.from({ length: n }, (_, i) => i),
    readInsertSizes: new Float32Array(n),
    readInterchrom: new Uint8Array(n),
    segmentPositions: new Uint32Array(n * 2),
    segmentReadIndices: Uint32Array.from({ length: n }, (_, i) => i),
    segmentEdgeFlags: new Uint8Array(n),
  }
  const colorBy = { type: 'mappingQuality' } as const
  const scale = bakedColorScale(
    colorBy,
    alignmentsColorEncoding({
      value: undefined,
      field: 'mapq',
      scale: undefined,
      scheme: undefined,
      reverse: false,
      domainMin: undefined,
      domainMax: undefined,
      domainMid: undefined,
      domain: [],
      range: [],
      ...written,
    }),
    undefined,
    undefined,
  )
  const readFillColors = buildReadFillColors(
    { ...baseWorkerPileupData(n), readMapqs: base.readMapqs },
    colorBy,
    scale,
  )
  const colored = { ...base, readFillColors }
  return {
    ...colored,
    readPositions: new Uint32Array(n * 2),
    readColorCategories: buildReadColorCategories(colored, 'mappingQuality'),
  }
}

const region = mapqRegion()
const packed = new Uint32Array(packReadSegments(region))

function gpuFill(mapq: number) {
  const o = mapq * INSTANCE_STRIDE_WORDS
  return {
    category: packed[o + INSTANCE_OFFSET_U32.colorCategory]!,
    fillColor: packed[o + INSTANCE_OFFSET_U32.fillColor]!,
  }
}

function rgbOfAbgr(c: number) {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255]
}

function canvasRgb(mapq: number, painted = region) {
  const { r, g, b } = colord(
    readColorFromCategoryIndex(
      painted.readColorCategories[mapq]!,
      mapq,
      painted,
      palette,
    ),
  ).toRgb()
  return [r, g, b]
}

function cssRgb(css: string) {
  const { r, g, b } = colord(css).toRgb()
  return [r, g, b]
}

test('the GPU fill and the Canvas2D fill are one color at every MAPQ', () => {
  for (let mapq = 0; mapq < 255; mapq++) {
    const { category, fillColor } = gpuFill(mapq)
    expect(category).toBe(RC_MAPQ)
    expect(fillColor).not.toBe(0)
    expect(rgbOfAbgr(fillColor)).toEqual(canvasRgb(mapq))
  }
})

function cividis(n: number) {
  return stopsFromRampLut(rampLutOf({ scheme: 'cividis' }), n).map(stop =>
    cssRgb(stop.color),
  )
}

// The facet's confidence bins, each one color: 0, 1-9, 10-29 and 30 up.
test('by default MAPQ paints the facet bins', () => {
  const bins = cividis(4)
  expect(canvasRgb(0)).toEqual(bins[0])
  for (const mapq of [1, 9]) {
    expect(canvasRgb(mapq)).toEqual(bins[1])
  }
  for (const mapq of [10, 29]) {
    expect(canvasRgb(mapq)).toEqual(bins[2])
  }
  for (const mapq of [30, 60, 254]) {
    expect(canvasRgb(mapq)).toEqual(bins[3])
  }
})

test('written cuts spread the preset scheme from end to end', () => {
  const twoBins = mapqRegion({ domain: ['20'] })
  const [low, high] = cividis(2)
  expect(canvasRgb(0, twoBins)).toEqual(low)
  expect(canvasRgb(19, twoBins)).toEqual(low)
  expect(canvasRgb(20, twoBins)).toEqual(high)
  expect(canvasRgb(60, twoBins)).toEqual(high)
})

test('MAPQ 255 leaves the ramp for its own flat bucket', () => {
  const { category, fillColor } = gpuFill(255)
  expect(category).toBe(RC_MAPQ_UNAVAILABLE)
  expect(fillColor).toBe(0)
  expect(canvasRgb(255)).toEqual([128, 128, 128])
})
