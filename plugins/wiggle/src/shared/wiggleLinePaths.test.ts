import { RENDERING_TYPE_LINE } from '@jbrowse/wiggle-core'

import { drawLine, drawLineCenter } from './wiggleDrawFunctions.ts'

import type { RowDraw } from './wiggleDrawFunctions.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

// The paths the two Canvas2D lines stroked when each carried its own tracer,
// recorded before they moved onto render-core's `traceStep`/`traceCenter`:
// a reversed block, a hole either side of which the step drops to its gap
// score, a score past each end of the domain, and a cut (two on symlog)
// splitting the strokes.

function recorder() {
  const path: (string | number)[][] = []
  const ctx = {
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    beginPath: () => {},
    moveTo: (x: number, y: number) => path.push(['M', x, y]),
    lineTo: (x: number, y: number) => path.push(['L', x, y]),
    stroke: () => path.push(['stroke', ctx.strokeStyle]),
  }
  return { ctx: ctx as unknown as MarkContext2D, path }
}

function fixture(
  ctx: MarkContext2D,
  scaleType: ScaleTypeCode,
  reversed: boolean,
  cuts: number[],
): RowDraw & { rgb: string; negRgb: string; lineWidth: number } {
  return {
    ctx,
    source: {
      featurePositions: new Uint32Array([
        0, 10, 10, 20, 20, 30, 40, 50, 50, 60, 70, 80,
      ]),
      featureScores: new Float32Array([3, -2, 12, 4, 0.5, -8]),
      numFeatures: 6,
      color: [0, 0, 1],
      rowIndex: 0,
      renderingType: RENDERING_TYPE_LINE,
      gapScore: 1,
    },
    block: {
      displayedRegionIndex: 0,
      start: 0,
      end: 100,
      screenStartPx: 0,
      screenEndPx: 200,
      reversed,
    },
    rowHeight: 40,
    rowTop: 50,
    domainY: [-5, 10],
    scaleType,
    symlogConstant: 1,
    origin: 0,
    cuts,
    innerColors: cuts.length > 1 ? [[0, 1, 0]] : [],
    rampLut: null,
    rampMid: undefined,
    rgb: 'blue',
    negRgb: 'red',
    lineWidth: 1,
  }
}

const painters = { step: drawLine, center: drawLineCenter }
const fixtures = {
  linearReversed: [0, true, [0]],
  symlogTwoCuts: [2, false, [0, 2]],
} as const

test.each([
  [
    'step linearReversed',
    [
      ['M', 200, 74],
      ['L', 200, 68.66666666666667],
      ['L', 180, 68.66666666666667],
      ['L', 180, 76.66666666666667],
      ['M', 160, 76.66666666666667],
      ['L', 160, 50],
      ['L', 140, 50],
      ['L', 140, 74],
      ['M', 120, 74],
      ['L', 120, 66],
      ['L', 100, 66],
      ['L', 100, 75.33333333333333],
      ['L', 80, 75.33333333333333],
      ['L', 80, 74],
      ['M', 60, 74],
      ['L', 60, 76.66666666666667],
      ['M', 40, 76.66666666666667],
      ['L', 40, 74],
      ['stroke', 'blue'],
      ['M', 180, 76.66666666666667],
      ['L', 180, 82],
      ['L', 160, 82],
      ['L', 160, 76.66666666666667],
      ['M', 60, 76.66666666666667],
      ['L', 60, 90],
      ['L', 40, 90],
      ['L', 40, 76.66666666666667],
      ['stroke', 'red'],
    ],
  ],
  [
    'step symlogTwoCuts',
    [
      ['M', 0, 62.40467832441803],
      ['L', 0, 59.658083770303186],
      ['L', 20, 59.658083770303186],
      ['L', 20, 62.40467832441803],
      ['M', 40, 62.40467832441803],
      ['L', 40, 50],
      ['L', 60, 50],
      ['L', 60, 62.40467832441803],
      ['M', 80, 62.40467832441803],
      ['L', 80, 57.5276595224447],
      ['L', 100, 57.5276595224447],
      ['L', 100, 62.40467832441803],
      ['stroke', 'blue'],
      ['M', 0, 66.27578592706551],
      ['L', 0, 62.40467832441803],
      ['M', 20, 62.40467832441803],
      ['L', 20, 72.89348808382785],
      ['M', 40, 72.89348808382785],
      ['L', 40, 62.40467832441803],
      ['M', 60, 62.40467832441803],
      ['L', 60, 66.27578592706551],
      ['M', 80, 66.27578592706551],
      ['L', 80, 62.40467832441803],
      ['M', 100, 62.40467832441803],
      ['L', 100, 69.02238048118036],
      ['L', 120, 69.02238048118036],
      ['L', 120, 66.27578592706551],
      ['M', 140, 66.27578592706551],
      ['L', 140, 72.89348808382785],
      ['M', 160, 72.89348808382785],
      ['L', 160, 66.27578592706551],
      ['stroke', 'rgb(0,255,0)'],
      ['M', 20, 72.89348808382785],
      ['L', 20, 83.38229784323767],
      ['L', 40, 83.38229784323767],
      ['L', 40, 72.89348808382785],
      ['M', 140, 72.89348808382785],
      ['L', 140, 90],
      ['L', 160, 90],
      ['L', 160, 72.89348808382785],
      ['stroke', 'red'],
    ],
  ],
  [
    'center linearReversed',
    [
      ['M', 190, 68.66666666666667],
      ['L', 190, 68.66666666666667],
      ['L', 178, 76.66666666666667],
      ['M', 167.14285714285714, 77.42857142857143],
      ['L', 150, 50],
      ['L', 110, 66],
      ['L', 90, 75.33333333333333],
      ['L', 87.64705882352939, 76.19607843137256],
      ['stroke', 'blue'],
      ['M', 178, 76.66666666666667],
      ['L', 170, 82],
      ['L', 167.14285714285714, 77.42857142857143],
      ['M', 87.64705882352939, 76.19607843137256],
      ['L', 50, 90],
      ['stroke', 'red'],
    ],
  ],
  [
    'center symlogTwoCuts',
    [
      ['M', 10, 59.658083770303186],
      ['L', 10, 59.658083770303186],
      ['L', 12.315435652090382, 62.40467832441803],
      ['M', 41.995018998288, 63.361233001430435],
      ['L', 50, 50],
      ['L', 90, 57.5276595224447],
      ['L', 98.48566715013109, 62.40467832441803],
      ['stroke', 'blue'],
      ['M', 12.315435652090382, 62.40467832441803],
      ['L', 21.15771782604519, 72.89348808382785],
      ['M', 35.997509499144, 73.37176542233405],
      ['L', 41.995018998288, 63.361233001430435],
      ['M', 98.48566715013109, 62.40467832441803],
      ['L', 110, 69.02238048118036],
      ['L', 116.23147831069896, 72.29042000722086],
      ['stroke', 'rgb(0,255,0)'],
      ['M', 21.15771782604519, 72.89348808382785],
      ['L', 30, 83.38229784323767],
      ['L', 35.997509499144, 73.37176542233405],
      ['M', 116.23147831069896, 72.29042000722086],
      ['L', 150, 90],
      ['stroke', 'red'],
    ],
  ],
] as const)('%s strokes the recorded path', (name, expected) => {
  const [painter, fixtureName] = name.split(' ') as [
    keyof typeof painters,
    keyof typeof fixtures,
  ]
  const [scaleType, reversed, cuts] = fixtures[fixtureName]
  const { ctx, path } = recorder()
  painters[painter](fixture(ctx, scaleType, reversed, [...cuts]))
  expect(path).toEqual(expected)
})
