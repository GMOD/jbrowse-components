import {
  packCoverageBinsForGpu,
  packModCovSegmentsForGpu,
  packSnpInstances,
} from '@jbrowse/alignments-core'

import {
  makePileupDataResult,
  packedIndicators,
  packedInterbaseSegments,
} from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { makeTestRenderState } from '../testUtils.ts'
import {
  CANVAS_COVERAGE_DRAW,
  buildAlignmentsRegionMap,
} from './Canvas2DAlignmentsRenderer.ts'
import { COVERAGE_LAYERS } from './coverageLayers.ts'

import type { CoverageScale } from '../../features/coverage/coverageScale.ts'
import type { Canvas2DRegionData } from './Canvas2DAlignmentsRenderer.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * The Canvas2D twin of `uploadedPassCoverage.test.ts`.
 *
 * `COVERAGE_LAYERS` is shared and both backends map it through an exhaustive
 * `Record<CoverageLayerId, …>`, so a layer added to the list and missed in one
 * of them is a compile error. What no type can see is whether the entry that
 * satisfies the record actually PAINTS — an adapter wired to the neighbouring
 * layer's draw function, or reading a region field that is real and the right
 * type but belongs to another layer, type-checks and paints nothing or paints
 * the wrong thing, on the Canvas2D backend and the SVG export only.
 *
 * So: hand every layer a region with one instance in each coverage feed, and
 * require that every layer draws.
 */

const START = 10_000

// Every coverage feed populated, sized so each layer has exactly one mark to
// paint — and run through the real `buildAlignmentsRegionMap`, so the packing a
// layer reads is the packing production hands it. Assembling the region by hand
// is how a fixture comes to omit a feed and prove nothing.
function fullyPopulated(): Canvas2DRegionData {
  const data = makePileupDataResult({
    coverageDepths: new Float32Array([30]),
    coverageMaxDepth: 50,
    coverageStartPos: START,
    coverageBinSize: 1,
    coverageGpuBinCount: 1,
    coveragePackedBuffer: packCoverageBinsForGpu(
      new Float32Array([30]),
      50,
      START,
      1,
    ),
    snpPackedBuffer: packSnpInstances(
      {
        position: [START + 1],
        yOffset: [0],
        segHeight: [0.4],
        colorType: [1],
        relDepth: [1],
      },
      1,
    ),
    modCovPackedBuffer: packModCovSegmentsForGpu(
      new Uint32Array([START + 2]),
      new Float32Array([0]),
      new Float32Array([0.4]),
      new Uint32Array([0xff00ff00]),
      new Float32Array([1]),
      1,
    ),
    interbasePackedBuffer: packedInterbaseSegments([
      { position: START + 3, yOffset: 0, height: 0.5, colorType: 1 },
    ]),
    interbaseMaxCount: 4,
    indicatorPackedBuffer: packedIndicators([
      { position: START + 4, colorType: 1 },
    ]),
  })
  return buildAlignmentsRegionMap({
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, data]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    readConnectionsLineWidth: 1,
  }).get(0)!
}

// Counts anything that puts ink on the canvas. Which primitive a layer reaches
// for is its own business — the bars fill rects, the indicator triangles fill a
// path — so the assertion is "something was painted", not "a rect appeared".
function inkCountingCtx() {
  let ops = 0
  const ctx = {
    fillRect: () => ops++,
    fill: () => ops++,
    stroke: () => ops++,
    strokeRect: () => ops++,
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
    translate() {},
    setLineDash() {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }
  return { ctx: ctx as unknown as Ctx2D, ops: () => ops }
}

const SCALE: CoverageScale = {
  normalize: (depth: number) => depth / 50,
  domainMax: 50,
}

// A resolved domain and the interbase toggle on, so every layer's gate passes.
const STATE = makeTestRenderState({
  coverageHeight: 100,
  coverageMaxDepth: 50,
  coverageMinDepth: 0,
  showInterbaseIndicators: true,
})

// bp → px over [START, START + 100] mapped to [0, 200].
const bpToX = (bp: number) => ((bp - START) / 100) * 200

describe('every coverage layer paints on Canvas2D', () => {
  it.each(COVERAGE_LAYERS.map(l => l.id))('%s draws', id => {
    const { ctx, ops } = inkCountingCtx()
    CANVAS_COVERAGE_DRAW[id](ctx, fullyPopulated(), bpToX, 200, STATE, SCALE)
    expect({ id, painted: ops() > 0 }).toEqual({ id, painted: true })
  })

  // Guards the guard: if two adapters were wired to the same draw function,
  // every case above still passes. Distinct output is what says they aren't.
  it('no two layers paint identically', () => {
    const signatures = COVERAGE_LAYERS.map(l => {
      const fills: string[] = []
      const ctx = {
        fillRect: (x: number, y: number, w: number, h: number) => {
          fills.push(`rect ${x} ${y} ${w} ${h}`)
        },
        fill: () => {
          fills.push('path')
        },
        stroke: () => {
          fills.push('stroke')
        },
        strokeRect: () => {
          fills.push('strokeRect')
        },
        beginPath() {},
        moveTo(x: number, y: number) {
          fills.push(`m ${x} ${y}`)
        },
        lineTo(x: number, y: number) {
          fills.push(`l ${x} ${y}`)
        },
        closePath() {},
        rect() {},
        clip() {},
        save() {},
        restore() {},
        translate() {},
        setLineDash() {},
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      } as unknown as Ctx2D
      CANVAS_COVERAGE_DRAW[l.id](
        ctx,
        fullyPopulated(),
        bpToX,
        200,
        STATE,
        SCALE,
      )
      return fills.join('|')
    })
    expect(new Set(signatures).size).toBe(COVERAGE_LAYERS.length)
  })

  // The four depth-scaled layers are gated on `hasCoverageScale` in the shared
  // list, so the renderer never calls them without a scale — but the adapters
  // narrow rather than assert, and a narrowing that silently swallowed the draw
  // would look like this test not existing.
  it('the indicator layer is the only one that draws without a resolved domain', () => {
    const drawnWithoutScale = COVERAGE_LAYERS.filter(l => {
      const { ctx, ops } = inkCountingCtx()
      CANVAS_COVERAGE_DRAW[l.id](
        ctx,
        fullyPopulated(),
        bpToX,
        200,
        STATE,
        undefined,
      )
      return ops() > 0
    }).map(l => l.id)
    expect(drawnWithoutScale).toEqual(['indicator'])
  })
})
