import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import {
  UNIFORM_OFFSET_F32 as ARC_UNIFORM_OFFSET_F32,
  UNIFORMS_SIZE_BYTES as ARC_UNIFORMS_SIZE_BYTES,
} from '../../shaders/slang/arc.iface.generated.ts'
import {
  UNIFORM_OFFSET_F32,
  UNIFORM_OFFSET_U32,
  UNIFORMS_SIZE_BYTES,
} from '../../shaders/slang/read.iface.generated.ts'
import { makeTestPalette, makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'
import { ARC_BAND_MARKS } from './arcMarks.ts'

import type { AlignmentsSources, SectionRender } from './rendererTypes.ts'

/**
 * Every uniform write of a frame, not just the last one.
 *
 * The arc band writes `ArcBandUniforms`, its own block, in the middle of a frame
 * whose other passes read the pileup's. It used to write a memcpy of the pileup
 * block with the band-sensitive slots poked on top, which is why the interleave
 * is worth pinning either way: a band write must not reach a later section, and
 * the pileup's frame-constant colour slots — written once ahead of the loop,
 * rather than rebuilt per section per block — must be on every pileup write.
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
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
}

function frameWrites() {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.upload('sources', sources())
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
  return {
    f32: hal.getUniformWritesF32(),
    u32: hal.getUniformWritesU32(),
    draws: hal.draws(),
  }
}

describe('the arc band writes its own uniforms', () => {
  it('costs one pileup write and one band write per section, and no more', () => {
    // All four arc passes read one `ArcBandUniforms` through one writer, so
    // the first mark stages it and the other three draw off it.
    expect(frameWrites().f32).toHaveLength(4)
  })

  it('draws every band pass off the band write of its own section', () => {
    const ids = new Set(ARC_BAND_MARKS.map(m => m.pass.id))
    const reads = frameWrites()
      .draws.filter(d => ids.has(d.passId))
      .map(d => d.uniformWrite)
    expect(reads).toEqual([
      ...ARC_BAND_MARKS.map(() => 1),
      ...ARC_BAND_MARKS.map(() => 3),
    ])
  })

  it('alternates the two blocks, so neither is the other patched', () => {
    // The two structs are different sizes, so the byte length is the cheapest
    // statement that the band is not writing a copy of the pileup's.
    expect(frameWrites().f32.map(w => w.byteLength)).toEqual([
      UNIFORMS_SIZE_BYTES,
      ARC_UNIFORMS_SIZE_BYTES,
      UNIFORMS_SIZE_BYTES,
      ARC_UNIFORMS_SIZE_BYTES,
    ])
  })

  // Writes are [section 0 pileup, section 0 band, section 1 pileup, section 1
  // band]. `covOffset` is the pileup top on a section write and the arc anchor
  // on a band write, so section 1's is what a leaked clobber would corrupt.
  const PILEUP_WRITES = [0, 2]

  it('gives the second section its own pileup offset, not the arc band anchor', () => {
    const { f32 } = frameWrites()
    expect(f32[PILEUP_WRITES[1]!]![UNIFORM_OFFSET_F32.covOffset]).toBe(50)
  })

  it('places the arc anchor on the band write of each section', () => {
    const { f32 } = frameWrites()
    // Up mode anchors at the band bottom: section 0's band is [0, 20] and
    // section 1's is [40, 20].
    expect(f32[1]![ARC_UNIFORM_OFFSET_F32.covOffset]).toBe(20)
    expect(f32[3]![ARC_UNIFORM_OFFSET_F32.covOffset]).toBe(60)
    expect(f32[1]![ARC_UNIFORM_OFFSET_F32.arcBandH]).toBe(20)
  })

  it('carries the palette on every pileup write', () => {
    const { u32 } = frameWrites()
    for (const i of PILEUP_WRITES) {
      expect({ write: i, colorBaseA: u32[i]![UNIFORM_OFFSET_U32.colorBaseA] }) //
        .toEqual({ write: i, colorBaseA: PACKED_BASE_A })
    }
  })
})
