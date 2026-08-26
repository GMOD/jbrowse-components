import { packCoverageBinsForGpu } from '@jbrowse/alignments-core'

import {
  makePileupDataResult,
  packedIndicators,
  packedInterbaseSegments,
} from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { makeTestRenderState } from '../testUtils.ts'
import { drawAlignmentsToCtx } from './Canvas2DAlignmentsRenderer.ts'

import type { AlignmentsSources, RenderState } from './rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * Interbase marks live in the coverage band, so `showInterbaseIndicators` can
 * only change the picture while `showCoverage` is on — the conjunction
 * `COVERAGE_LAYERS` states per layer and `drawAlignmentBlocks` states once, for
 * the band as a whole.
 *
 * The track menu greys the toggle out on the strength of that (menus/reads.ts),
 * which is a claim about the RENDERER, not about the menu: move the triangles
 * out of the band and the greyed row becomes a lie that nothing else would
 * catch. So the assertion is an A/B through the real draw path rather than a
 * read of the two gates — flip the toggle with the band off and require the ink
 * to be byte-identical, and flip it with the band on and require that it isn't,
 * or the first half passes for a fixture that draws no interbase marks at all.
 *
 * `drawAlignmentsToCtx` because on-screen and SVG export share it: gating one
 * band inside one backend would leave the other answering differently.
 */
const REGION_START = 10_000

// Records what was painted, not how much: an A/B that counted ink would pass a
// change that moved the triangles rather than dropping them.
function inkRecordingCtx() {
  const ink: string[] = []
  const ctx = {
    fillRect: (x: number, y: number, w: number, h: number) => {
      ink.push(`rect ${x} ${y} ${w} ${h}`)
    },
    fill: () => {
      ink.push('fill')
    },
    stroke: () => {
      ink.push('stroke')
    },
    strokeRect: () => {
      ink.push('strokeRect')
    },
    moveTo: (x: number, y: number) => {
      ink.push(`m ${x} ${y}`)
    },
    lineTo: (x: number, y: number) => {
      ink.push(`l ${x} ${y}`)
    },
    beginPath() {},
    closePath() {},
    ellipse() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
    translate() {},
    setTransform() {},
    clearRect() {},
    setLineDash() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
  return { ctx: ctx as unknown as Ctx2D, ink: () => ink.join('|') }
}

// One read, one coverage bin, and one mark in each interbase feed — the count
// bar and the fixed-size triangle, which answer to the one toggle.
function sources(): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        arcsRpcDataMap: new Map(),
        laidOutPileupMap: new Map([
          [
            0,
            makePileupDataResult({
              readKeys: ['r1'],
              readPositions: new Uint32Array([REGION_START, REGION_START + 50]),
              readYs: new Uint16Array([0]),
              readFlags: new Uint16Array([0]),
              readMapqs: new Uint8Array([60]),
              readStrands: new Int8Array([1]),
              readColorCategories: new Uint8Array([0]),
              segmentPositions: new Uint32Array([
                REGION_START,
                REGION_START + 50,
              ]),
              segmentReadIndices: new Uint32Array([0]),
              segmentEdgeFlags: new Uint8Array([3]),
              numSegments: 1,
              coverageDepths: new Float32Array([30]),
              coverageMaxDepth: 50,
              coverageStartPos: REGION_START,
              coverageBinSize: 1,
              coverageGpuBinCount: 1,
              coveragePackedBuffer: packCoverageBinsForGpu(
                new Float32Array([30]),
                50,
                REGION_START,
                1,
              ),
              interbasePackedBuffer: packedInterbaseSegments([
                {
                  position: REGION_START + 3,
                  yOffset: 0,
                  height: 0.5,
                  colorType: 1,
                },
              ]),
              interbaseMaxCount: 4,
              indicatorPackedBuffer: packedIndicators([
                { position: REGION_START + 4, colorType: 1 },
              ]),
            }),
          ],
        ]),
      },
    ],
    readConnectionsLineWidth: 1,
  }
}

const BLOCK = {
  displayedRegionIndex: 0,
  start: REGION_START,
  end: REGION_START + 100,
  screenStartPx: 0,
  screenEndPx: 200,
  reversed: false,
}

function state(overrides: Partial<RenderState>): RenderState {
  return makeTestRenderState({
    coverageHeight: 50,
    coverageMinDepth: 0,
    coverageMaxDepth: 50,
    sections: [
      {
        pileupTopOffset: 50,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: 50,
        pileupClipTop: 50,
        pileupClipHeight: 150,
      },
    ],
    ...overrides,
  })
}

function inkFor(overrides: Partial<RenderState>) {
  const { ctx, ink } = inkRecordingCtx()
  drawAlignmentsToCtx(ctx, sources(), [BLOCK], state(overrides))
  return ink()
}

describe('the interbase toggle needs the coverage band', () => {
  it('changes nothing while the band is hidden', () => {
    expect(inkFor({ showCoverage: false, showInterbaseIndicators: true })).toBe(
      inkFor({ showCoverage: false, showInterbaseIndicators: false }),
    )
  })

  // The control. Without it the case above passes for a fixture whose interbase
  // feeds are empty, which is the way an A/B like this goes quietly green.
  it('changes the picture while the band is shown', () => {
    expect(
      inkFor({ showCoverage: true, showInterbaseIndicators: true }),
    ).not.toBe(inkFor({ showCoverage: true, showInterbaseIndicators: false }))
  })
})
