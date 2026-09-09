import {
  makeTestPalette,
  makeTestRenderState,
} from '../../LinearAlignmentsDisplay/testUtils.ts'
import { INTERBASE_SOFTCLIP } from '../../shared/types.ts'
import { CLIP_MARK } from './mark.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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

function baseState(overrides: Partial<RenderState> = {}): RenderState {
  return makeTestRenderState({
    featureSpacing: 0,
    canvasWidth: 100,
    colors: makeTestPalette({ colorSoftclip: [1, 0, 0] }),
    ...overrides,
  })
}

// The merged interbase array with one entry, in the softclip slice: the worker
// lays it out as (insertions, softclips, hardclips) and the clip mark reads
// the counts to find its own slice.
function oneSoftclip(frequency: number): InterbaseUploadData {
  return {
    interbasePositions: new Uint32Array([100]),
    interbaseYs: new Uint16Array([0]),
    interbaseLengths: new Uint32Array([5]),
    interbaseFrequencies: new Uint8Array([frequency]),
    interbaseTypes: new Uint8Array([INTERBASE_SOFTCLIP]),
    numInsertions: 0,
    numSoftclips: 1,
    numHardclips: 0,
  }
}

// bp 100..1100 across 100px => pxPerBp 0.1, so the sub-pixel frequency fade
// branch fires. frequencyAlpha(0.1, freq) = 0.1 + freq * 0.9.
const ZOOMED_OUT: RenderBlock = {
  displayedRegionIndex: 0,
  start: 100,
  end: 1100,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}
// bp 100..110 across 100px => pxPerBp 10, above the fade threshold.
const ZOOMED_IN: RenderBlock = { ...ZOOMED_OUT, end: 110 }

function drawOne(
  state: RenderState,
  frequency: number,
  block: RenderBlock = ZOOMED_OUT,
) {
  const { ctx, fills } = recordingCtx()
  CLIP_MARK.paintBlock(ctx, oneSoftclip(frequency), block, state)
  return fills[0]
}

describe('clip bar frequency fade', () => {
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
      drawOne(baseState({ filterMismatchesByFrequency: true }), 0, ZOOMED_IN),
    ).toBe('rgb(255,0,0)')
  })
})
