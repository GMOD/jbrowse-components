import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import * as glsl from '../../shaders/slang/arc.glsl.generated.ts'
import { UNIFORM_OFFSET_F32 } from '../../shaders/slang/arc.iface.generated.ts'
import * as wgsl from '../../shaders/slang/arc.wgsl.generated.ts'
import { makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsSources, SectionRender } from './rendererTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * Where the arc band puts a genomic position, against where its Canvas2D twin
 * puts it — on a block the viewport clipped.
 *
 * The band's uniforms carry a bp origin (`bpHi`/`bpLo`) and a px scale
 * (`bpLen`/`blockWidth`), and the origin is the CLIPPED start, which is the bp
 * at the scissor's left edge. A block-origin px offset on top of that applies
 * the clip twice, which is what `blockStartPx` did between 051be51dd0 and
 * 29dbd7a85a.
 *
 * The size of that is worth stating, because the commit overstated it. A
 * render block's `screenStartPx` is `max(windowLeftPx, regionLeftPx) -
 * offsetPx` and so never negative, and `scissorX` is its floor — so the
 * doubled term was `frac(screenStartPx)`, under one CSS px. Every mark in the
 * band, on every block whose screen start is not a whole pixel, which is most
 * frames of a pan, and the other way round on a reversed block.
 */

// `view.width` 800 with the 2px track outline on, which is what every display
// passes as the canvas width.
const CANVAS_W = 798
const CANVAS_H = 100
const BAND = { top: 0, height: 20, down: false }

/**
 * The rightmost block of a panned view: it starts on a fractional pixel and
 * ends at the viewport's edge, past the track canvas inside it.
 *
 * Both are at their reachable limits. `visibleRegions` clamps a block to the
 * viewport, so `screenEndPx` cannot exceed `view.width` and the right trim
 * cannot exceed the 2px the track outline takes; the left trim is
 * `frac(screenStartPx)`, since `screenStartPx` is never negative. Unequal is
 * what matters: `clipBlock` pulls the LOW bp in by the right trim on a
 * reversed block and by the left trim on a forward one, so a fixture whose two
 * trims match passes either way.
 */
function block(reversed: boolean): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 1_000_000,
    end: 1_001_000,
    screenStartPx: 100.5,
    screenEndPx: 800,
    reversed,
  }
}

const SECTION: SectionRender = {
  pileupTopOffset: 0,
  coverageTopOffset: 0,
  covClipTop: 0,
  covClipHeight: 0,
  pileupClipTop: 0,
  // No pileup ink, so the band's write is the frame's last one.
  pileupClipHeight: 0,
  arcBand: BAND,
}

function sources(): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, makePileupDataResult({})]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
}

// The uniform block the arc band wrote this frame. The pileup's is the other
// one, and the two are different sizes.
function bandUniforms(b: RenderBlock) {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.upload('sources', sources())
  renderer.renderBlocks(
    [b],
    makeTestRenderState({
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      sections: [SECTION],
    }),
  )
  const writes = hal.getUniformWritesF32()
  return writes.at(-1)!
}

/**
 * The shader half of the contract, in CSS px. `arcBandX` scales the bp offset
 * from the uniform origin by the block's px width; `arcBandClipPos` normalizes
 * that over `canvasW` and flips a reversed block, and `drawMarks` puts the
 * viewport on the block's clip column — so 0 and `scissorW` land on the
 * scissor's two edges, near end first.
 */
function arcBandScreenX(
  bp: number,
  u: Float32Array,
  clip: BlockClipResult,
  reversed: boolean,
) {
  const origin = u[UNIFORM_OFFSET_F32.bpHi]! + u[UNIFORM_OFFSET_F32.bpLo]!
  const bandPx =
    ((bp - origin) / u[UNIFORM_OFFSET_F32.bpLen]!) *
    u[UNIFORM_OFFSET_F32.blockWidth]!
  return clip.scissorX + (reversed ? clip.scissorW - bandPx : bandPx)
}

test.each([false, true])(
  'the arc band and makeBpMapper place a bp on the same column (reversed=%s)',
  reversed => {
    const b = block(reversed)
    const clip = clipBlock(b, CANVAS_W, CANVAS_H, { x: 1, y: 1 })!
    const u = bandUniforms(b)
    const toX = makeBpMapper(b)
    // Inside the block and outside it both: an arc's foot is extrapolated well
    // past the block when its mate is in another region, and the projection has
    // to hold out there too.
    for (const bp of [999_000, 1_000_000, 1_000_375, 1_000_625, 1_002_000]) {
      expect(arcBandScreenX(bp, u, clip, reversed)).toBeCloseTo(toX(bp), 4)
    }
  },
)

test('the fixture really is clipped, unequally, on both edges', () => {
  // Stated as numbers so the table above is known to be measuring something:
  // with nothing trimmed the two projections agree however many origins are
  // added, and with the two trims equal the reversed pivot is invisible.
  const b = block(false)
  const clip = clipBlock(b, CANVAS_W, CANVAS_H, { x: 1, y: 1 })!
  expect(clip.scissorX - b.screenStartPx).toBe(-0.5)
  expect(b.screenEndPx - (clip.scissorX + clip.scissorW)).toBe(2)
})

// The table above reads the uniforms the band wrote; this one pins that the
// shader spends them the way it models. Without it, reinstating `blockStartPx`
// in `arcBandUniforms.slang` and adding it back to `arcBandX` — the whole of
// the bug — leaves every assertion above green, because the uniform values do
// not change.
test.each([
  ['wgsl', wgsl.WGSL_SOURCE],
  ['glsl', glsl.GLSL_VERTEX],
])(
  '%s projects a bp from the scissor edge, with no block origin',
  (_n, src) => {
    expect(src).toMatch(
      /fn arcBandX_0[^}]*return arcBpToLinear_0\(\w+\) \* u_0\.blockWidth_0;|float arcBandX_0[^}]*return arcBpToLinear_0\(\w+\) \* u_0\.blockWidth_0;/,
    )
    expect(src).not.toContain('blockStartPx')
  },
)
