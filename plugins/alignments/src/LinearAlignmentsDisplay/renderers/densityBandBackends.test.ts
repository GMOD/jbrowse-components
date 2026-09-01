import { MockHal } from '@jbrowse/render-core/hal'

import { densityCoverageFields } from '../../features/coverage/densityBand.ts'
import { makeTestRenderState } from '../testUtils.ts'
import { drawAlignmentsToCtx } from './Canvas2DAlignmentsRenderer.ts'
import {
  ALIGNMENTS_PASSES,
  GPU_PILEUP_PASS,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsSources, RenderState } from './rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

/**
 * The density tier reuses the coverage band rather than standing up a renderer
 * of its own, so what has to hold is that one `densityRegions` map reaches all
 * three paint paths: the GPU depth-bar pass, the Canvas2D painter, and the SVG
 * export — which is the same `drawAlignmentsToCtx` the on-screen Canvas2D
 * backend calls, so the two cannot drift.
 */

const REGION_START = 10_000

function inkCountingCtx() {
  let rects = 0
  const ctx = {
    fillRect: () => rects++,
    fill: () => rects++,
    stroke: () => rects++,
    strokeRect: () => rects++,
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
  return { ctx: ctx as unknown as Ctx2D, rects: () => rects }
}

function densitySources(): AlignmentsSources {
  return {
    sections: [],
    densityRegions: new Map([
      [
        0,
        densityCoverageFields(
          {
            starts: Uint32Array.from([REGION_START, REGION_START + 50]),
            ends: Uint32Array.from([REGION_START + 50, REGION_START + 100]),
            scores: Float32Array.from([10, 40]),
          },
          10,
        ),
      ],
    ]),
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
  return makeTestRenderState({
    coverageHeight: 50,
    coverageMinDepth: 0,
    coverageMaxDepth: 40,
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
  })
}

test('Canvas2D and the SVG export paint the bins through the shared entry', () => {
  const { ctx, rects } = inkCountingCtx()
  expect(drawAlignmentsToCtx(ctx, densitySources(), [BLOCK], state())).toBe(
    true,
  )
  expect(rects()).toBeGreaterThan(0)
})

test('the band is what draws it — no band, no ink', () => {
  const { ctx, rects } = inkCountingCtx()
  drawAlignmentsToCtx(ctx, densitySources(), [BLOCK], {
    ...state(),
    coverageHeight: 0,
  })
  expect(rects()).toBe(0)
})

test('the GPU uploads the depth-bar pass and no pileup pass', () => {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  new GpuAlignmentsRenderer(hal).upload('sources', densitySources())
  const uploaded = new Set(
    hal.calls.filter(c => c.method === 'uploadBuffer').map(c => c.args[1]),
  )
  expect(uploaded).toEqual(new Set(['coverage']))
  for (const pass of Object.values(GPU_PILEUP_PASS)) {
    expect(uploaded.has(pass.id)).toBe(false)
  }
})

// The upload memo is keyed per region, and a density region and a pileup region
// share a key. Re-uploading identical bins must not repack; swapping tiers must.
test('the upload memo skips identical bins and rebuilds on a tier swap', () => {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  const sources = densitySources()
  renderer.upload('sources', sources)
  const first = hal.calls.filter(c => c.method === 'uploadBuffer').length
  renderer.upload('sources', { ...sources })
  expect(hal.calls.filter(c => c.method === 'uploadBuffer')).toHaveLength(first)

  renderer.upload('sources', densitySources())
  expect(
    hal.calls.filter(c => c.method === 'uploadBuffer').length,
  ).toBeGreaterThan(first)
})
