import { setConf } from '@jbrowse/core/configuration'
import { categoricalValueColor } from '@jbrowse/core/ui/colors'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { isThreshold } from '@jbrowse/render-core/marks'

import { findMarkHit } from './findMarkHit.ts'
import { keySettingOf } from './legend.ts'
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
    throw new Error(`expected a color lane, got ${color}`)
  }
  return [...color]
}

function editColor(
  display: LinearMarkDisplayModel,
  slot:
    | 'value'
    | 'field'
    | 'type'
    | 'domain'
    | 'range'
    | 'domainMin'
    | 'domainMax'
    | 'unknown'
    | 'invalid',
  value: unknown,
) {
  const mark = display.conf.marks[0]!
  if (slot === 'value' || slot === 'field') {
    setConf(mark, ['encoding', 'color', slot], value)
  } else {
    setConf(mark, ['encoding', 'color', 'scale', slot], value)
  }
}

test('a constant color crosses as the default and paints from the main thread', () => {
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
  editColor(display, 'type', 'linear')

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(layerOf(display).colorValue).toBe(layerOf(display).y)
})

test('a categorical color crosses as its field, and its domain and range repaint the keys met', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'type', scale: { type: 'ordinal' } },
      },
    },
  ])
  const [request] = display.layerRequests
  expect(request!.encoding.color).toEqual({
    field: 'type',
    scale: 'ordinal',
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

test('unknown repaints the categories the domain leaves out, fetching nothing', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'type',
          scale: { domain: ['gene'], range: ['purple'] },
        },
      },
    },
  ])
  const before = JSON.stringify(display.rpcProps())

  editColor(display, 'unknown', '#cccccc')

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  const [purple, grey] = ['purple', '#cccccc'].map(c => cssColorToABGR(c))
  expect(colorLane(display)).toEqual([purple, grey, purple])
})

test('unknown leaves a feature with no value grey, and invalid repaints it, fetching nothing', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: {
            field: 'type',
            scale: { domain: ['gene'], range: ['purple'], unknown: '#cccccc' },
          },
        },
      },
    ],
  }).createDisplay()
  display.setRpcData(
    0,
    workerResult(
      display,
      features([
        { start: 0, end: 100, score: 2, type: 'gene' },
        { start: 200, end: 300, score: 6, type: 'exon' },
        { start: 400, end: 500, score: 9 },
      ]),
    ),
    REGION,
  )
  const before = JSON.stringify(display.rpcProps())
  const [purple, grey, noValue, black] = [
    'purple',
    '#cccccc',
    NO_CATEGORY_COLOR,
    'black',
  ].map(c => cssColorToABGR(c))
  expect(colorLane(display)).toEqual([purple, grey, noValue])

  editColor(display, 'invalid', 'black')

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(colorLane(display)).toEqual([purple, grey, black])
})

test('two marks differing only in invalid keep a key each', () => {
  const mark = (invalid: string) => ({
    mark: 'bar',
    encoding: {
      y: 'score',
      color: {
        field: 'type',
        scale: { domain: ['gene'], unknown: '#cccccc', invalid },
      },
    },
  })
  const { display } = createTestEnvironment({
    marks: [mark('black'), mark('blue')],
  }).createDisplay()
  expect(display.conf.marks.map(m => keySettingOf(m, 'color').invalid)).toEqual(
    ['black', 'blue'],
  )
})

test('categories the hash puts on one color each take their own, and keep it as regions arrive', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'biotype', scale: { type: 'ordinal' } },
        },
      },
    ],
  }).createDisplay()
  const biotypes = (names: string[]) =>
    features(
      names.map((biotype, i) => ({
        start: i * 100,
        end: i * 100 + 50,
        score: 1,
        biotype,
      })),
    )
  display.setRpcData(
    0,
    workerResult(display, biotypes(['snRNA', 'protein_coding'])),
    REGION,
  )
  const first = colorLane(display)
  expect(new Set(first).size).toBe(2)
  display.setRpcData(
    1,
    workerResult(display, biotypes(['TEC', 'protein_coding', 'snRNA'])),
    { ...REGION, refName: 'ctgB' },
  )
  const second = display.rpcDataMap.get(1)!.layers[0]!.color as Uint32Array
  expect(new Set(second).size).toBe(3)
  expect(second[1]).toBe(first[1])
  expect(second[2]).toBe(first[0])
  expect(display.cornerNotices.join('\n')).not.toMatch(/share one color/)
})

test('a threshold over the plotted field ships no color lane and is not a fetch input', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'score',
          scale: { type: 'threshold', domain: [5], range: ['blue', 'red'] },
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
        color: { field: 'score', scale: { type: 'linear', domainMin: 0 } },
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

test('a symlog ramp repaints the loaded values and hands the shapes its scale', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'depth', scale: { type: 'linear' } },
      },
    },
  ])
  const before = JSON.stringify(display.rpcProps())

  editColor(display, 'type', 'symlog')

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(layerOf(display).scale).toMatchObject({
    kind: 'ramp',
    scale: 'symlog',
    extent: [1, 8],
  })
  expect(display.paintScales[0]).toMatchObject({
    scale: 'symlog',
    domain: [1, 8],
  })
  expect(display.configProblems).toEqual([])
})

