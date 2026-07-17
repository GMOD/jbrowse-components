import { drawMismatches } from '../../features/mismatch/drawCanvas.ts'
import { drawModifications } from '../../features/modification/drawCanvas.ts'
import { drawPerBaseLetter } from '../../features/perBaseLetter/drawCanvas.ts'
import { drawPerBaseQuality } from '../../features/perBaseQuality/drawCanvas.ts'
import { drawSoftclipBases } from '../../features/softclip/drawBases.ts'

import type { DrawBlock, RenderState } from './rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// The five Canvas2D painters that fill one rect per base. They share a single
// geometry rule via makePileupCellMapper; this file pins all five to it at once.
// Testing them one at a time is what let the reversed-block bug live in every
// one of them — each looked locally reasonable, and no test compared them.
//
// Layers whose marks are NOT 1bp cells are deliberately absent: spans (read,
// gap, overlap) resolve two edges, and boundary marks (insertion, clip bars)
// center on a bp edge. Both are orientation-safe by construction.

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
      fillText() {},
      measureText: () => ({ width: 0 }),
      save() {},
      restore() {},
      font: '',
      textAlign: '' as CanvasTextAlign,
      textBaseline: '' as CanvasTextBaseline,
    } as unknown as Ctx2D,
  }
}

const rgb = (r: number, g: number, b: number): [number, number, number] => [
  r,
  g,
  b,
]

function state(): RenderState {
  return {
    featureHeight: 10,
    featureSpacing: 1,
    pileupTopOffset: 0,
    scrollTop: 0,
    canvasWidth: BLOCK_WIDTH,
    canvasHeight: 500,
    colorScheme: 0,
    showModifications: false,
    mismatchAlpha: false,
    filterMismatchesByFrequency: false,
    colors: {
      colorBaseA: rgb(0, 1, 0),
      colorBaseC: rgb(0, 0, 1),
      colorBaseG: rgb(1, 0.65, 0),
      colorBaseT: rgb(1, 0, 0),
      colorBaseN: rgb(0.4, 0.3, 0.2),
      colorMutedSnpBase: rgb(0.5, 0.5, 0.5),
    },
  } as unknown as RenderState
}

type Painter = (
  ctx: Ctx2D,
  region: never,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) => void

// One mark of each kind, at TEST_BP on row 0. `contiguous` mirrors the painter's
// makePileupCellMapper argument: base walls take the half-pixel seam fudge,
// sparse marks don't.
const PAINTERS: {
  name: string
  draw: Painter
  region: unknown
  contiguous: boolean
}[] = [
  {
    name: 'mismatch',
    draw: drawMismatches,
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
    draw: drawModifications,
    contiguous: false,
    region: {
      modificationPositions: new Uint32Array([TEST_BP]),
      modificationYs: new Uint16Array([0]),
      modificationColors: new Uint32Array([0xff0000ff]),
    },
  },
  {
    name: 'perBaseQuality',
    draw: drawPerBaseQuality,
    contiguous: true,
    region: {
      perBaseQualPositions: new Uint32Array([TEST_BP]),
      perBaseQualYs: new Uint16Array([0]),
      perBaseQualScores: new Uint8Array([30]),
    },
  },
  {
    name: 'perBaseLetter',
    draw: drawPerBaseLetter,
    contiguous: true,
    region: {
      perBaseLetterPositions: new Uint32Array([TEST_BP]),
      perBaseLetterYs: new Uint16Array([0]),
      perBaseLetterBases: new Uint8Array([65]),
    },
  },
  {
    name: 'softclipBases',
    draw: drawSoftclipBases,
    contiguous: true,
    region: {
      softclipBasePositions: new Uint32Array([TEST_BP]),
      softclipBaseYs: new Uint16Array([0]),
      softclipBaseBases: new Uint8Array([65]),
    },
  },
]

function cellFor(p: (typeof PAINTERS)[number], reversed: boolean) {
  const { ctx, rects } = recordingCtx()
  p.draw(
    ctx,
    p.region as never,
    { start: START, end: END, screenStartPx: 0, reversed },
    BP_LENGTH,
    BLOCK_WIDTH,
    state(),
  )
  expect(rects).toHaveLength(1)
  return rects[0]!
}

describe.each(PAINTERS)('$name cell geometry', p => {
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

// The point of the shared mapper: one bp resolves to one x, whatever the layer.
// A painter that re-derives geometry locally drifts from the rest here even if
// its own suite still passes.
describe('all 1bp-cell painters agree', () => {
  test.each([false, true])('same left edge for one bp (reversed=%s)', rev => {
    const xs = PAINTERS.map(p => cellFor(p, rev).x)
    for (const x of xs) {
      expect(x).toBeCloseTo(xs[0]!)
    }
  })
})
