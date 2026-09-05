import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { MockHal } from '@jbrowse/render-core/hal'
import { GpuMarkBackend } from '@jbrowse/render-core/marks/backend'
import { UNIFORM_OFFSET_F32 } from '@jbrowse/render-core/shaders/coverageBar'
import { SCALE_TYPE_LINEAR } from '@jbrowse/wiggle-core/normalize'

import { emptyMafCoverage } from '../LinearMafDisplay/components/coverageTestFixture.ts'
import { MAF_MARKS } from './mafMarks.ts'

import type {
  MafGPURenderState,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { CoverageBandState } from '@jbrowse/alignments-core'

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

const COLORS = {
  coverage: 1,
  baseA: 2,
  baseC: 3,
  baseG: 4,
  baseT: 5,
  baseN: 6,
  insertionIndicator: 7,
  softclipIndicator: 8,
  hardclipIndicator: 9,
}

const BAND: CoverageBandState = {
  height: COVERAGE_HEIGHT,
  top: 0,
  domainMin: 0,
  domainMax: 20,
  scaleType: SCALE_TYPE_LINEAR,
  symlogConstant: 1,
  snpMinFrequency: 0,
  showInterbase: true,
  colors: COLORS,
}

const NO_BAND: CoverageBandState = { ...BAND, height: 0, domainMax: undefined }

function state(coverage: CoverageBandState): MafGPURenderState {
  return {
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: coverage.height + ROWS_HEIGHT,
    rowsTop: coverage.height,
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
  }
}

// One region with a real depth peak, distinct from the display's domain max.
function payload(): MafUploadPayload {
  return {
    cells: {
      x: Uint32Array.of(0),
      x2: Uint32Array.of(10),
      row: Uint32Array.of(0),
      color: Uint32Array.of(0xff0000ff),
      count: 1,
    },
    coverage: {
      ...emptyMafCoverage(),
      coverageMaxDepth: 5,
      coveragePackedBuffer: new ArrayBuffer(8),
    },
  }
}

function render(coverage: CoverageBandState) {
  const hal = new MockHal(MAF_MARKS.map(m => m.pass))
  const renderer = new GpuMarkBackend(hal, MAF_MARKS)
  const region = payload()
  renderer.upload(0, region)
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
    new Map([[0, region]]),
    state(coverage),
  )
  return hal
}

const dpr = getDpr()

describe('the MAF coverage band on the rows canvas', () => {
  const hal = render(BAND)
  const draws = hal.draws()

  test('draws the four shared band passes, in paint order, then the rows mark', () => {
    expect(draws.map(d => d.passId)).toEqual([
      'coverage',
      'snpCov',
      'interbase',
      'indicator',
      'span',
    ])
  })

  test('scissors the band to its own strip at the canvas top', () => {
    for (const draw of draws.filter(d => d.passId !== 'span')) {
      expect(draw.scissor).toEqual({
        x: 0,
        y: 0,
        w: CANVAS_WIDTH * dpr,
        h: COVERAGE_HEIGHT * dpr,
      })
    }
  })

  test('scissors the rows below it, and leaves the viewport full-height', () => {
    const rows = draws.find(d => d.passId === 'span')!
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
    // the region's own peak, which is what the buffer's `relDepth` is a fraction
    // of — carried as itself rather than as a ratio the shader multiplies the
    // domain back into
    expect(band[UNIFORM_OFFSET_F32.regionMaxDepth]).toBe(5)
    expect(band[UNIFORM_OFFSET_F32.hpZero]).toBe(0)
  })

  test('the rows pass reads a later write than the band did', () => {
    const rows = draws.find(d => d.passId === 'span')!
    expect(rows.uniformWrite).toBeGreaterThan(draws[0]!.uniformWrite)
  })
})

test('no band draws no band passes, and the rows fill the canvas', () => {
  const draws = render(NO_BAND).draws()
  expect(draws.map(d => d.passId)).toEqual(['span'])
  expect(draws[0]!.scissor).toEqual({
    x: 0,
    y: 0,
    w: CANVAS_WIDTH * dpr,
    h: ROWS_HEIGHT * dpr,
  })
})
