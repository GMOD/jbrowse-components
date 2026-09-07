import { packCoverageBinsForGpu } from '@jbrowse/alignments-core'
import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { makeTestRenderState } from '../testUtils.ts'
import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'
import { ALIGNMENTS_COVERAGE_MARKS } from './coverageMarks.ts'
import { sectionRegionKey } from './rendererTypes.ts'

import type { AlignmentsSources } from './rendererTypes.ts'

// Each stacked section uploads its coverage passes under its own
// `sectionRegionKey`, and the draw has to read the same key back. The shared
// coverage marks used to draw off `block.displayedRegionIndex`, which is section
// 0's key, so every grouped lane painted the first lane's depth bars over its
// own reads.

const START = 10_000
const COVERAGE_PASS_IDS = new Set(ALIGNMENTS_COVERAGE_MARKS.map(m => m.pass.id))

function laneWithCoverage(depth: number) {
  const depths = new Float32Array([depth])
  return makePileupDataResult({
    readKeys: ['r1'],
    readPositions: new Uint32Array([START, START + 100]),
    readYs: new Uint16Array([0]),
    coverageDepths: depths,
    coverageStartPos: START,
    coverageMaxDepth: depth,
    coverageGpuBinCount: 1,
    coveragePackedBuffer: packCoverageBinsForGpu(depths, depth, START, 1),
  })
}

const BLOCK = {
  displayedRegionIndex: 0,
  start: START,
  end: START + 100,
  screenStartPx: 0,
  screenEndPx: 200,
  reversed: false,
}

function twoSections(): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: 'split',
        laidOutPileupMap: new Map([[0, laneWithCoverage(24)]]),
        arcsRpcDataMap: new Map(),
      },
      {
        groupKey: 'unsplit',
        laidOutPileupMap: new Map([[0, laneWithCoverage(8)]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
}

function section(top: number) {
  return {
    pileupTopOffset: top + 50,
    coverageTopOffset: top,
    covClipTop: top,
    covClipHeight: 50,
    pileupClipTop: top + 50,
    pileupClipHeight: 50,
  }
}

test('each stacked section draws its coverage off its own region key', () => {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.upload('sources', twoSections())
  renderer.renderBlocks(
    [BLOCK],
    makeTestRenderState({
      canvasHeight: 200,
      coverageHeight: 50,
      coverageMinDepth: 0,
      coverageMaxDepth: 24,
      sections: [section(0), section(100)],
    }),
  )
  const coverageKeys = hal
    .callsOf('drawPass')
    .filter(c => COVERAGE_PASS_IDS.has(String(c.args[0])))
    .map(c => c.args[1])
  expect(coverageKeys).toContain(sectionRegionKey(0, 0))
  expect(coverageKeys).toContain(sectionRegionKey(1, 0))
  expect(new Set(coverageKeys).size).toBe(2)
})
