import {
  inkViolations,
  recordingContext,
} from '@jbrowse/render-core/marks/drawAgainstHit'

import { buildReadColorCategories } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { colorSchemeIndexFor } from '../../LinearAlignmentsDisplay/constants.ts'
import { makeTestPalette } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { READ_MARK } from './mark.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The read mark has no `hitNearest` (the hit chain resolves reads itself), so
// the containment sweep cannot hold its ink to its painting; this holds the
// ink clause alone, in both orientations, at a zoom where a one-base error is
// 20 px and one where a segment is a quarter of a pixel.

function block(reversed: boolean, bpLength: number): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 1000,
    end: 1000 + bpLength,
    screenStartPx: 0,
    screenEndPx: 200,
    reversed,
  }
}

const state = {
  featureHeight: 10,
  featureSpacing: 2,
  pileupTopOffset: 0,
  scrollTop: 0,
  canvasHeight: 1000,
  mismatchAlpha: false,
  filterMismatchesByFrequency: false,
  showMismatches: true,
  showOutline: false,
  chainMode: false,
  colorScheme: colorSchemeIndexFor('strand'),
  colors: makeTestPalette({
    colorFwdStrand: [1, 0, 0],
    colorRevStrand: [0, 0, 1],
  }),
} as unknown as RenderState

const reads = [
  { start: 1001, end: 1004, strand: 1 },
  { start: 1002, end: 1009, strand: -1 },
  { start: 1005, end: 1006, strand: 0 },
]
const base = {
  readPositions: Uint32Array.from(reads.flatMap(r => [r.start, r.end])),
  readYs: new Uint16Array([0, 1, 2]),
  readStrands: Int8Array.from(reads.map(r => r.strand)),
  readFlags: new Uint16Array(3),
  readPairOrientations: new Uint8Array(3),
  readTagColors: new Uint32Array(3),
  readMapqs: new Uint8Array(3),
  readInsertSizes: new Float32Array(3),
  readChainHasSupp: undefined,
  readInterchrom: new Uint8Array(3),
  segmentPositions: Uint32Array.from(reads.flatMap(r => [r.start, r.end])),
  segmentReadIndices: new Uint32Array([0, 1, 2]),
  segmentEdgeFlags: new Uint8Array([0b11, 0b11, 0b11]),
}
const region = {
  ...base,
  readColorCategories: buildReadColorCategories(base, 'strand'),
}

describe.each([
  ['20 px per bp', 10],
  ['a quarter pixel per bp', 800],
])('at %s', (_label, bpLength) => {
  test.each([false, true])(
    'a segment, arrowhead included, inks its painting (reversed %s)',
    reversed => {
      const b = block(reversed, bpLength)
      const { ctx, calls } = recordingContext()
      READ_MARK.paintBlock(ctx, region, b, state)
      expect(calls).toHaveLength(3)
      expect(inkViolations(READ_MARK, region, b, state, calls, 1)).toEqual([])
    },
  )
})
