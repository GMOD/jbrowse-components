import { insertionSizeAlpha } from '@jbrowse/alignments-core'
import { bpAtPx, bpAtPxExact } from '@jbrowse/render-core/canvas2dUtils'
import { sweepDrawAgainstContainment } from '@jbrowse/render-core/marks/drawAgainstHit'

import {
  getInsertionType,
  insertionBarWidth,
  passesFrequencyGate,
} from '../LinearAlignmentsDisplay/constants.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../shaders/slang/gap.consts.generated.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from '../shared/types.ts'
import { CLIP_MARK } from './clip/mark.ts'
import { DELETION_MARK, SKIP_MARK } from './gap/mark.ts'
import { INSERTION_MARK } from './insertion/mark.ts'
import { MISMATCH_MARK } from './mismatch/mark.ts'
import { MODIFICATION_MARK } from './modification/mark.ts'
import { OVERLAP_MARK } from './overlap/mark.ts'
import { PER_BASE_LETTER_MARK } from './perBaseLetter/mark.ts'
import { PER_BASE_QUALITY_MARK } from './perBaseQuality/mark.ts'
import { SOFTCLIP_BASES_MARK } from './softclipBases/mark.ts'

import type { RenderState } from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InterbaseUploadData } from '../shared/uploadTypes.ts'
import type { GapUploadData } from './gap/types.ts'
import type { MismatchUploadData } from './mismatch/types.ts'
import type { ModificationUploadData } from './modification/types.ts'
import type { OverlapsUploadData } from './overlap/types.ts'
import type { PerBaseLetterUploadData } from './perBaseLetter/types.ts'
import type { PerBaseQualityUploadData } from './perBaseQuality/types.ts'
import type { SoftclipBasesUploadData } from './softclipBases/types.ts'
import type { Mark, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Each mark's hit rule restated from its declaration (row body, pivot, slice,
// click gate), so the sweep holds `hitNearest` and `ink` to it and the painting.

const INSERTION_HIT_SLOP_PX = 2
const CLIP_HIT_TOLERANCE_PX = 3
const CLIP_HIT_MIN_TOLERANCE_BP = 0.5
const OFF_CANVAS_ROW = 0xffff
const START = 1000

const scrolled = {
  featureHeight: 10,
  featureSpacing: 2,
  pileupTopOffset: 3,
  scrollTop: 5,
  filterMismatchesByFrequency: true,
  chainMode: true,
  collapseGroupRows: false,
}

const compact = {
  featureHeight: 7,
  featureSpacing: 0,
  pileupTopOffset: 0,
  scrollTop: 0,
  filterMismatchesByFrequency: false,
  chainMode: false,
  collapseGroupRows: true,
}

function renderState(overrides: Partial<RenderState>) {
  return {
    canvasWidth: 240,
    canvasHeight: 62,
    mismatchAlpha: false,
    showMismatches: true,
    showSoftClipping: true,
    showModifications: true,
    showPerBaseQuality: true,
    showPerBaseLetter: true,
    colors: makeTestPalette({
      colorBaseA: [0, 1, 0],
      colorBaseC: [0, 0, 1],
      colorDeletion: [0.5, 0.5, 0.5],
      colorSkip: [0, 0, 1],
      colorInsertion: [1, 0, 1],
      colorSoftclip: [1, 0, 0],
      colorHardclip: [0, 0, 1],
    }),
    ...scrolled,
    ...overrides,
  } as RenderState
}

function blockOf(reversed: boolean, bpLength: number): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: START,
    end: START + bpLength,
    screenStartPx: 20,
    screenEndPx: 220,
    reversed,
  }
}

interface Case<R> {
  mark: Mark<R, RenderState>
  region: R
  rows: (region: R) => Uint16Array
  withRows: (region: R, rows: Uint16Array) => R
  contains: (
    region: R,
    block: RenderBlock,
    state: RenderState,
    i: number,
    xPx: number,
  ) => boolean
}

type Counted<R> = R & { count: number }

