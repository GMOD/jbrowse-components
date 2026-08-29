import {
  drawSnpSegments,
  packSnpInstances,
  readSnpSegments,
} from '@jbrowse/alignments-core'
import { MockHal } from '@jbrowse/render-core/hal'
import { UNIFORM_OFFSET_F32 } from '@jbrowse/render-core/shaders/coverageSnp'

import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from '../../LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts'
import {
  makeTestPalette,
  makeTestRenderState,
} from '../../LinearAlignmentsDisplay/testUtils.ts'
import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'

import type { AlignmentsSources } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

/**
 * The coverage band's allele-fraction floor. At depth 500 every sequencing
 * error paints a sliver, so without one the bars carry a permanent rainbow —
 * the pileup fades sub-threshold marks through `featureFrequencyThreshold` and
 * the band applied nothing.
 *
 * The rule is per SEGMENT and tests `segHeight`, which IS that allele's share
 * of the position's depth, so the setting needs no conversion. Both backends
 * have to run it: coverageSnp.slang folds the vertex, `drawSnpSegments` skips
 * the fill, and a backend that forgot would differ only in the noise floor of a
 * deep pileup — the hardest kind of divergence to notice.
 */

// One position, four alleles: 30%, 20%, 3% and 2% of its depth. Stacked
// bottom-to-top, so yOffset accumulates and the segments above a skipped one
// keep their own y.
const POSITION = 10_000
const HEIGHTS = [0.3, 0.2, 0.03, 0.02]
const COLOR_TYPES = [1, 2, 3, 4]

function stacked() {
  const yOffsets: number[] = []
  let y = 0
  for (const h of HEIGHTS) {
    yOffsets.push(y)
    y += h
  }
  return packSnpInstances(
    {
      position: HEIGHTS.map(() => POSITION),
      yOffset: yOffsets,
      segHeight: HEIGHTS,
      colorType: COLOR_TYPES,
      relDepth: HEIGHTS.map(() => 1),
    },
    HEIGHTS.length,
  )
}

function drawnColorTypes(minFrequency: number) {
  const calls: string[] = []
  const ctx = {
    fillRect: () => {},
    set fillStyle(v: string) {
      calls.push(v)
    },
  } as unknown as CanvasRenderingContext2D
  drawSnpSegments(
    ctx,
    stacked(),
    d => d,
    1,
    50,
    { baseA: 'A', baseC: 'C', baseG: 'G', baseT: 'T', baseN: 'N' },
    bp => bp - POSITION,
    100,
    minFrequency,
  )
  return calls
}

describe('the coverage band allele-fraction floor on Canvas2D', () => {
  test('0 colors every mismatch, which is the default', () => {
    expect(drawnColorTypes(0)).toEqual(['A', 'C', 'G', 'T'])
  })

  test('a 5% floor drops the two error-rate alleles and keeps the two real ones', () => {
    expect(drawnColorTypes(0.05)).toEqual(['A', 'C'])
  })

  // Strictly below, so a segment exactly at the setting is still colored — the
  // menu reads "Above 20%" and 20% of the depth is what the user asked to see.
  test('a segment exactly at the floor is drawn', () => {
    expect(drawnColorTypes(0.2)).toEqual(['A', 'C'])
    expect(drawnColorTypes(0.21)).toEqual(['A'])
  })

  // The reason skipping is enough and the stack does not have to be rebuilt:
  // the grey depth bar is drawn underneath and is not gated, so a hidden slice
  // reads as reference rather than as a gap.
  test('the surviving segments keep the y they had with the floor off', () => {
    const withFloor = readSnpSegments(stacked()).filter(s => s.height >= 0.05)
    expect(withFloor.map(s => s.yOffset)).toEqual([0, 0.30000001192092896])
  })
})

test('the GPU carries the floor as its own uniform', () => {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  const sources: AlignmentsSources = {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, makePileupDataResult({})]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    readConnectionsLineWidth: 1,
  }
  renderer.upload('sources', sources)
  renderer.renderBlocks(
    [
      {
        displayedRegionIndex: 0,
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: 200,
        reversed: false,
      },
    ],
    makeTestRenderState({
      colors: makeTestPalette(),
      coverageSnpMinFrequency: 0.05,
      // The band has to actually draw for its uniforms to be written at all:
      // they go into their own buffer, staged immediately before the coverage
      // passes and only when the band has a clip band to draw into.
      coverageHeight: 50,
      coverageMaxDepth: 100,
      sections: [
        {
          pileupTopOffset: 50,
          coverageTopOffset: 0,
          covClipTop: 0,
          covClipHeight: 50,
          pileupClipTop: 50,
          pileupClipHeight: 50,
        },
      ],
    }),
  )
  // Off the SNP pass's OWN draw, not the frame's last write: the coverage band
  // draws against render-core's `CoverageBandUniforms` and the pileup's write
  // lands after it, so `getLastUniformsF32` is a different struct entirely.
  const snpDraw = hal.draws().find(d => d.passId === 'snpCov')!
  expect(hal.uniformsOf(snpDraw)![UNIFORM_OFFSET_F32.snpMinFreq]).toBeCloseTo(
    0.05,
  )
})
