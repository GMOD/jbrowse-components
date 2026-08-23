import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { UNIFORM_OFFSET_F32 } from '@jbrowse/render-core/shaders/coverageBar'

import { emptyMafCoverage } from '../LinearMafDisplay/components/coverageTestFixture.ts'
import { GpuMafRenderer, MAF_PASSES } from './GpuMafRenderer.ts'

import type {
  MafCoverageBandState,
  MafGPURenderState,
  MafRegionData,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'

/**
 * The coverage band and the rows are two bands scissored out of ONE canvas —
 * MAF gets one rendering backend, so a second GPU band cannot mean a second
 * canvas. Which makes the two scissors the thing to pin: they are the only
 * reason a scrolled row does not paint up into the band, or a bar down into the
 * rows, and neither failure is visible in a unit test that only checks the draw
 * happened.
 */

const CANVAS_WIDTH = 200
const COVERAGE_HEIGHT = 60
const ROWS_HEIGHT = 100

const BAND: MafCoverageBandState = {
  height: COVERAGE_HEIGHT,
  domainMax: 20,
  colors: {
    coverage: 'grey',
    baseA: 'green',
    baseC: 'blue',
    baseG: 'orange',
    baseT: 'red',
    baseN: 'black',
    insertion: 'purple',
  },
  gpuColors: {
    coverage: 1,
    baseA: 2,
    baseC: 3,
    baseG: 4,
    baseT: 5,
    baseN: 6,
    insertionIndicator: 7,
    softclipIndicator: 8,
    hardclipIndicator: 9,
  },
}

function state(coverage: MafCoverageBandState | undefined): MafGPURenderState {
  return {
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: (coverage ? COVERAGE_HEIGHT : 0) + ROWS_HEIGHT,
    rowsTop: coverage ? COVERAGE_HEIGHT : 0,
    rowsHeight: ROWS_HEIGHT,
    coverage,
    rowHeight: 10,
    rowProportion: 1,
    scrollTop: 0,
    showAllLetters: false,
    mismatchRendering: false,
    palette: {
      colorForBase: { a: 'green', c: 'blue', g: 'orange', t: 'red', n: 'grey' },
      matchColor: 'lightgrey',
      gapColor: 'white',
      mismatchOffColor: 'grey',
      unknownBaseColor: 'black',
      insertionColor: 'purple',
      bridgeLineColor: 'grey',
      missingDataColor: 'white',
    },
    binBp: 1,
  }
}

// One region with a real depth peak, so `depthScale` has something to un-bake.
function region(): MafRegionData {
  return {
    blocks: [],
    coverage: { ...emptyMafCoverage(), coverageMaxDepth: 5 },
  }
}

function payload(): MafUploadPayload {
  const { coverage } = region()
  return {
    instanceBuffer: new Uint32Array(4),
    coveragePackedBuffer: new ArrayBuffer(8),
    snpPackedBuffer: coverage.snpPackedBuffer,
    interbasePackedBuffer: coverage.interbasePackedBuffer,
    indicatorPackedBuffer: coverage.indicatorPackedBuffer,
  }
}

function render(coverage: MafCoverageBandState | undefined) {
  const hal = new MockHal(MAF_PASSES)
  const renderer = new GpuMafRenderer(hal)
  renderer.uploadRegion(0, payload())
  renderer.renderBlocks(
    [
      {
        displayedRegionIndex: 0,
        start: 0,
        end: 100,
        screenStartPx: 0,
        screenEndPx: CANVAS_WIDTH,
        reversed: false,
      },
    ],
    new Map([[0, region()]]),
    state(coverage),
  )
  return hal
}

const dpr = getDpr()

describe('the MAF coverage band on the rows canvas', () => {
  const hal = render(BAND)
  const draws = hal.draws()

  test('draws the four shared band passes, in paint order, then the rows', () => {
    expect(draws.map(d => d.passId)).toEqual([
      'coverage',
      'snpCov',
      'interbase',
      'indicator',
      'rect',
    ])
  })

  test('scissors the band to its own strip at the canvas top', () => {
    for (const draw of draws.filter(d => d.passId !== 'rect')) {
      expect(draw.scissor).toEqual({
        x: 0,
        y: 0,
        w: CANVAS_WIDTH * dpr,
        h: COVERAGE_HEIGHT * dpr,
      })
    }
  })

  test('scissors the rows below it, and leaves the viewport full-height', () => {
    const rows = draws.find(d => d.passId === 'rect')!
    expect(rows.scissor).toEqual({
      x: 0,
      y: COVERAGE_HEIGHT * dpr,
      w: CANVAS_WIDTH * dpr,
      h: ROWS_HEIGHT * dpr,
    })
    // Both shaders place Y in clip space against the WHOLE canvas, so only the
    // scissor narrows — a narrowed viewport would rescale the band's own Y.
    expect(rows.viewport).toEqual({
      x: 0,
      y: 0,
      w: CANVAS_WIDTH * dpr,
      h: (COVERAGE_HEIGHT + ROWS_HEIGHT) * dpr,
    })
  })

  test('the band reads its own uniform struct, written before its passes', () => {
    const band = hal.uniformsOf(draws[0]!)!
    expect(band[UNIFORM_OFFSET_F32.covHeight]).toBe(COVERAGE_HEIGHT)
    expect(band[UNIFORM_OFFSET_F32.covTop]).toBe(0)
    expect(band[UNIFORM_OFFSET_F32.canvasH]).toBe(COVERAGE_HEIGHT + ROWS_HEIGHT)
    expect(band[UNIFORM_OFFSET_F32.depthDomainMax]).toBe(20)
    // regionMaxDepth / domainMax — what un-bakes the region's own peak from the
    // buffer's `relDepth` so the bars land on the display's domain.
    expect(band[UNIFORM_OFFSET_F32.depthScale]).toBeCloseTo(5 / 20)
    expect(band[UNIFORM_OFFSET_F32.hpZero]).toBe(0)
  })

  test('the rows pass reads a later write than the band did', () => {
    const rows = draws.find(d => d.passId === 'rect')!
    expect(rows.uniformWrite).toBeGreaterThan(draws[0]!.uniformWrite)
  })
})

test('no band state draws no band passes, and the rows fill the canvas', () => {
  const draws = render(undefined).draws()
  expect(draws.map(d => d.passId)).toEqual(['rect'])
  expect(draws[0]!.scissor).toEqual({
    x: 0,
    y: 0,
    w: CANVAS_WIDTH * dpr,
    h: ROWS_HEIGHT * dpr,
  })
})
