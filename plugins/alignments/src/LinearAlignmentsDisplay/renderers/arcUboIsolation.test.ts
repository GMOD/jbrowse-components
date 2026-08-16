import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import {
  UNIFORM_OFFSET_F32,
  UNIFORM_OFFSET_U32,
} from '../../shaders/slang/read.iface.generated.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsSources, SectionRender } from './rendererTypes.ts'

/**
 * Every uniform write of a frame, not just the last one.
 *
 * The arc band reads the shared UBO but places Y against the band rather than
 * the pileup, so a few slots have to differ for its four passes and go back for
 * everything after. That used to be a clobber of the live buffer bracketed by
 * two full-buffer memcpys and two HAL writes — and the restoring write was
 * consumed by nothing, since the next section writes its own uniforms before
 * anything draws. The band now fills a buffer of its own instead.
 *
 * Two things have to hold, and the frame's final state shows neither: the arc
 * uniforms must not reach a later section, and the frame-constant colour slots
 * — written once ahead of the loop now, rather than rebuilt per section per
 * block — must be on every write.
 */

const BLOCK = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 200,
  reversed: false,
}

const COLORS = makeTestPalette({ colorBaseA: [0.25, 0.5, 0.75] })
const PACKED_BASE_A = normalizedRgbToABGR(0.25, 0.5, 0.75)

// Two stacked sections, each with a pileup band at its own offset and an arc
// band of its own — the shape that makes the interleave observable.
function section(pileupTop: number, arcTop: number): SectionRender {
  return {
    pileupTopOffset: pileupTop,
    coverageTopOffset: 0,
    covClipTop: 0,
    covClipHeight: 0,
    pileupClipTop: pileupTop,
    pileupClipHeight: 40,
    arcBand: { top: arcTop, height: 20, down: false },
  }
}

const SECTIONS = [section(0, 0), section(50, 40)]

function sources(): AlignmentsSources {
  const region = () =>
    new Map([[0, makePileupDataResult({})]]) as ReadonlyMap<
      number,
      ReturnType<typeof makePileupDataResult>
    >
  return {
    sections: SECTIONS.map(() => ({
      groupKey: '',
      laidOutPileupMap: region(),
      arcsRpcDataMap: new Map(),
    })),
    readConnectionsLineWidth: 1,
  }
}

function frameWrites() {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.sync(sources())
  renderer.renderBlocks(
    [BLOCK],
    makeTestRenderState({
      colors: COLORS,
      canvasHeight: 100,
      sections: SECTIONS,
      pileupTopOffset: 0,
      readConnections: 'arc',
      readConnectionsHeight: 20,
    }),
  )
  return { f32: hal.getUniformWritesF32(), u32: hal.getUniformWritesU32() }
}

describe('the arc band writes its own uniforms', () => {
  it('costs one write per section plus one per arc band, and no more', () => {
    // Two sections, each a pileup write then an arc write. A third per section
    // is the restoring write that nothing drew with.
    expect(frameWrites().f32).toHaveLength(4)
  })

  it('gives the second section its own pileup offset, not the arc band anchor', () => {
    const { f32 } = frameWrites()
    // Writes are [section 0 pileup, section 0 arcs, section 1 pileup, ...].
    // `covOffset` is the pileup top for a section write and the arc anchor for
    // an arc write, so section 1's is what a leaked clobber would corrupt.
    expect(f32[2]![UNIFORM_OFFSET_F32.covOffset]).toBe(50)
  })

  it('places the arc anchor only on the arc writes', () => {
    const { f32 } = frameWrites()
    // Up mode anchors at the band bottom: section 0's band is [0, 20].
    expect(f32[1]![UNIFORM_OFFSET_F32.covOffset]).toBe(20)
    expect(f32[1]![UNIFORM_OFFSET_F32.arcBandH]).toBe(20)
    // A section write never carries a band height.
    expect(f32[0]![UNIFORM_OFFSET_F32.arcBandH]).toBe(0)
  })

  it('carries the palette on every write, including the arc ones', () => {
    const { u32 } = frameWrites()
    for (const [i, write] of u32.entries()) {
      expect({ write: i, colorBaseA: write[UNIFORM_OFFSET_U32.colorBaseA] }) //
        .toEqual({ write: i, colorBaseA: PACKED_BASE_A })
    }
  })
})