function shapeOf<R>(
  mark: Mark<R, RenderState>,
): MarkShape<Counted<R>, RenderState> {
  return {
    id: mark.pass.id,
    pass: mark.pass,
    writeUniforms() {},
    paintBlock(ctx, region, block, _frame, state) {
      mark.paintBlock(ctx, region, block, state)
    },
    ink(region, block, _frame, state, i) {
      return mark.ink!(region, block, state, i)
    },
    hitNearest(region, block, _frame, state, x, y, candidates, maxDistSq) {
      return mark.hitNearest!(region, block, state, x, y, candidates, maxDistSq)
    },
  }
}

function rowUnder(state: RenderState, yPx: number) {
  const pitch = state.featureHeight + state.featureSpacing
  const adjusted = yPx + state.scrollTop - state.pileupTopOffset
  const row = Math.floor(adjusted / pitch)
  return adjusted >= 0 && adjusted - row * pitch <= state.featureHeight
    ? row
    : -1
}

function sweep<R>(c: Case<R>, block: RenderBlock, state: RenderState) {
  const rows = c.rows(c.region)
  return sweepDrawAgainstContainment(
    shapeOf(c.mark),
    { ...c.region, count: rows.length },
    block,
    state,
    state,
    {
      contains: (i, xPx, yPx) =>
        rows[i] === rowUnder(state, yPx) &&
        c.contains(c.region, block, state, i, xPx),
      sliceOne: (region, i) => ({
        ...c.withRows(
          region,
          rows.map((row, k) => (k === i ? row : OFF_CANVAS_ROW)),
        ),
        count: region.count,
      }),
    },
  )
}

function bpPerPxOf(block: RenderBlock) {
  return (block.end - block.start) / (block.screenEndPx - block.screenStartPx)
}

function inSpan(
  positions: Uint32Array,
  block: RenderBlock,
  i: number,
  xPx: number,
) {
  const bp = bpAtPxExact(xPx, block)
  return bp >= positions[i * 2]! && bp < positions[i * 2 + 1]!
}

function inCell(
  positions: Uint32Array,
  block: RenderBlock,
  i: number,
  xPx: number,
) {
  return bpAtPx(xPx, block) === positions[i]
}

function gapCase(
  kind: number,
  spans: [
    start: number,
    end: number,
    row: number,
    kind: number,
    freq: number,
  ][],
): Case<GapUploadData> {
  return {
    mark: kind === GAP_SKIP ? SKIP_MARK : DELETION_MARK,
    region: {
      gapPositions: Uint32Array.from(spans.flatMap(s => [s[0], s[1]])),
      gapYs: Uint16Array.from(spans, s => s[2]),
      gapTypes: Uint8Array.from(spans, s => s[3]),
      gapFrequencies: Uint8Array.from(spans, s => s[4]),
    },
    rows: r => r.gapYs,
    withRows: (r, gapYs) => ({ ...r, gapYs }),
    contains: (r, block, state, i, xPx) => {
      const length = r.gapPositions[i * 2 + 1]! - r.gapPositions[i * 2]!
      const bpPerPx = bpPerPxOf(block)
      return (
        r.gapTypes[i] === kind &&
        inSpan(r.gapPositions, block, i, xPx) &&
        (kind === GAP_SKIP ||
          passesFrequencyGate(
            length > 0 ? bpPerPx / length : bpPerPx,
            r.gapFrequencies[i]!,
            state.filterMismatchesByFrequency,
          ))
      )
    },
  }
}

function gaps(kind: number, scale: number) {
  const at = (u: number) => START + u * scale
  return gapCase(kind, [
    [at(1), at(3), 0, GAP_DELETION, 255],
    [at(2), at(6), 0, GAP_SKIP, 0],
    [at(2), at(4), 0, GAP_DELETION, 255],
    [at(4), at(5), 0, GAP_DELETION, 255],
    [at(6), at(6) + 1, 1, GAP_DELETION, 255],
    [at(7), at(7) + 1, 1, GAP_DELETION, 0],
    [at(8), at(9), 6, GAP_DELETION, 255],
    [at(5), at(9), 2, GAP_SKIP, 0],
    [at(6), at(8), 2, GAP_SKIP, 0],
    [at(0), at(10), 5, GAP_DELETION, 255],
    [at(3), at(3) + 1, 3, GAP_DELETION, 255],
  ])
}

