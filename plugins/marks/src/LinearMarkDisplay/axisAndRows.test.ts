import { setConf } from '@jbrowse/core/configuration'
import { rowSlot } from '@jbrowse/render-core/marks'

import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

test('a link standing at a y folds into the axis whichever side its far foot lies', () => {
  const { display, view } = createTestEnvironment({
    marks: [
      {
        mark: 'link',
        linkShape: 'line',
        encoding: { y: 'score', x2: { chrom: 'chrom2', pos: 'start2' } },
      },
    ],
  }).createDisplay()
  const feats = features([
    { start: 5000, end: 5001, chrom2: 'ctgA', start2: 7000, score: 1 },
    { start: 6000, end: 6001, chrom2: 'ctgA', start2: 200, score: 50 },
    { start: 6500, end: 6501, chrom2: 'ctgB', start2: 100, score: 80 },
  ])
  display.setRpcData(0, workerResult(display, feats), REGION)
  view.navTo({ refName: 'ctgA', start: 5500, end: 7000 })
  expect(display.domain![1]).toBeGreaterThanOrEqual(80)
})

test('a region split on the outgoing rows field leaves the axis and the row list with its instances', () => {
  const { display } = createTestEnvironment({
    marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    rows: { field: 'source' },
  }).createDisplay()
  display.setRpcData(
    0,
    workerResult(
      display,
      features([
        { source: 'a', type: 'x', start: 0, end: 100, score: 4 },
        { source: 'b', type: 'y', start: 200, end: 300, score: 1000 },
      ]),
    ),
    REGION,
  )
  expect(display.domain![1]).toBeGreaterThanOrEqual(1000)
  expect(display.sources.map(r => r.name)).toEqual(['a', 'b'])
  setConf(display.conf, ['rows', 'field'], 'type')
  const { rowTable } = display.renderState
  const drawn = [...display.rpcDataMap.values()]
    .flatMap(r => r.layers)
    .reduce(
      (n, l) =>
        n +
        [...l.x.keys()].filter(i => rowSlot(l.row, i, rowTable) !== undefined)
          .length,
      0,
    )
  expect(drawn).toBe(0)
  expect(display.sources).toEqual([])
  expect(display.domain).toBeUndefined()
})

test('a log axis under bars is not pulled toward an origin it cannot reach', () => {
  const domainOf = (mark: string) => {
    const { display } = createTestEnvironment({
      marks: [{ mark, encoding: { y: 'score' } }],
      scales: { y: { type: 'log' } },
    }).createDisplay()
    display.setRpcData(
      0,
      workerResult(
        display,
        features([
          { start: 0, end: 100, score: 0.002 },
          { start: 200, end: 300, score: 0.5 },
        ]),
      ),
      REGION,
    )
    return display.domain!
  }
  expect(domainOf('bar')).toEqual(domainOf('point'))
  expect(domainOf('bar')[0]).toBeLessThanOrEqual(0.002)
})

test('hiding a section leaves a log size scale over the positive values it strokes', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'link',
        encoding: { x2: 'end', size: { field: 'score', scale: 'log' } },
      },
    ],
    facet: 'kind',
  }).createDisplay()
  display.setRpcData(
    0,
    workerResult(
      display,
      features([
        { kind: 'a', start: 100, end: 900, score: 0 },
        { kind: 'a', start: 200, end: 800, score: 5 },
        { kind: 'a', start: 300, end: 700, score: 50 },
        { kind: 'b', start: 400, end: 600, score: 500 },
      ]),
    ),
    REGION,
  )
  expect(display.sizeScales[0]!.domain).toEqual([5, 500])
  display.hideGroup('b')
  expect(display.sizeScales[0]!.domain).toEqual([5, 50])
})
