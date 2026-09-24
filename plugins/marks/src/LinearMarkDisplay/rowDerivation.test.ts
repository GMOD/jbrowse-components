import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { LinearMarkDisplayModel } from './model.ts'

const BARS = [
  {
    mark: 'bar',
    encoding: {
      y: 'score',
      color: { field: 'source', scale: 'categorical' },
    },
  },
]

const FAMILY = features([
  { source: 's10', start: 500, end: 900, score: 4 },
  { source: 'mom', start: 0, end: 400, score: 7 },
  { source: 's2', start: 100, end: 300, score: 2 },
  { source: 'dad', start: 200, end: 800, score: 9 },
  { source: 'mom', start: 600, end: 700, score: 3 },
])

function loaded(display: Record<string, unknown>) {
  const { display: model } = createTestEnvironment({
    marks: BARS,
    ...display,
  }).createDisplay()
  model.setRpcData(0, workerResult(model, FAMILY), REGION)
  return model
}

function drawn(display: LinearMarkDisplayModel) {
  return {
    request: display.rpcProps().facet,
    rowCount: display.rowCount,
    renderRowCount: display.renderState.rowCount,
    domain: display.domain,
    layers: [...display.rpcDataMap.values()].map(region =>
      region.layers.map(l => ({
        count: l.count,
        x: [...l.x],
        x2: [...l.x2],
        y: [...(l.y ?? [])],
        row: [...(l.row ?? [])],
        color: [...(l.color ?? [])],
      })),
    ),
    valueScales: display.valueScales.map(
      ({ domain, height, offset, bandTops }) => ({
        domain,
        height,
        offset,
        bandTops,
      }),
    ),
    legend: display.colorScales.map(scale =>
      scale.kind === 'categorical'
        ? scale.entries.map(({ value, label, color }) => ({
            value,
            label,
            color,
          }))
        : scale,
    ),
  }
}

test('bars faceted by source draw a band per source under its chip', () => {
  const display = loaded({ facet: 'source' })
  expect(drawn(display)).toMatchSnapshot()
  expect(display.facetLayout).toMatchSnapshot()
})

test('a facet domain leads the bands and the key', () => {
  const display = loaded({ facet: { field: 'source', domain: ['s10', 'mom'] } })
  expect(drawn(display)).toMatchSnapshot()
})
