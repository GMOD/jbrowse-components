import {
  packCoverageBinsForGpu,
  packIndicatorInstances,
  packInterbaseInstances,
  packSnpInstances,
} from '@jbrowse/alignments-core'
import { COVERAGE_BAND_LAYER_ORDER } from '@jbrowse/render-core/coverageBand'

import { emptyMafCoverage } from '../LinearMafDisplay/components/coverageTestFixture.ts'
import { MAF_COVERAGE_PASSES } from './GpuMafRenderer.ts'
import { MAF_CANVAS_COVERAGE_DRAW } from './drawMafCoverage.ts'

import type { MafCoverageColors } from './coverageBandColors.ts'
import type { MafCoverageRegion } from './mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * The MAF band's two backends paint the same layers in the same order, and each
 * painter is wired to its own draw.
 *
 * The order matters rather than being cosmetic: the interbase bars hang from the
 * band top over the lower half the depth bars grow up into, so at any real depth
 * the two overlap and whichever paints last wins. It used to be stated twice —
 * once as `MAF_COVERAGE_PASSES`, once as four sequential calls in
 * `drawMafCoverage` — with nothing checking that they agreed, so "MAF drew its
 * band in a different order on the fallback" was a screenshot to catch. Both now
 * come out of render-core's `COVERAGE_BAND_LAYER_ORDER`; these pin that they
 * still do, and that the painters behind the ids are distinct.
 */

const START = 10_000
const DOMAIN_MAX = 50

const COLORS: MafCoverageColors = {
  coverage: 'grey',
  baseA: 'green',
  baseC: 'blue',
  baseG: 'orange',
  baseT: 'red',
  baseN: 'black',
  insertion: 'purple',
}

// One mark in every feed MAF ships, so each layer has exactly one thing to
// paint. The depth bars read `coveragePackedBuffer` — the GPU layout, the only
// one there is — which is what a fixture handing them a raw-depth array would
// silently fail to exercise.
function fullyPopulated(): MafCoverageRegion {
  return {
    ...emptyMafCoverage(START),
    coverageDepths: new Float32Array([30]),
    coverageMaxDepth: DOMAIN_MAX,
    coveragePackedBuffer: packCoverageBinsForGpu(
      new Float32Array([30]),
      DOMAIN_MAX,
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
    interbaseMaxCount: 4,
    interbasePackedBuffer: packInterbaseInstances(
      {
        position: [START + 2],
        yOffset: [0],
        segHeight: [0.5],
        colorType: [1],
      },
      1,
    ),
    indicatorPackedBuffer: packIndicatorInstances(
      { position: [START + 3], colorType: [1] },
      1,
    ),
  }
}

// Records what each painter puts on the canvas. Which primitive a layer reaches
// for is its own business — the bars fill rects, the triangles fill a path — so
// a signature is "what ink appeared", not "a rect appeared".
function recordingCtx() {
  const ink: string[] = []
  const ctx = {
    fillRect: (x: number, y: number, w: number, h: number) => {
      ink.push(`rect ${x} ${y} ${w} ${h}`)
    },
    fill: () => {
      ink.push('path')
    },
    stroke: () => {
      ink.push('stroke')
    },
    strokeRect: () => {
      ink.push('strokeRect')
    },
    beginPath() {},
    moveTo(x: number, y: number) {
      ink.push(`m ${x} ${y}`)
    },
    lineTo(x: number, y: number) {
      ink.push(`l ${x} ${y}`)
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
  }
  return { ctx: ctx as unknown as Ctx2D, ink }
}

const BAND = {
  coverageHeight: 100,
  canvasWidth: 200,
  domainMax: DOMAIN_MAX,
  normalize: (depth: number) => depth / DOMAIN_MAX,
  colors: COLORS,
  snpColors: {
    baseA: COLORS.baseA,
    baseC: COLORS.baseC,
    baseG: COLORS.baseG,
    baseT: COLORS.baseT,
    baseN: COLORS.baseN,
  },
  interbaseColors: {
    insertion: COLORS.insertion,
    softclip: COLORS.insertion,
    hardclip: COLORS.insertion,
  },
}

// bp → px over [START, START + 100] mapped to [0, 200].
const bpToX = (bp: number) => (bp - START) * 2

const canvasLayers = COVERAGE_BAND_LAYER_ORDER.filter(
  id => MAF_CANVAS_COVERAGE_DRAW[id],
)

describe('the MAF coverage band draws one layer list', () => {
  it('the Canvas2D painters and the GPU passes are the same layers, in order', () => {
    expect(canvasLayers).toEqual(MAF_COVERAGE_PASSES.map(p => p.id))
  })

  it('MAF declares no modification layer on either backend', () => {
    expect(canvasLayers).not.toContain('modCov')
  })

  it.each(canvasLayers)('%s paints', id => {
    const { ctx, ink } = recordingCtx()
    MAF_CANVAS_COVERAGE_DRAW[id]!(ctx, fullyPopulated(), bpToX, BAND)
    expect({ id, painted: ink.length > 0 }).toEqual({ id, painted: true })
  })

  // Guards the guard: two painters wired to the same draw pass every case
  // above. Distinct ink is what says they aren't.
  it('no two layers paint identically', () => {
    const signatures = canvasLayers.map(id => {
      const { ctx, ink } = recordingCtx()
      MAF_CANVAS_COVERAGE_DRAW[id]!(ctx, fullyPopulated(), bpToX, BAND)
      return ink.join('|')
    })
    expect(new Set(signatures).size).toBe(canvasLayers.length)
  })
})