function mismatchCase(
  cells: [position: number, row: number, freq: number, qual: number][],
): Case<MismatchUploadData> {
  return {
    mark: MISMATCH_MARK,
    region: {
      mismatchPositions: Uint32Array.from(cells, c => c[0]),
      mismatchYs: Uint16Array.from(cells, c => c[1]),
      mismatchBases: Uint8Array.from(cells, (_, i) => [65, 67, 71, 84][i % 4]!),
      mismatchFrequencies: Uint8Array.from(cells, c => c[2]),
      mismatchQuals: Uint8Array.from(cells, c => c[3]),
    },
    rows: r => r.mismatchYs,
    withRows: (r, mismatchYs) => ({ ...r, mismatchYs }),
    contains: (r, block, state, i, xPx) =>
      inCell(r.mismatchPositions, block, i, xPx) &&
      passesFrequencyGate(
        bpPerPxOf(block),
        r.mismatchFrequencies[i]!,
        state.filterMismatchesByFrequency,
      ),
  }
}

function mismatches(scale: number) {
  const at = (u: number) => START + u * scale
  return mismatchCase([
    [at(1), 0, 255, 60],
    [at(1), 0, 255, 25],
    [at(2), 1, 0, 60],
    [at(3), 6, 255, 60],
    [at(5), 2, 255, 60],
    [at(5) + 1, 2, 128, 60],
    [at(10) - 1, 3, 255, 255],
  ])
}

function cellRun(scale: number) {
  const at = (u: number) => START + u * scale
  const cells = [
    [at(1), 1],
    [at(1) + 1, 1],
    [at(1) + 2, 1],
    [at(1) + 3, 1],
    [at(4), 0],
    [at(4), 0],
    [at(7), 2],
    [at(9), 6],
    [at(10) - 1, 5],
  ]
  return {
    positions: Uint32Array.from(cells, c => c[0]!),
    rows: Uint16Array.from(cells, c => c[1]!),
    keys: Uint8Array.from(cells, (_, i) => [65, 67, 71, 84, 78][i % 5]!),
  }
}

function perBaseQuality(scale: number): Case<PerBaseQualityUploadData> {
  const run = cellRun(scale)
  return {
    mark: PER_BASE_QUALITY_MARK,
    region: {
      perBaseQualPositions: run.positions,
      perBaseQualYs: run.rows,
      perBaseQualScores: run.keys.map(k => k % 60),
    },
    rows: r => r.perBaseQualYs,
    withRows: (r, perBaseQualYs) => ({ ...r, perBaseQualYs }),
    contains: (r, block, _state, i, xPx) =>
      inCell(r.perBaseQualPositions, block, i, xPx),
  }
}

function perBaseLetter(scale: number): Case<PerBaseLetterUploadData> {
  const run = cellRun(scale)
  return {
    mark: PER_BASE_LETTER_MARK,
    region: {
      perBaseLetterPositions: run.positions,
      perBaseLetterYs: run.rows,
      perBaseLetterBases: run.keys,
    },
    rows: r => r.perBaseLetterYs,
    withRows: (r, perBaseLetterYs) => ({ ...r, perBaseLetterYs }),
    contains: (r, block, _state, i, xPx) =>
      inCell(r.perBaseLetterPositions, block, i, xPx),
  }
}

function softclipBases(scale: number): Case<SoftclipBasesUploadData> {
  const run = cellRun(scale)
  return {
    mark: SOFTCLIP_BASES_MARK,
    region: {
      softclipBasePositions: run.positions,
      softclipBaseYs: run.rows,
      softclipBaseBases: run.keys,
    },
    rows: r => r.softclipBaseYs,
    withRows: (r, softclipBaseYs) => ({ ...r, softclipBaseYs }),
    contains: (r, block, _state, i, xPx) =>
      inCell(r.softclipBasePositions, block, i, xPx),
  }
}

