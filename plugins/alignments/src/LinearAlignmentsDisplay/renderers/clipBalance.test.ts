import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_SHAPE_ARC } from '../../features/arcs/shapes.ts'
import { emptyArcsUploadData } from '../../features/arcs/types.ts'
import { makeTestPalette } from '../testUtils.ts'
import { drawAlignmentsToCtx } from './Canvas2DAlignmentsRenderer.ts'

import type { ArcsUploadData } from '../../features/arcs/types.ts'
import type { AlignmentsSources, RenderState } from './rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * The clip nesting here is four deep — block, then the coverage, pileup and arc
 * bands within it — and an on-screen 2D context outlives the frame:
 * `prepareCanvas`'s setTransform/clearRect do not reset clip state. So one
 * painter throwing once, with the `restore` outside a `finally`, leaves every
 * later frame drawing through a stale clip. A transient error becomes permanent
 * corruption, and what the user sees (content missing from a band with no
 * reason to be clipped) points nowhere near the painter that threw.
 *
 * The failure needs a throw to reproduce and a throw is what no fixture
 * naturally produces, hence a context that raises on a draw call. Counting
 * save/restore is the assertion because balance is the property — which band
 * threw doesn't matter.
 */
const REGION_START = 10_000

function balanceCountingCtx(throwOn?: keyof Ctx2D) {
  let depth = 0
  let maxDepth = 0
  const raise = (op: string) => {
    if (op === throwOn) {
      throw new Error(`boom in ${op}`)
    }
  }
  const ctx = {
    save() {
      depth++
      maxDepth = Math.max(maxDepth, depth)
    },
    restore() {
      depth--
    },
    fillRect: () => {
      raise('fillRect')
    },
    strokeRect: () => {
      raise('strokeRect')
    },
    stroke: () => {
      raise('stroke')
    },
    fill: () => {
      raise('fill')
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    ellipse() {},
    rect() {},
    clip() {},
    translate() {},
    setTransform() {},
    clearRect() {},
    setLineDash() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
  return {
    ctx: ctx as unknown as Ctx2D,
    depth: () => depth,
    max: () => maxDepth,
  }
}

// One dome in the arc band, so a throw can be aimed at the innermost clip. The
// pileup and coverage painters only ever fill, so without this the two cases
// below would both land in the same band.
function oneArc(): ArcsUploadData {
  return {
    ...emptyArcsUploadData(),
    arcX1: new Uint32Array([REGION_START + 10]),
    arcX2: new Uint32Array([REGION_START + 60]),
    arcColorTypes: new Uint8Array([0]),
    arcShapeTypes: new Uint8Array([ARC_SHAPE_ARC]),
    arcYBp: new Uint32Array([50]),
    arcSpanBp: new Uint32Array([50]),
    arcSupport: new Uint32Array([1]),
    numArcs: 1,
  }
}

// One read plus one coverage bin, so the pileup band has something to paint and
// the coverage band is not skipped for being empty.
function sources(): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        arcsRpcDataMap: new Map([[0, oneArc()]]),
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
              mismatchPositions: new Uint32Array([REGION_START + 5]),
              mismatchYs: new Uint16Array([0]),
              mismatchBases: new Uint8Array([65]),
              mismatchFrequencies: new Uint8Array([255]),
              mismatchQuals: new Uint8Array([40]),
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

function state(): RenderState {
  return {
    canvasWidth: 200,
    canvasHeight: 200,
    scrollTop: 0,
    colorScheme: 0,
    featureHeight: 10,
    featureSpacing: 1,
    coverageHeight: 50,
    coverageYOffset: 5,
    coverageMinDepth: 0,
    coverageMaxDepth: 50,
    coverageScaleType: 0 as const,
    coverageSymlogConstant: 1,
    showMismatches: true,
    filterMismatchesByFrequency: false,
    mismatchAlpha: false,
    showSoftClipping: false,
    showInterbaseIndicators: false,
    showModifications: false,
    showPerBaseQuality: false,
    showPerBaseLetter: false,
    selectedChainReadIds: [],
    colors: makeTestPalette(),
    chainMode: false,
    showLinkedReadLines: false,
    collapseGroupRows: false,
    readConnectionsLineWidth: 1,
    readConnections: 'off',
    readConnectionsDown: false,
    readConnectionsHeight: 0,
    showOutline: false,
    pileupTopOffset: 50,
    coverageTopOffset: 0,
    sections: [
      {
        pileupTopOffset: 50,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: 50,
        pileupClipTop: 50,
        pileupClipHeight: 150,
        arcBand: { top: 0, height: 50, down: false },
      },
    ],
  } as unknown as RenderState
}

describe('drawAlignmentBlocks clip balance', () => {
  it('leaves the context unclipped after a normal draw', () => {
    const { ctx, depth, max } = balanceCountingCtx()
    drawAlignmentsToCtx(ctx, sources(), [BLOCK], state())
    // Not just balanced — the fixture has to actually reach the nested bands,
    // or a balanced-at-zero result would prove nothing.
    expect(max()).toBeGreaterThan(1)
    expect(depth()).toBe(0)
  })

  for (const op of ['fillRect', 'stroke'] as const) {
    it(`leaves the context unclipped when a painter throws in ${op}`, () => {
      const { ctx, depth } = balanceCountingCtx(op)
      expect(() => {
        drawAlignmentsToCtx(ctx, sources(), [BLOCK], state())
      }).toThrow('boom')
      expect(depth()).toBe(0)
    })
  }
})
