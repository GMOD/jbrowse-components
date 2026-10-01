import { setConf } from '@jbrowse/core/configuration'
import { categoricalValueColor } from '@jbrowse/core/ui/colors'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { isThreshold } from '@jbrowse/render-core/marks'

import { regionColorScale } from './markList.ts'
import {
  REGION,
  createTestEnvironment,
  features,
  workerResult,
} from './testEnv.ts'
import { placeTextMarks } from './textMarks.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { MarkRamp, MarkThreshold } from '@jbrowse/render-core/marks'

const SCORES = features([
  { start: 0, end: 100, score: 2, type: 'gene', depth: 1 },
  { start: 200, end: 300, score: 6, type: 'exon', depth: 5 },
  { start: 400, end: 500, score: 9, type: 'gene', depth: 8 },
])

function loaded(marks: Record<string, unknown>[]) {
  const { display } = createTestEnvironment({ marks }).createDisplay()
  display.setRpcData(0, workerResult(display, SCORES), REGION)
  return display
}

function layerOf(display: LinearMarkDisplayModel) {
  return display.rpcDataMap.get(0)!.layers[0]!
}

function colorLane(display: LinearMarkDisplayModel) {
  const { color } = layerOf(display)
  if (!(color instanceof Uint32Array)) {
    throw new Error(`expected a colour lane, got ${color}`)
  }
  return [...color]
}

function editColor(
  display: LinearMarkDisplayModel,
  slot:
    | 'value'
    | 'field'
    | 'scale'
    | 'domain'
    | 'range'
    | 'domainMin'
    | 'domainMax',
  value: unknown,
) {
  setConf(display.conf.marks[0]!, ['encoding', 'color', slot], value)
}

test('a constant colour crosses as the default and paints from the main thread', () => {
  const display = loaded([
    { mark: 'bar', encoding: { y: 'score', color: { value: 'red' } } },
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toBe(DEFAULT_MARK_COLOR)
  expect(request!.lanes).not.toContain('color')
  expect(layerOf(display).color).toBe(cssColorToABGR('red'))
  const before = JSON.stringify(display.rpcProps())

  editColor(display, 'value', 'green')

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(layerOf(display).color).toBe(cssColorToABGR('green'))

  editColor(display, 'field', 'score')
  editColor(display, 'scale', 'linear')

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(layerOf(display).colorValue).toBe(layerOf(display).y)
})

test('a categorical colour crosses as its field, and its domain and range repaint the keys met', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: { y: 'score', color: { field: 'type', scale: 'categorical' } },
    },
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toEqual({
    field: 'type',
    scale: 'categorical',
  })
  expect(request!.lanes).toContain('colorKey')
  expect(request!.lanes).not.toContain('color')
  const of = (v: string) => cssColorToABGR(categoricalValueColor(v))
  expect(colorLane(display)).toEqual(['gene', 'exon', 'gene'].map(of))
  const before = JSON.stringify(display.rpcProps())

  editColor(display, 'domain', ['gene', 'exon'])
  editColor(display, 'range', ['purple', 'orange'])

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  const [purple, orange] = ['purple', 'orange'].map(c => cssColorToABGR(c))
  expect(colorLane(display)).toEqual([purple, orange, purple])
  expect(layerOf(display).scale).toEqual({
    kind: 'categorical',
    field: 'type',
    domain: ['gene', 'exon'],
    range: ['purple', 'orange'],
    entries: [
      { value: 'gene', color: purple },
      { value: 'exon', color: orange },
    ],
  })
  expect(layerOf(display).colorKey).toBeUndefined()
})

test('a threshold over the plotted field ships no colour lane and is not a fetch input', () => {
  const display = loaded([
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
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toBe(DEFAULT_MARK_COLOR)
  expect(request!.lanes).not.toContain('color')
  expect(request!.lanes).not.toContain('colorValue')
  const before = JSON.stringify(display.rpcProps())

  const layer = layerOf(display)
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

  editColor(display, 'domain', ['7'])
  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect([...(display.paintScales[0] as MarkThreshold).cuts]).toEqual([7])
  expect(layerOf(display).scale).toMatchObject({ domain: [7] })
})

test('a ramp over the plotted field takes its extent off the values and its ends off the config', () => {
  const display = loaded([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'score', scale: 'linear', domainMin: 0 },
      },
    },
  ])
  const layer = layerOf(display)
  expect(layer.colorValue).toBe(layer.y)
  expect(layer.scale).toMatchObject({
    kind: 'ramp',
    scale: 'linear',
    extent: [2, 9],
    domain: [0, 9],
    pinned: [true, false],
  })
  editColor(display, 'domainMax', 20)
  expect(layerOf(display).scale).toMatchObject({
    domain: [0, 20],
    pinned: [true, true],
  })
})

test('a colour over another field crosses as its field and reads the values that lane carries', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'depth', scale: 'threshold', domain: [4] },
      },
    },
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toEqual({
    field: 'depth',
    scale: 'threshold',
  })
  expect(request!.lanes).toContain('colorValue')
  expect(request!.lanes).not.toContain('color')
  expect([...layerOf(display).colorValue!]).toEqual([1, 5, 8])
  expect(layerOf(display).scale).toMatchObject({
    kind: 'threshold',
    field: 'depth',
    domain: [4],
  })
  const before = JSON.stringify(display.rpcProps())

  editColor(display, 'scale', 'log')
  editColor(display, 'domainMin', 1)

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(layerOf(display).scale).toMatchObject({
    kind: 'ramp',
    scale: 'log',
    field: 'depth',
    domain: [1, 8],
  })
})