test('a color over another field crosses as its field and reads the values that lane carries', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'depth', scale: { type: 'threshold', domain: [4] } },
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

  editColor(display, 'type', 'log')
  editColor(display, 'domainMin', 1)

  expect(JSON.stringify(display.rpcProps())).toBe(before)
  expect(layerOf(display).scale).toMatchObject({
    kind: 'ramp',
    scale: 'log',
    field: 'depth',
    domain: [1, 8],
  })
})

test('a span colored by the depth its coverage step writes reads the raw values', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'span',
        transform: [{ type: 'coverage' }],
        encoding: { color: { field: 'coverage', scale: { type: 'linear' } } },
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

test('a jexl color is the worker’s to evaluate per feature', () => {
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

test('a text colored by the field it stands at paints through the scale the bars share', () => {
  const display = loaded([
    {
      mark: 'text',
      encoding: {
        y: 'score',
        text: 'type',
        color: {
          field: 'score',
          scale: { type: 'threshold', domain: [5], range: ['blue', 'red'] },
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
        color: { field: 'depth', scale: { type: 'linear' } },
      },
    },
  ])
  expect(display.notices).toEqual([])
  expect((display.paintScales[0] as MarkRamp).domain).toEqual([1, 8])
})

// A color edit that changes what the worker reads refetches, and until the
// refetch lands each region paints what it holds.
test('a region holding keys under a ramp still draws them, and a constant clears what it held', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'type', scale: { type: 'ordinal' } },
      },
    },
  ])
  const keys = colorLane(display)

  editColor(display, 'field', 'depth')
  editColor(display, 'type', 'linear')

  expect(colorLane(display)).toEqual(keys)
  expect(layerOf(display).colorKey).toBeUndefined()

  editColor(display, 'field', '')
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
        color: { field: 'depth', scale: { type: 'threshold', domain: [4] } },
      },
    },
  ])

  editColor(display, 'field', 'type')
  editColor(display, 'type', 'ordinal')
  editColor(display, 'domain', [])

  const region = display.rpcDataMap.get(0)!
  expect(region.layers[0]!.scale).toMatchObject({
    kind: 'ramp',
    field: 'depth',
    extent: [1, 8],
  })
  expect(regionColorScale(display.renderState, region, 0)).toMatchObject({
    domain: [1, 8],
  })
  expect(display.legendSections).toEqual([])
})

test('a region holding no color paints the default while a categorical refetch is pending', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'score', scale: { type: 'linear' } },
      },
    },
  ])
  expect(layerOf(display).color).toBeUndefined()

  editColor(display, 'field', 'type')
  editColor(display, 'type', 'ordinal')

  expect(layerOf(display).color).toBe(cssColorToABGR(DEFAULT_MARK_COLOR))
  expect(layerOf(display).scale).toBeUndefined()
})

// A color change refetches region by region, so for a moment one region holds
// the new kind of color data and another the old; each paints what it holds,
// on the GPU as on Canvas2D, rather than one scale misreading the other.
test('regions holding different kinds of color data each paint through what they hold', () => {
  const REGION_B = { ...REGION, refName: 'ctgB' }
  const { display } = createTestEnvironment(
    {
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'depth', scale: { type: 'linear' } },
          },
        },
      ],
    },
    [REGION, REGION_B],
  ).createDisplay()
  display.setRpcData(0, workerResult(display, SCORES), REGION)
  display.setRpcData(1, workerResult(display, SCORES), REGION_B)

  editColor(display, 'field', 'type')
  editColor(display, 'type', 'ordinal')
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

// Only the regions in view refetch after a color change, so one loaded
// earlier and scrolled away can hold the old color's data indefinitely. It
// must not reach the mark's scale or the legend, which the landed regions,
// read for the color as it now stands, paint through.
test('a region still holding an earlier color shapes neither the scale nor the key', () => {
  const REGION_B = { ...REGION, refName: 'ctgB' }
  const { display } = createTestEnvironment(
    {
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: {
              field: 'depth',
              scale: { type: 'threshold', domain: [4] },
            },
          },
        },
      ],
    },
    [REGION, REGION_B],
  ).createDisplay()
  const withGc = features([
    { start: 0, end: 100, score: 2, depth: 1, gc: 30 },
    { start: 200, end: 300, score: 6, depth: 5, gc: 60 },
  ])
  display.setRpcData(0, workerResult(display, withGc), REGION)

  editColor(display, 'field', 'gc')
  editColor(display, 'domain', ['50'])
  display.setRpcData(1, workerResult(display, withGc), REGION_B)

  const { renderState } = display
  expect(display.legendSections.map(s => s.scale)).toEqual([
    expect.objectContaining({ kind: 'threshold', field: 'gc', domain: [50] }),
  ])
  const landed = display.rpcDataMap.get(1)!
  const held = display.rpcDataMap.get(0)!
  expect(regionColorScale(renderState, landed, 0)).toMatchObject({
    cuts: [50],
  })
  expect(regionColorScale(renderState, held, 0)).toMatchObject({
    scale: 'linear',
    domain: [1, 5],
  })
})

