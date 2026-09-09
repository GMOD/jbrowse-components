import { MISMATCH_MARK } from '../../features/mismatch/mark.ts'
import { MODIFICATION_MARK } from '../../features/modification/mark.ts'
import { PER_BASE_LETTER_MARK } from '../../features/perBaseLetter/mark.ts'
import { PER_BASE_QUALITY_MARK } from '../../features/perBaseQuality/mark.ts'
import { SOFTCLIP_BASES_MARK } from '../../features/softclipBases/mark.ts'
import { makeTestRenderState } from '../testUtils.ts'

import type { PileupMark } from './pileupMarks.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The five marks that fill one rect per base. They are one `cell` pivot in
// `pileupShape` now, so what this pins is that each of the five DECLARES it —
// a mark rebuilt on `span` would resolve two edges and land a base off on a
// reversed block — and which of them take the seam fudge. Testing them one at a
// time is what let the reversed-block bug live in every one of them.
//
// Spans (read, gap, overlap) and boundary marks (insertion, clip bars) are
// deliberately absent: both are orientation-safe by construction.

const START = 1000
const END = 1010
const BP_LENGTH = END - START
const BLOCK_WIDTH = 200
// 20 px/bp, so a one-base error is 20px — far past any rounding tolerance.
const PX_PER_BP = BLOCK_WIDTH / BP_LENGTH
const TEST_BP = 1005
// Forward: bp 1005 is 5bp from the low edge => [100,120].
const FORWARD_LEFT = 100
// Reversed: bp runs leftward, so bp 1005 spans [80,100] — its left edge is
// bpToScreenX(1006), NOT bpToScreenX(1005) (which is 100, the right edge).
const REVERSED_LEFT = 80

function recordingCtx() {
  const rects: { x: number; w: number }[] = []
  return {
    rects,
    ctx: {
      set fillStyle(_v: string) {},
      get fillStyle() {
        return ''
      },
      fillRect(x: number, _y: number, w: number) {
        rects.push({ x, w })
      },
    } as unknown as Ctx2D,
  }
}

const STATE = makeTestRenderState({
  showMismatches: true,
  showModifications: true,
  showPerBaseQuality: true,
  showPerBaseLetter: true,
  showSoftClipping: true,
  canvasWidth: BLOCK_WIDTH,
  canvasHeight: 500,
})

// One mark of each kind, at TEST_BP on row 0. `contiguous` is the shape's own
// setting: base walls take the half-pixel seam fudge, sparse marks don't.
const MARKS: {
  name: string
  mark: PileupMark
  region: unknown
  contiguous: boolean
}[] = [
  {
    name: 'mismatch',
    mark: MISMATCH_MARK,
    contiguous: false,
    region: {
      mismatchPositions: new Uint32Array([TEST_BP]),
      mismatchYs: new Uint16Array([0]),
      mismatchBases: new Uint8Array([65]),
      mismatchFrequencies: new Uint8Array([255]),
      mismatchQuals: new Uint8Array([0]),
    },
  },
  {
    name: 'modification',
    mark: MODIFICATION_MARK,
    contiguous: false,
    region: {
      modificationPositions: new Uint32Array([TEST_BP]),
      modificationYs: new Uint16Array([0]),
      modificationColors: new Uint32Array([0xff0000ff]),
    },
  },
  {
    name: 'perBaseQuality',
    mark: PER_BASE_QUALITY_MARK,
    contiguous: true,
    region: {
      perBaseQualPositions: new Uint32Array([TEST_BP]),
      perBaseQualYs: new Uint16Array([0]),
      perBaseQualScores: new Uint8Array([30]),
    },
  },
  {
    name: 'perBaseLetter',
    mark: PER_BASE_LETTER_MARK,
    contiguous: true,
    region: {
      perBaseLetterPositions: new Uint32Array([TEST_BP]),
      perBaseLetterYs: new Uint16Array([0]),
      perBaseLetterBases: new Uint8Array([65]),
    },
  },
  {
    name: 'softclipBases',
    mark: SOFTCLIP_BASES_MARK,
    contiguous: true,
    region: {
      softclipBasePositions: new Uint32Array([TEST_BP]),
      softclipBaseYs: new Uint16Array([0]),
      softclipBaseBases: new Uint8Array([65]),
    },
  },
]

function cellFor(p: (typeof MARKS)[number], reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  const block: RenderBlock = {
    displayedRegionIndex: 0,
    start: START,
    end: END,
    screenStartPx: 0,
    screenEndPx: BLOCK_WIDTH,
    reversed,
  }
  p.mark.paintBlock(ctx, p.region as never, block, STATE)
  expect(rects).toHaveLength(1)
  return rects[0]!
}

describe.each(MARKS)('$name cell geometry', p => {
  test('forward block: cell covers its own base', () => {
    expect(cellFor(p, false).x).toBeCloseTo(FORWARD_LEFT)
  })

  test('reversed block: cell covers its own base, not the neighbor', () => {
    expect(cellFor(p, true).x).toBeCloseTo(REVERSED_LEFT)
  })

  test('width spans one base (plus the seam fudge for base walls)', () => {
    const expected = PX_PER_BP + (p.contiguous ? 0.5 : 0)
    expect(cellFor(p, false).w).toBeCloseTo(expected)
    expect(cellFor(p, true).w).toBeCloseTo(expected)
  })
})

describe('all 1bp-cell marks agree', () => {
  test.each([false, true])('same left edge for one bp (reversed=%s)', rev => {
    const xs = MARKS.map(p => cellFor(p, rev).x)
    for (const x of xs) {
      expect(x).toBeCloseTo(xs[0]!)
    }
  })
})
