import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import { buildReadColorCategories } from '../LinearAlignmentsDisplay/colorUtils.ts'
import { colorSchemeIndexFor } from '../LinearAlignmentsDisplay/constants.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../shaders/slang/gap.consts.generated.ts'
import { DELETION_MARK, SKIP_MARK } from './gap/mark.ts'
import { INSERTION_MARK } from './insertion/mark.ts'
import { MISMATCH_MARK } from './mismatch/mark.ts'
import { READ_MARK } from './read/mark.ts'

import type { RenderState } from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InterbaseUploadData } from '../shared/uploadTypes.ts'
import type { GapUploadData } from './gap/types.ts'
import type { MismatchUploadData } from './mismatch/types.ts'
import type { InkRect, Mark } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The pileup marks keep their bp-containment hit tests (ADR-110 §Kept), so
// `sweepDrawAgainstHit`'s box-containment clause is not theirs to pass. This
// holds the half that is: what the painter records for one instance lies
// inside the mark's `ink` for it, and the ink is within a pixel of the
// painting on every side — on both orientations, at a zoom where a one-base
// error is 20 px and one where a cell is a quarter of a pixel.

const FEATURE_HEIGHT = 10
const EPS = 1e-9

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
  featureHeight: FEATURE_HEIGHT,
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
    colorBaseA: [0, 1, 0],
    colorBaseC: [0, 0, 1],
    colorDeletion: [0.5, 0.5, 0.5],
    colorSkip: [0, 0, 1],
    colorInsertion: [1, 0, 1],
  }),
} as unknown as RenderState

function paintedBox(calls: { x: number; y: number; w: number; h: number }[]) {
  let box: { x: number; y: number; w: number; h: number } | undefined
  for (const r of calls) {
    box = box
      ? {
          x: Math.min(box.x, r.x),
          y: Math.min(box.y, r.y),
          w: Math.max(box.x + box.w, r.x + r.w) - Math.min(box.x, r.x),
          h: Math.max(box.y + box.h, r.y + r.h) - Math.min(box.y, r.y),
        }
      : { ...r }
  }
  return box
}

function violation(
  i: number,
  painted: { x: number; y: number; w: number; h: number } | undefined,
  ink: InkRect | undefined,
) {
  if (painted && !ink) {
    return `${i} painted but has no ink`
  }
  if (!painted && ink) {
    return `${i} painted nothing but has ink`
  }
  if (!painted || !ink) {
    return undefined
  }
  const gaps = [
    painted.x - ink.left,
    ink.left + ink.width - (painted.x + painted.w),
    painted.y - ink.top,
    ink.top + ink.height - (painted.y + painted.h),
  ]
  if (gaps.some(g => g < -EPS)) {
    return `${i} painted ${JSON.stringify(painted)} outside its ink ${JSON.stringify(ink)}`
  }
  if (gaps.some(g => g > 1 + EPS)) {
    return `${i}'s ink ${JSON.stringify(ink)} is more than 1px outside its painting ${JSON.stringify(painted)}`
  }
  return undefined
}

/**
 * Paints each instance alone (a slice of the region holding only it) and
 * holds the mark's ink for that instance in the full region to it.
 */
function inkViolations<R>(
  mark: Mark<R, RenderState>,
  region: R,
  count: number,
  sliceOne: (region: R, i: number) => R,
  b: RenderBlock,
) {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const { ctx, calls } = recordingContext()
    mark.paintBlock(ctx, sliceOne(region, i), b, state)
    const v = violation(i, paintedBox(calls), mark.ink?.(region, b, state, i))
    if (v) {
      out.push(v)
    }
  }
  return out
}

const ZOOMS: [string, number][] = [
  ['20 px per bp', 10],
  ['a quarter pixel per bp', 800],
]

