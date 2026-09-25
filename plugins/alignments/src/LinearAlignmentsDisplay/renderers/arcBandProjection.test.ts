import { clipBlock } from '@jbrowse/render-core/blockClipUtils'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { UNIFORM_OFFSET_F32 } from '../../shaders/slang/arc.iface.generated.ts'
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
 * the clip twice, which is what `blockStartPx` did between 051be51dd0 and this
 * test: every arc, tick, bar and marker of a block panned off the left edge
 * drew that far from where Canvas2D, SVG and the hit test all agreed it went.
 *
 * Only a clipped block shows it, and only on the edge the clip cut — so a view
 * sitting inside one chromosome, where nothing is trimmed, is exactly the case
 * that stays right.
 */

const CANVAS_W = 200
const CANVAS_H = 100
const BAND = { top: 0, height: 20, down: false }

// Panned so the block's start is 300px off the left edge and its end 300px off
// the right: the clip trims both edges and neither is the block's own origin.
function block(reversed: boolean): RenderBlock {
  return {
    displayedRegionIndex: 0,
    start: 1_000_000,
    end: 1_001_000,
    screenStartPx: -300,
    screenEndPx: 500,
    reversed,
  }
}

const SECTION: SectionRender = {
  pileupTopOffset: 0,
  coverageTopOffset: 0,
  covClipTop: 0,
  covClipHeight: 0,
  pileupClipTop: 0,
  pileupClipHeight: 40,
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
 * viewport on the block's clip column — so 0 and `blockWidth` land on the
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

test('the band carries no px origin of its own beyond the two bp slots', () => {
  // The clip's own trim, which is what a block-origin uniform would re-apply.
  // Stated as a number so the case above is known to be a clipped one: with
  // nothing trimmed both projections agree however many origins are added.
  const b = block(false)
  const clip = clipBlock(b, CANVAS_W, CANVAS_H, { x: 1, y: 1 })!
  expect(clip.scissorX - b.screenStartPx).toBe(300)
})