function modifications(scale: number): Case<ModificationUploadData> {
  const run = cellRun(scale)
  return {
    mark: MODIFICATION_MARK,
    region: {
      modificationPositions: run.positions,
      modificationYs: run.rows,
      modificationColors: Uint32Array.from(run.keys, k =>
        k === 65 ? 0xff0000ff : 0xffff0000,
      ),
    },
    rows: r => r.modificationYs,
    withRows: (r, modificationYs) => ({ ...r, modificationYs }),
    contains: (r, block, _state, i, xPx) =>
      inCell(r.modificationPositions, block, i, xPx),
  }
}

function overlapCase(
  spans: [start: number, end: number, row: number][],
): Case<OverlapsUploadData> {
  return {
    mark: OVERLAP_MARK,
    region: {
      overlapPositions: Uint32Array.from(spans.flatMap(s => [s[0], s[1]])),
      overlapYs: Uint16Array.from(spans, s => s[2]),
    },
    rows: r => r.overlapYs,
    withRows: (r, overlapYs) => ({ ...r, overlapYs }),
    contains: (r, block, _state, i, xPx) =>
      inSpan(r.overlapPositions, block, i, xPx),
  }
}

function overlaps(scale: number) {
  const at = (u: number) => START + u * scale
  return overlapCase([
    [at(1), at(4), 0],
    [at(3), at(6), 0],
    [at(7), at(9), 1],
    [at(2), at(8), 6],
  ])
}

function interbase(scale: number): InterbaseUploadData {
  const at = (u: number) => START + u * scale
  const entries = [
    [at(2), 0, 3, 255, INTERBASE_INSERTION],
    [at(2) + 1, 0, 4, 255, INTERBASE_INSERTION],
    [at(5), 1, 100, 255, INTERBASE_INSERTION],
    [at(7), 2, 3, 0, INTERBASE_INSERTION],
    [at(8), 6, 3, 255, INTERBASE_INSERTION],
    [at(3), 3, 7, 255, INTERBASE_SOFTCLIP],
    [at(6), 4, 7, 0, INTERBASE_SOFTCLIP],
    [at(3), 3, 5, 255, INTERBASE_HARDCLIP],
    [at(9), 4, 5, 255, INTERBASE_HARDCLIP],
  ]
  return {
    interbasePositions: Uint32Array.from(entries, e => e[0]!),
    interbaseYs: Uint16Array.from(entries, e => e[1]!),
    interbaseLengths: Uint32Array.from(entries, e => e[2]!),
    interbaseFrequencies: Uint8Array.from(entries, e => e[3]!),
    interbaseTypes: Uint8Array.from(entries, e => e[4]!),
    numInsertions: 5,
    numSoftclips: 2,
    numHardclips: 2,
  }
}

function nearPoint(
  r: InterbaseUploadData,
  block: RenderBlock,
  i: number,
  xPx: number,
  toleranceBp: number,
) {
  return (
    Math.abs(bpAtPxExact(xPx, block) - r.interbasePositions[i]!) < toleranceBp
  )
}

function insertions(scale: number): Case<InterbaseUploadData> {
  return {
    mark: INSERTION_MARK,
    region: interbase(scale),
    rows: r => r.interbaseYs,
    withRows: (r, interbaseYs) => ({ ...r, interbaseYs }),
    contains: (r, block, state, i, xPx) => {
      const length = r.interbaseLengths[i]!
      const bpPerPx = bpPerPxOf(block)
      const pxPerBp = 1 / bpPerPx
      const widthPx = insertionBarWidth(length, pxPerBp, state.featureHeight)
      return (
        i < r.numInsertions &&
        nearPoint(
          r,
          block,
          i,
          xPx,
          (widthPx / 2 + INSERTION_HIT_SLOP_PX) * bpPerPx,
        ) &&
        insertionSizeAlpha(length, pxPerBp) !== 0 &&
        (getInsertionType(length, pxPerBp) !== 'small' ||
          passesFrequencyGate(
            bpPerPx,
            r.interbaseFrequencies[i]!,
            state.filterMismatchesByFrequency,
          ))
      )
    },
  }
}

