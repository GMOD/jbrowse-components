import { rampLutOf } from '@jbrowse/core/util/colorRamp'
import { colord } from '@jbrowse/core/util/colord'

import {
  buildReadColorCategories,
  readColorFromCategoryIndex,
} from '../LinearAlignmentsDisplay/colorUtils.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import { packReadSegments } from '../features/read/mark.ts'
import { MAPQ_RAMP_MAX } from '../shared/qualityRamps.ts'
import { RC_MAPQ, RC_MAPQ_UNAVAILABLE } from './slang/read.consts.generated.ts'
import {
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_WORDS,
} from './slang/read.iface.generated.ts'

const palette = makeTestPalette({ colorPairLR: [0.5, 0.5, 0.5] })

function mapqRegion() {
  const n = 256
  const base = {
    readYs: new Uint16Array(n),
    readStrands: new Int8Array(n).fill(1),
    readFlags: new Uint16Array(n),
    readPairOrientations: new Uint8Array(n),
    readTagColors: new Uint32Array(0),
    readMapqs: Uint8Array.from({ length: n }, (_, i) => i),
    readInsertSizes: new Float32Array(n),
    readInterchrom: new Uint8Array(n),
    segmentPositions: new Uint32Array(n * 2),
    segmentReadIndices: Uint32Array.from({ length: n }, (_, i) => i),
    segmentEdgeFlags: new Uint8Array(n),
  }
  return {
    ...base,
    readPositions: new Uint32Array(n * 2),
    readColorCategories: buildReadColorCategories(base, 'mappingQuality'),
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

function canvasRgb(mapq: number) {
  const { r, g, b } = colord(
    readColorFromCategoryIndex(
      region.readColorCategories[mapq]!,
      mapq,
      region,
      palette,
    ),
  ).toRgb()
  return [r, g, b]
}

function lutRgb(t: number) {
  const lut = rampLutOf({ scheme: 'cividis' })
  const o = Math.round(t * (lut.length / 4 - 1)) * 4
  return [lut[o], lut[o + 1], lut[o + 2]]
}

test('the GPU fill and the Canvas2D fill are one colour at every MAPQ', () => {
  for (let mapq = 0; mapq < 255; mapq++) {
    const { category, fillColor } = gpuFill(mapq)
    expect(category).toBe(RC_MAPQ)
    expect(fillColor).not.toBe(0)
    expect(rgbOfAbgr(fillColor)).toEqual(canvasRgb(mapq))
  }
})

test('the ramp is core cividis over 0 to 60 and flat past it', () => {
  expect(canvasRgb(0)).toEqual(lutRgb(0))
  expect(canvasRgb(30)).toEqual(lutRgb(0.5))
  for (const mapq of [MAPQ_RAMP_MAX, 61, 100, 254]) {
    expect(canvasRgb(mapq)).toEqual(lutRgb(1))
  }
  const ramp = new Set(
    Array.from({ length: MAPQ_RAMP_MAX + 1 }, (_, mapq) =>
      canvasRgb(mapq).join(','),
    ),
  )
  expect(ramp.size).toBe(MAPQ_RAMP_MAX + 1)
})

test('MAPQ 255 leaves the ramp for its own flat bucket', () => {
  const { category, fillColor } = gpuFill(255)
  expect(category).toBe(RC_MAPQ_UNAVAILABLE)
  expect(fillColor).toBe(0)
  expect(canvasRgb(255)).toEqual([128, 128, 128])
})
