import { drawSoftclips } from './drawClipBars.ts'

import type {
  DrawBlock,
  RenderState,
} from '../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Records the fillStyle in effect at each fillRect, so we can read back the
// exact CSS color (and its alpha) the clip bar drew with.
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

// Only the fields drawClipBars reads matter; the rest are inert defaults.
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
      colorSoftclip: [1, 0, 0],
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

function oneSoftclip(frequency: number) {
  return {
    softclipPositions: new Uint32Array([100]),
    softclipYs: new Uint16Array([0]),
    softclipFrequencies: new Uint8Array([frequency]),
  }
}

// bp 100..1100 across 100px => pxPerBp 0.1, so the sub-pixel frequency fade
// branch fires. frequencyAlpha(0.1, freq) = 0.1 + freq * 0.9.
const ZOOMED_OUT: DrawBlock = { start: 100, end: 1100, screenStartPx: 0 }
const ZOOMED_OUT_BP_LENGTH = 1000
// bp 100..110 across 100px => pxPerBp 10, above the fade threshold.
const ZOOMED_IN: DrawBlock = { start: 100, end: 110, screenStartPx: 0 }
const ZOOMED_IN_BP_LENGTH = 10
const BLOCK_WIDTH = 100

function drawOne(
  state: RenderState,
  frequency: number,
  block: DrawBlock = ZOOMED_OUT,
  bpLength: number = ZOOMED_OUT_BP_LENGTH,
) {
  const { ctx, fills } = recordingCtx()
  drawSoftclips(
    ctx,
    oneSoftclip(frequency),
    block,
    bpLength,
    BLOCK_WIDTH,
    state,
  )
  return fills[0]
}

describe('drawClipBars frequency fade', () => {
  test('filtering on, zoomed out: a low-frequency clip fades to pxPerBp', () => {
    expect(drawOne(baseState({ filterMismatchesByFrequency: true }), 0)).toBe(
      'rgba(255,0,0,0.1)',
    )
  })

  test('filtering on, zoomed out: a full-frequency clip stays opaque', () => {
    expect(drawOne(baseState({ filterMismatchesByFrequency: true }), 255)).toBe(
      'rgb(255,0,0)',
    )
  })

  // The "show low frequency mismatches" toggle must reach the clip pass too —
  // clip.slang gated on nothing at all, so clips faded regardless of it.
  test('filtering off: a low-frequency clip stays opaque even zoomed out', () => {
    expect(drawOne(baseState({ filterMismatchesByFrequency: false }), 0)).toBe(
      'rgb(255,0,0)',
    )
  })

  test('zoomed in past 1px/bp: no fade regardless of frequency', () => {
    expect(
      drawOne(
        baseState({ filterMismatchesByFrequency: true }),
        0,
        ZOOMED_IN,
        ZOOMED_IN_BP_LENGTH,
      ),
    ).toBe('rgb(255,0,0)')
  })
})