function clips(scale: number): Case<InterbaseUploadData> {
  return {
    mark: CLIP_MARK,
    region: interbase(scale),
    rows: r => r.interbaseYs,
    withRows: (r, interbaseYs) => ({ ...r, interbaseYs }),
    contains: (r, block, state, i, xPx) => {
      const bpPerPx = bpPerPxOf(block)
      const { numInsertions, numSoftclips, numHardclips } = r
      return (
        i >= numInsertions &&
        i < numInsertions + numSoftclips + numHardclips &&
        nearPoint(
          r,
          block,
          i,
          xPx,
          Math.max(CLIP_HIT_MIN_TOLERANCE_BP, bpPerPx * CLIP_HIT_TOLERANCE_PX),
        ) &&
        passesFrequencyGate(
          bpPerPx,
          r.interbaseFrequencies[i]!,
          state.filterMismatchesByFrequency,
        )
      )
    },
  }
}

const MARKS: [
  string,
  (scale: number, block: RenderBlock, state: RenderState) => string[],
][] = [
  [
    'deletion',
    (scale, block, state) => sweep(gaps(GAP_DELETION, scale), block, state),
  ],
  ['skip', (scale, block, state) => sweep(gaps(GAP_SKIP, scale), block, state)],
  ['mismatch', (scale, block, state) => sweep(mismatches(scale), block, state)],
  [
    'perBaseQuality',
    (scale, block, state) => sweep(perBaseQuality(scale), block, state),
  ],
  [
    'perBaseLetter',
    (scale, block, state) => sweep(perBaseLetter(scale), block, state),
  ],
  [
    'softclipBases',
    (scale, block, state) => sweep(softclipBases(scale), block, state),
  ],
  [
    'modification',
    (scale, block, state) => sweep(modifications(scale), block, state),
  ],
  ['overlap', (scale, block, state) => sweep(overlaps(scale), block, state)],
  [
    'insertion',
    (scale, block, state) => sweep(insertions(scale), block, state),
  ],
  ['clip', (scale, block, state) => sweep(clips(scale), block, state)],
]

describe.each([
  ['scrolled', scrolled],
  ['compact', compact],
])('%s rows', (_rows, layout) => {
  describe.each([
    ['20 px per bp', 10],
    ['4 px per bp', 50],
    ['a quarter pixel per bp', 800],
  ])('at %s', (_zoom, bpLength) => {
    describe.each([false, true])('reversed %s', reversed => {
      test.each(MARKS)('%s', (_name, run) => {
        expect(
          run(bpLength / 10, blockOf(reversed, bpLength), renderState(layout)),
        ).toEqual([])
      })
    })
  })
})

describe.each([false, true])(
  'a fade at zero paints nothing, and ink and hitNearest still answer (reversed %s)',
  reversed => {
    test.failing(
      'a Phred 0 mismatch under "fade low quality mismatches", which the hover chain asks',
      () => {
        expect(
          sweep(
            mismatchCase([
              [1002, 0, 255, 0],
              [1005, 1, 255, 60],
            ]),
            blockOf(reversed, 10),
            renderState({ mismatchAlpha: true }),
          ),
        ).toEqual([])
      },
    )

    test.failing(
      'an overlap under 1.5px, which nothing in the hover chain asks',
      () => {
        expect(
          sweep(
            overlapCase([
              [1400, 1401, 0],
              [1100, 1200, 1],
            ]),
            blockOf(reversed, 800),
            renderState({}),
          ),
        ).toEqual([])
      },
    )

    test.failing(
      "a deletion under a 255th of a pixel, which the gap step's length floor drops",
      () => {
        expect(
          sweep(
            gapCase(GAP_DELETION, [
              [16000, 16001, 0, GAP_DELETION, 255],
              [20000, 30000, 1, GAP_DELETION, 255],
            ]),
            blockOf(reversed, 60000),
            renderState({}),
          ),
        ).toEqual([])
      },
    )
  },
)