test('keys read for another categorical field are held, and leave the key to the field as it stands', () => {
  const REGION_B = { ...REGION, refName: 'ctgB' }
  const { display } = createTestEnvironment(
    {
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'type', scale: { type: 'ordinal' } },
          },
        },
      ],
    },
    [REGION, REGION_B],
  ).createDisplay()
  const withKind = features([
    { start: 0, end: 100, score: 2, type: 'gene', kind: 'a' },
    { start: 200, end: 300, score: 6, type: 'exon', kind: 'b' },
  ])
  display.setRpcData(0, workerResult(display, withKind), REGION)

  editColor(display, 'field', 'kind')
  display.setRpcData(1, workerResult(display, withKind), REGION_B)

  expect(display.rpcDataMap.get(0)!.layers[0]!.heldColor).toBe(true)
  expect(display.rpcDataMap.get(1)!.layers[0]!.heldColor).toBeUndefined()
  expect(display.legendSections.map(s => s.scale.field)).toEqual(['kind'])
})

test('a held region read for another field takes none of its missing-value flags into a color over y', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'gc', scale: { type: 'linear' } },
      },
    },
  ])
  expect(layerOf(display).scale).toMatchObject({ missing: true })

  editColor(display, 'field', 'score')

  expect(layerOf(display).scale).toMatchObject({ field: 'score' })
  expect(layerOf(display).scale).not.toHaveProperty('missing')
})

// A held region's color belongs to an earlier declaration no key names, so
// the hover leaves its color row out rather than name it under the new field.
test('a hover on a held region says so, and a landed one does not', () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'depth', scale: { type: 'linear' } },
      },
    },
  ])
  const hitAnywhere = () => {
    const { canvasWidth, canvasHeight } = display.renderState
    for (let x = 0; x < canvasWidth; x += 2) {
      for (let y = 0; y < canvasHeight; y += 2) {
        const hit = findMarkHit(
          x,
          y,
          display.renderBlocks,
          display.rpcDataMap,
          display.markList,
          display.renderState,
          display.host.displayedRegions,
        )
        if (hit) {
          return hit
        }
      }
    }
    return undefined
  }
  expect(hitAnywhere()).toMatchObject({ heldColor: undefined })

  editColor(display, 'field', 'gc')

  expect(hitAnywhere()).toMatchObject({ heldColor: true })
})

// A line's threshold colors along the line only over the plotted value; a cut
// on another field is in that field's units, not the y axis's.
test('the render state says which marks color by their own y', () => {
  const display = loaded([
    {
      mark: 'line',
      encoding: {
        y: 'score',
        color: { field: 'score', scale: { type: 'threshold', domain: [5] } },
      },
    },
  ])
  expect(display.renderState.colorsFromY).toEqual([true])

  editColor(display, 'field', 'depth')
  expect(display.renderState.colorsFromY).toEqual([false])
})

// Hosted jb2hubs configs still write a mark's color flat
// (`hubtools/src/alfaPopulations.ts`); the deprecated lift reads it as the
// channel, so the population colors still paint.
test("a hosted hub's flat categorical color loads as the ordinal channel", () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'type',
          scale: 'categorical',
          domain: ['a', 'b'],
          range: ['#ff0000', '#0000ff'],
        },
      },
    },
  ])
  expect(getSnapshot(display.conf.marks[0]!.encoding.color)).toEqual({
    field: 'type',
    scale: {
      type: 'ordinal',
      domain: ['a', 'b'],
      range: ['#ff0000', '#0000ff'],
    },
  })
  expect(display.layerRequests[0]!.encoding.color).toEqual({
    field: 'type',
    scale: 'ordinal',
  })
})

// A key's names and the rows it lists are the legend's; the worker paints
// without them, so editing one refetches nothing.
test("a color's legend.values and scale.names edit the key without a fetch", () => {
  const display = loaded([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'type', scale: { domain: ['a'] } },
      },
    },
  ])
  const fetched = display.rpcProps()
  const { color } = display.conf.marks[0]!.encoding
  setConf(color, ['scale', 'names'], ['First'])
  setConf(color, ['legend', 'values'], ['a'])
  setConf(color, ['legend', 'missingLabel'], 'none')
  expect(display.rpcProps()).toEqual(fetched)
})