test('a span coloured by the depth its coverage step writes reads the raw values', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'span',
        transform: [{ type: 'coverage' }],
        encoding: { color: { field: 'coverage', scale: 'linear' } },
      },
    ],
  }).createDisplay()
  const [request] = display.layerRequests
  expect(request!.encoding.color).toEqual({
    field: 'coverage',
    scale: 'threshold',
  })
  expect(request!.lanes).toContain('colorValue')
  expect(request!.lanes).not.toContain('y')
})

test('a jexl colour is the worker’s to evaluate per feature', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          value: "jexl:get(feature,'score') > 5 ? 'red' : 'blue'",
        },
      },
    },
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toBe(
    "jexl:get(feature,'score') > 5 ? 'red' : 'blue'",
  )
  expect(request!.lanes).toContain('color')
  const [red, blue] = ['red', 'blue'].map(c => cssColorToABGR(c))
  expect(colorLane(display)).toEqual([blue, red, red])
})

test('a text coloured by the field it stands at paints through the scale the bars share', () => {
  const display = loaded([
    {
      mark: 'text',
      encoding: {
        y: 'score',
        text: 'type',
        color: {
          field: 'score',
          scale: 'threshold',
          domain: [5],
          range: ['blue', 'red'],
        },
      },
    },
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toBe(DEFAULT_MARK_COLOR)
  expect(request!.lanes).not.toContain('color')
  const placed = () =>
    placeTextMarks(
      display.textMarkEntries,
      display.rpcDataMap,
      display.renderBlocks,
      display.renderState,
      { size: 11, family: 'sans-serif' },
      'black',
    ).map(l => l.color)
  expect(placed()).toEqual([
    'rgba(0,0,255,1)',
    'rgba(255,0,0,1)',
    'rgba(255,0,0,1)',
  ])
  const before = JSON.stringify(display.rpcProps())

  editColor(display, 'domain', ['8'])

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(placed()).toEqual([
    'rgba(0,0,255,1)',
    'rgba(0,0,255,1)',
    'rgba(255,0,0,1)',
  ])
})

test('a text ramp with open ends follows the domain the regions union', () => {
  const display = loaded([
    {
      mark: 'text',
      encoding: {
        text: 'type',
        color: { field: 'depth', scale: 'linear' },
      },
    },
  ])
  expect(display.notices).toEqual([])
  expect((display.paintScales[0] as MarkRamp).domain).toEqual([1, 8])
})

// A colour edit that changes what the worker reads refetches, and until the
// refetch lands each region paints what it holds.
test('a region holding keys under a ramp still draws them, and a constant clears what it held', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: { y: 'score', color: { field: 'type', scale: 'categorical' } },
    },
  ])
  const keys = colorLane(display)

  editColor(display, 'field', 'depth')
  editColor(display, 'scale', 'linear')

  expect(colorLane(display)).toEqual(keys)
  expect(layerOf(display).colorKey).toBeUndefined()

  editColor(display, 'scale', 'none')
  editColor(display, 'value', 'red')

  const layer = layerOf(display)
  expect(layer.color).toBe(cssColorToABGR('red'))
  expect(layer.scale).toBeUndefined()
  expect(display.legendSections).toEqual([])
})

test('a region holding another field’s numbers paints them through a ramp over that field', () => {
  const display = loaded([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'depth', scale: 'threshold', domain: [4] },
      },
    },
  ])

  editColor(display, 'field', 'type')
  editColor(display, 'scale', 'categorical')
  editColor(display, 'domain', [])

  expect(layerOf(display).scale).toMatchObject({
    kind: 'ramp',
    field: 'depth',
    extent: [1, 8],
  })
  expect(display.paintScales[0]).toMatchObject({ domain: [1, 8] })
})

test('a region holding no colour paints the default while a categorical refetch is pending', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: { y: 'score', color: { field: 'score', scale: 'linear' } },
    },
  ])
  expect(layerOf(display).color).toBeUndefined()

  editColor(display, 'field', 'type')
  editColor(display, 'scale', 'categorical')

  expect(layerOf(display).color).toBe(cssColorToABGR(DEFAULT_MARK_COLOR))
  expect(layerOf(display).scale).toBeUndefined()
})

// A colour change refetches region by region, so for a moment one region holds
// the new kind of colour data and another the old; each paints what it holds,
// on the GPU as on Canvas2D, rather than one scale misreading the other.
test('regions holding different kinds of colour data each paint through what they hold', () => {
  const REGION_B = { ...REGION, refName: 'ctgB' }
  const { display } = createTestEnvironment(
    {
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: { field: 'depth', scale: 'linear' } },
        },
      ],
    },
    [REGION, REGION_B],
  ).createDisplay()
  display.setRpcData(0, workerResult(display, SCORES), REGION)
  display.setRpcData(1, workerResult(display, SCORES), REGION_B)

  editColor(display, 'field', 'type')
  editColor(display, 'scale', 'categorical')
  display.setRpcData(0, workerResult(display, SCORES), REGION)

  const { renderState } = display
  const landed = display.rpcDataMap.get(0)!
  const held = display.rpcDataMap.get(1)!
  expect(landed.layers[0]!.color).toBeInstanceOf(Uint32Array)
  expect(regionColorScale(renderState, landed, 0)).toBeUndefined()
  expect(regionColorScale(renderState, held, 0)).toMatchObject({
    scale: 'linear',
    domain: [1, 8],
  })
})
