import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_SHAPE_ARC } from '../../features/arcs/shapes.ts'
import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import {
  ALIGNMENTS_PASSES,
  ARC_PASSES,
  GPU_COVERAGE_PASS,
  GPU_PILEUP_PASS,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { AlignmentsSources } from './rendererTypes.ts'

/**
 * The upload memo's narrow paths, from the arc band's side.
 *
 * `arcsByGroup` allocates a fresh feed for every arc-tier setting — the
 * `minInterchromSupport` slider is a new object per drag frame — and
 * `readConnectionsLineWidth` is a second such control. Both reach `syncRegion`
 * with the identical laid-out pileup, so anything that repacks the eighteen
 * pileup and coverage passes for them is repacking the whole region for a
 * change confined to the band.
 *
 * The other half is the invariant the wide path exists for: a band switched off
 * must not leave its buffers behind. The narrow path has no whole-region wipe to
 * release them with, so it uploads the empty feed and relies on `uploadBuffer`
 * releasing the prior buffer before it reads the count.
 */

const START = 10_000

const ARC_PASS_IDS = ARC_PASSES.map(pass => pass.id)

function oneArc(x2: number): ArcsUploadData {
  return {
    ...emptyArcsUploadData(),
    arcX1: new Uint32Array([START + 10]),
    arcX2: new Uint32Array([x2]),
    arcColorTypes: new Uint8Array([0]),
    arcShapeTypes: new Uint8Array([ARC_SHAPE_ARC]),
    arcYBp: new Uint32Array([50]),
    arcSpanBp: new Uint32Array([50]),
    arcSupport: new Uint32Array([1]),
    numArcs: 1,
  }
}

function onePileup() {
  return makePileupDataResult({
    readKeys: ['r1'],
    readPositions: new Uint32Array([START, START + 100]),
    readYs: new Uint16Array([0]),
    readTagColors: new Uint32Array([0xff0000ff]),
    readColorCategories: new Uint8Array([0]),
  })
}

function sources(
  data: PileupDataResult | undefined,
  arcs: ArcsUploadData | undefined,
  readConnectionsLineWidth: number,
): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: data ? new Map([[0, data]]) : new Map(),
        arcsRpcDataMap: arcs ? new Map([[0, arcs]]) : new Map(),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth,
  }
}

// A renderer that has already uploaded the region once, plus a fresh call log —
// every assertion below is about what the SECOND upload costs.
function primed(data: PileupDataResult, arcs: ArcsUploadData) {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.upload('sources', sources(data, arcs, 1))
  hal.calls = []
  return { hal, renderer }
}

function uploadedPasses(hal: MockHal) {
  return hal.callsOf('uploadBuffer').map(c => c.args[1])
}

describe('an arc-only change uploads only the arc passes', () => {
  it('re-uploads the band and nothing else for a new arcs object', () => {
    const data = onePileup()
    const { hal, renderer } = primed(data, oneArc(START + 60))
    renderer.upload('sources', sources(data, oneArc(START + 80), 1))
    expect(uploadedPasses(hal)).toEqual(ARC_PASS_IDS)
    expect(hal.callsOf('deleteRegion')).toHaveLength(0)
  })

  it('re-uploads the band and nothing else for a new line width', () => {
    const data = onePileup()
    const arcs = oneArc(START + 60)
    const { hal, renderer } = primed(data, arcs)
    renderer.upload('sources', sources(data, arcs, 4))
    expect(uploadedPasses(hal)).toEqual(ARC_PASS_IDS)
    expect(hal.callsOf('deleteRegion')).toHaveLength(0)
  })

  it('skips the band entirely when neither moved', () => {
    const data = onePileup()
    const arcs = oneArc(START + 60)
    const { hal, renderer } = primed(data, arcs)
    renderer.upload('sources', sources(data, arcs, 1))
    expect(uploadedPasses(hal)).toEqual([])
  })

  it('takes both narrow paths when a recolor and an arc change land together', () => {
    const data = onePileup()
    const { hal, renderer } = primed(data, oneArc(START + 60))
    renderer.upload(
      'sources',
      sources(
        { ...data, readTagColors: new Uint32Array([0xff00ff00]) },
        oneArc(START + 80),
        1,
      ),
    )
    expect(uploadedPasses(hal)).toEqual([
      GPU_PILEUP_PASS.read.id,
      ...ARC_PASS_IDS,
    ])
    expect(hal.callsOf('deleteRegion')).toHaveLength(0)
  })
})

describe('a band switched off leaves nothing drawable', () => {
  it('drops every arc buffer while the pileup keeps its own', () => {
    const data = onePileup()
    const { hal, renderer } = primed(data, oneArc(START + 60))
    renderer.upload('sources', sources(data, undefined, 1))
    for (const passId of ARC_PASS_IDS) {
      expect({ passId, count: hal.getBufferCount(0, passId) }).toEqual({
        passId,
        count: 0,
      })
    }
    expect(hal.getBufferCount(0, GPU_PILEUP_PASS.read.id)).toBe(1)
  })
})

describe('a new layout run still rebuilds the whole region', () => {
  it('wipes and re-uploads every pass', () => {
    const arcs = oneArc(START + 60)
    const { hal, renderer } = primed(onePileup(), arcs)
    renderer.upload('sources', sources(onePileup(), arcs, 1))
    expect(hal.callsOf('deleteRegion')).toHaveLength(1)
    expect(new Set(uploadedPasses(hal))).toEqual(
      new Set([
        ...Object.values(GPU_PILEUP_PASS).map(pass => pass.id),
        ...Object.values(GPU_COVERAGE_PASS).map(pass => pass.id),
        ...ARC_PASS_IDS,
      ]),
    )
  })
})
