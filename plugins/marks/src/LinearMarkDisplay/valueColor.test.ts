import { setConf } from '@jbrowse/core/configuration'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { isThreshold } from '@jbrowse/render-core/marks'

import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'

import type { MarkThreshold } from '@jbrowse/render-core/marks'

const SCORES = features([
  { start: 0, end: 100, score: 2 },
  { start: 200, end: 300, score: 6 },
  { start: 400, end: 500, score: 9 },
])

test('a threshold over the plotted field ships no colour lane and is not a fetch input', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: {
            field: 'score',
            scale: 'threshold',
            domain: [5],
            range: ['blue', 'red'],
          },
        },
      },
    ],
  }).createDisplay()
  const [request] = display.layerRequests
  expect(request!.encoding.color).toBe(DEFAULT_MARK_COLOR)
  expect(request!.lanes).not.toContain('color')
  expect(request!.lanes).not.toContain('colorValue')
  const before = JSON.stringify(display.rpcProps())

  display.setRpcData(0, workerResult(display, SCORES), REGION)
  const layer = display.rpcDataMap.get(0)!.layers[0]!
  expect(layer.color).toBeUndefined()
  expect(layer.colorValue).toBe(layer.y)
  expect(layer.scale).toMatchObject({
    kind: 'threshold',
    field: 'score',
    domain: [5],
    range: ['blue', 'red'],
  })
  const scale = display.paintScales[0]!
  expect(isThreshold(scale)).toBe(true)
  expect([...(scale as MarkThreshold).cuts]).toEqual([5])
  expect(display.legendSections[0]!.scale).toMatchObject({ kind: 'threshold' })

  setConf(display.conf.marks[0]!, ['encoding', 'color', 'domain'], ['7'])
  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect([...(display.paintScales[0] as MarkThreshold).cuts]).toEqual([7])
  expect(display.rpcDataMap.get(0)!.layers[0]!.scale).toMatchObject({
    domain: [7],
  })
})

test('a ramp over the plotted field takes its extent off the values and its ends off the config', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'point',
        encoding: {
          y: 'score',
          color: { field: 'score', scale: 'linear', domainMin: 0 },
        },
      },
    ],
  }).createDisplay()
  display.setRpcData(0, workerResult(display, SCORES), REGION)
  const layer = display.rpcDataMap.get(0)!.layers[0]!
  expect(layer.colorValue).toBe(layer.y)
  expect(layer.scale).toMatchObject({
    kind: 'ramp',
    scale: 'linear',
    extent: [2, 9],
    domain: [0, 9],
    pinned: [true, false],
  })
  setConf(display.conf.marks[0]!, ['encoding', 'color', 'domainMax'], 20)
  expect(display.rpcDataMap.get(0)!.layers[0]!.scale).toMatchObject({
    domain: [0, 20],
    pinned: [true, true],
  })
})

test('a colour over another field keeps its own lane and stays a fetch input', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'strand', scale: 'threshold', domain: [0] },
        },
      },
    ],
  }).createDisplay()
  const [request] = display.layerRequests
  expect(request!.encoding.color).toMatchObject({ field: 'strand' })
  expect(request!.lanes).toContain('colorValue')
  expect(display.valueColors).toEqual([undefined])
})