describe.each(ZOOMS)('at %s', (_label, bpLength) => {
  describe.each([false, true])('reversed %s', reversed => {
    const b = block(reversed, bpLength)

    test('mismatch: a cell', () => {
      const data: MismatchUploadData = {
        mismatchPositions: new Uint32Array([1002, 1005, 1006, 1009]),
        mismatchYs: new Uint16Array([0, 0, 1, 3]),
        mismatchBases: new Uint8Array([65, 67, 65, 67]),
        mismatchFrequencies: new Uint8Array([255, 255, 255, 255]),
        mismatchQuals: new Uint8Array([60, 60, 60, 60]),
      }
      expect(
        inkViolations(
          MISMATCH_MARK,
          data,
          4,
          (d, i) => ({
            mismatchPositions: d.mismatchPositions.slice(i, i + 1),
            mismatchYs: d.mismatchYs.slice(i, i + 1),
            mismatchBases: d.mismatchBases.slice(i, i + 1),
            mismatchFrequencies: d.mismatchFrequencies.slice(i, i + 1),
            mismatchQuals: d.mismatchQuals.slice(i, i + 1),
          }),
          b,
        ),
      ).toEqual([])
    })

    test.each([
      ['deletion', DELETION_MARK, GAP_DELETION],
      ['skip', SKIP_MARK, GAP_SKIP],
    ])('%s: a span', (_name, mark, type) => {
      const data: GapUploadData = {
        gapPositions: new Uint32Array([1001, 1002, 1003, 1007, 1004, 1009]),
        gapYs: new Uint16Array([0, 1, 2]),
        gapTypes: new Uint8Array([type, type, type]),
        gapFrequencies: new Uint8Array([255, 255, 255]),
      }
      expect(
        inkViolations(
          mark,
          data,
          3,
          (d, i) => ({
            gapPositions: d.gapPositions.slice(i * 2, i * 2 + 2),
            gapYs: d.gapYs.slice(i, i + 1),
            gapTypes: d.gapTypes.slice(i, i + 1),
            gapFrequencies: d.gapFrequencies.slice(i, i + 1),
          }),
          b,
        ),
      ).toEqual([])
    })

    test('insertion: a point', () => {
      const data: InterbaseUploadData = {
        interbasePositions: new Uint32Array([1002, 1005, 1008]),
        interbaseYs: new Uint16Array([0, 1, 2]),
        interbaseLengths: new Uint32Array([1, 5, 40]),
        interbaseFrequencies: new Uint8Array([255, 255, 255]),
        interbaseTypes: new Uint8Array([1, 1, 1]),
        numInsertions: 3,
        numSoftclips: 0,
        numHardclips: 0,
      }
      expect(
        inkViolations(
          INSERTION_MARK,
          data,
          3,
          (d, i) => ({
            ...d,
            interbasePositions: d.interbasePositions.slice(i, i + 1),
            interbaseYs: d.interbaseYs.slice(i, i + 1),
            interbaseLengths: d.interbaseLengths.slice(i, i + 1),
            interbaseFrequencies: d.interbaseFrequencies.slice(i, i + 1),
            interbaseTypes: d.interbaseTypes.slice(i, i + 1),
            numInsertions: 1,
          }),
          b,
        ),
      ).toEqual([])
    })

    test('read: a segment, arrowhead included', () => {
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
        segmentPositions: Uint32Array.from(
          reads.flatMap(r => [r.start, r.end]),
        ),
        segmentReadIndices: new Uint32Array([0, 1, 2]),
        segmentEdgeFlags: new Uint8Array([0b11, 0b11, 0b11]),
      }
      const region = {
        ...base,
        readColorCategories: buildReadColorCategories(base, 'strand'),
      }
      const { ctx, calls } = recordingContext()
      READ_MARK.paintBlock(ctx, region, b, state)
      expect(calls).toHaveLength(3)
      const violations = calls
        .map((painted, s) =>
          violation(s, painted, READ_MARK.ink?.(region, b, state, s)),
        )
        .filter(v => v !== undefined)
      expect(violations).toEqual([])
    })
  })
})
