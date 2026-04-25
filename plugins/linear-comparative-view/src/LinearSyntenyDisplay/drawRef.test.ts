import { drawRef } from './drawRef.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'

let mockView = {
  drawCurves: false,
  drawCIGAR: false,
  drawCIGARMatchesOnly: false,
  drawLocationMarkers: false,
  width: 800,
  views: [
    { bpPerPx: 1, offsetPx: 0 },
    { bpPerPx: 1, offsetPx: 0 },
  ],
}

jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
  doesIntersect2: (l1: number, r1: number, l2: number, r2: number) =>
    r1 > l2 && l1 < r2,
}))

function makeModel(
  p11: number,
  p12: number,
  p21: number,
  p22: number,
  level = 0,
): Partial<LinearSyntenyDisplayModel> {
  return {
    level,
    height: 100,
    minAlignmentLength: 0,
    colorBy: 'default',
    featureData: {
      featureIds: ['f1'],
      names: [''],
      strands: new Int8Array([1]),
      refNames: ['chr1'],
      assemblyNames: ['hg38'],
      cigars: [''],
      syriTypes: [undefined],
      mates: [{ start: 0, end: 1, refName: 'chr2', name: '', assemblyName: '' }],
      p11_offsetPx: new Float64Array([p11]),
      p12_offsetPx: new Float64Array([p12]),
      p21_offsetPx: new Float64Array([p21]),
      p22_offsetPx: new Float64Array([p22]),
      starts: new Float64Array([0]),
      ends: new Float64Array([1000]),
      identities: new Float64Array([-1]),
      padTop: new Float64Array([0]),
      padBottom: new Float64Array([0]),
    },
    parsedCigars: [[]],
    queryTotalLengths: undefined,
    colorMapWithAlpha: { M: 'red', I: 'purple', D: 'grey', N: 'grey', X: 'red', '=': 'red' },
    posColorWithAlpha: 'red',
    negColorWithAlpha: 'blue',
    queryColorWithAlphaMap: () => 'red',
  } as unknown as Partial<LinearSyntenyDisplayModel>
}

function makeCanvas() {
  let strokeCount = 0
  return {
    strokeCount: () => strokeCount,
    ctx: {
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      bezierCurveTo: jest.fn(),
      stroke: jest.fn(() => strokeCount++),
      fill: jest.fn(),
      closePath: jest.fn(),
      setTransform: jest.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
    },
  }
}

describe('drawRef culling', () => {
  beforeEach(() => {
    mockView = {
      drawCurves: false,
      drawCIGAR: false,
      drawCIGARMatchesOnly: false,
      drawLocationMarkers: false,
      width: 800,
      views: [
        { bpPerPx: 1, offsetPx: 0 },
        { bpPerPx: 1, offsetPx: 0 },
      ],
    }
  })

  test('draws narrow feature when top edge is on-screen and bottom is off-screen', () => {
    // Top: x11=x12=500 (on-screen), Bottom: x21=x22=-2000 (off-screen left)
    const model = makeModel(500, 500, -2000, -2000)
    const { ctx, strokeCount } = makeCanvas()
    drawRef(model as unknown as LinearSyntenyDisplayModel, ctx as never)
    expect(strokeCount()).toBe(1)
  })

  test('draws narrow feature when bottom edge is on-screen and top is off-screen', () => {
    // Top: x11=x12=-2000 (off-screen), Bottom: x21=x22=400 (on-screen)
    const model = makeModel(-2000, -2000, 400, 400)
    const { ctx, strokeCount } = makeCanvas()
    drawRef(model as unknown as LinearSyntenyDisplayModel, ctx as never)
    expect(strokeCount()).toBe(1)
  })

  test('does not draw narrow feature when both edges are far off-screen', () => {
    // Top: x11=x12=-2000, Bottom: x21=x22=-2000 (both off-screen)
    const model = makeModel(-2000, -2000, -2000, -2000)
    const { ctx, strokeCount } = makeCanvas()
    drawRef(model as unknown as LinearSyntenyDisplayModel, ctx as never)
    expect(strokeCount()).toBe(0)
  })

  test('draws narrow feature when both edges are on-screen', () => {
    const model = makeModel(100, 100, 200, 200)
    const { ctx, strokeCount } = makeCanvas()
    drawRef(model as unknown as LinearSyntenyDisplayModel, ctx as never)
    expect(strokeCount()).toBe(1)
  })
})
