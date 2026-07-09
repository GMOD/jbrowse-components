import { drawMismatches } from './drawCanvas.ts'

import type { MismatchUploadData } from './types.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Records the fillStyle in effect at each fillRect, so we can read back the
// exact CSS color (and its alpha) the mismatch drew with.
function recordingCtx() {
  const fills: string[] = []
  let currentFill = ''
  const ctx = {
    set fillStyle(v: string) {
      currentFill = v
    },
    get fillStyle() {
      return currentFill
    },
    fillRect() {
      fills.push(currentFill)
    },
  } as unknown as Ctx2D
  return { ctx, fills }
}

// Full RenderState with a red 'A' base color. Only the fields drawMismatches
// reads matter; the rest are inert defaults. colors is populated just enough for
// buildBaseColorTupleMap (base A + the muted-modifications color).
function baseState(overrides: Partial<RenderState> = {}): RenderState {
  return {
    scrollTop: 0,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 0,
    showCoverage: false,
    coverageHeight: 0,
    coverageYOffset: 0,
    coverageMaxDepth: undefined,
    coverageIsLog: false,
    showMismatches: true,
    filterMismatchesByFrequency: false,
    mismatchAlpha: false,
    showSoftClipping: false,
    showInterbaseIndicators: false,
    showModifications: false,
    showPerBaseQuality: false,
    showPerBaseLetter: false,
    canvasWidth: 100,
    canvasHeight: 100,
    selectedChainIds: [],
    colors: {
      colorBaseA: [1, 0, 0],
      colorMutedSnpBase: [0.5, 0.5, 0.5],
    } as RenderState['colors'],
    linkedReads: 'off',
    showLinkedReadLines: false,
    flipStrandLongReadChains: false,
    colorSupplementaryChains: false,
    readConnectionsLineWidth: 1,
    readConnections: 'off',
    readConnectionsDown: false,
    readConnectionsHeight: 0,
    pileupTopOffset: 0,
    coverageTopOffset: 0,
    sections: [],
    showOutline: false,
    ...overrides,
  }
}

// One 'A' mismatch (base 65) at bp 100, full frequency, with the given quality.
function oneMismatch(qual: number): MismatchUploadData {
  return {
    mismatchPositions: new Uint32Array([100]),
    mismatchYs: new Uint16Array([0]),
    mismatchBases: new Uint8Array([65]),
    mismatchFrequencies: new Uint8Array([255]),
    mismatchQuals: new Uint8Array([qual]),
  }
}

// bp 100..110 across 100px => pxPerBp 10, so the frequency-fade branch (pxPerBp
// < 1) never fires and only the quality fade is under test.
const BLOCK: DrawBlock = { start: 100, end: 110, screenStartPx: 0 }
const BP_LENGTH = 10
const BLOCK_WIDTH = 100

function drawOne(state: RenderState, qual: number) {
  const { ctx, fills } = recordingCtx()
  drawMismatches(ctx, oneMismatch(qual), BLOCK, BP_LENGTH, BLOCK_WIDTH, state)
  return fills[0]
}

describe('drawMismatches quality fade', () => {
  test('mismatchAlpha off: base is fully opaque regardless of quality', () => {
    expect(drawOne(baseState({ mismatchAlpha: false }), 10)).toBe(
      'rgb(255,0,0)',
    )
  })

  test('mismatchAlpha on: low quality fades toward transparent (qual/50)', () => {
    // Phred 25 => alpha 0.5
    expect(drawOne(baseState({ mismatchAlpha: true }), 25)).toBe(
      'rgba(255,0,0,0.5)',
    )
  })

  test('mismatchAlpha on: Phred 50+ stays fully opaque', () => {
    expect(drawOne(baseState({ mismatchAlpha: true }), 60)).toBe('rgb(255,0,0)')
  })

  test('mismatchAlpha on: quality 0 (no recorded quality) stays opaque', () => {
    expect(drawOne(baseState({ mismatchAlpha: true }), 0)).toBe('rgb(255,0,0)')
  })
})
