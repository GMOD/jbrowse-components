import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'
import { waitFor } from '@testing-library/react'

import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { EncodedFeaturesResult } from '@jbrowse/core/util/markEncoding'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function createTestEnvironment(marks: unknown[]) {
  return createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: 'BedAdapter', config: { type: 'BedAdapter' } },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: { marks },
    regions: [REGION],
    onViewReady: view => {
      view.showAllRegions()
    },
  })
}

type Layer = EncodedFeaturesResult['layers'][number]

function ramp(
  extent: [number, number],
  pinnedDomain?: [number, number],
): Layer['scale'] {
  return {
    kind: 'ramp',
    field: 'score',
    scale: 'linear',
    domain: pinnedDomain ?? extent,
    pinned: pinnedDomain !== undefined,
    extent,
    lut: new Uint8Array(256 * 4),
  }
}

function extremes(y: number[]) {
  let yMin = Infinity
  let yMax = -Infinity
  for (const v of y) {
    yMin = v < yMin ? v : yMin
    yMax = v > yMax ? v : yMax
  }
  return { yMin, yMax }
}

function result(
  layers: {
    y: number[]
    row?: number[]
    scale?: Layer['scale']
    glyphScale?: Layer['glyphScale']
  }[],
): EncodedFeaturesResult {
  return {
    layers: layers.map(({ y, row, scale, glyphScale }) => ({
      count: y.length,
      skipped: 0,
      x: Uint32Array.from(y.map((_, i) => i * 100)),
      x2: Uint32Array.from(y.map((_, i) => i * 100 + 50)),
      y: Float32Array.from(y),
      row: row ? Uint32Array.from(row) : undefined,
      color: new Uint32Array(y.length),
      glyph: new Uint8Array(y.length),
      featureIndex: Uint32Array.from(y.map((_, i) => i)),
      ...extremes(y),
      scale,
      glyphScale,
    })),
  }
}

test('the config reaches the worker as one encoding per mark, jexl unevaluated', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical', domain: [1, -1] },
      },
    },
    {
      shape: 'point',
      encoding: {
        x: "jexl:get(feature,'thickStart')",
        y: 'jexl:feature.score*2',
        color: "jexl:get(feature,'name')=='a'?'red':'blue'",
        glyph: 'triangle',
      },
    },
    {
      shape: 'span',
      encoding: {
        color: {
          field: 'score',
          scale: 'log',
          domain: [1, 1000],
          ramp: ['white', 'red'],
        },
      },
    },
  ])
  const { display } = createDisplay()
  expect(display.markShapes).toEqual(['bar', 'point', 'span'])
  expect(display.rpcProps()).toEqual({
    transform: [],
    layers: [
      {
        encoding: {
          x: 'start',
          x2: 'end',
          y: 'score',
          row: undefined,
          color: {
            field: 'strand',
            scale: 'categorical',
            palette: undefined,
            domain: ['1', '-1'],
          },
          glyph: 'disc',
        },
        lanes: ['y', 'color', 'colorValue', 'index'],
      },
      {
        encoding: {
          x: "jexl:get(feature,'thickStart')",
          x2: 'end',
          y: 'jexl:feature.score*2',
          row: undefined,
          color: "jexl:get(feature,'name')=='a'?'red':'blue'",
          glyph: 'triangle',
        },
        lanes: ['y', 'color', 'colorValue', 'glyph', 'index'],
      },
      {
        encoding: {
          x: 'start',
          x2: 'end',
          y: undefined,
          row: undefined,
          color: {
            field: 'score',
            scale: 'log',
            domain: [1, 1000],
            ramp: ['white', 'red'],
          },
          glyph: 'disc',
        },
        lanes: ['row', 'color', 'index'],
      },
    ],
  })
  expect(display.markList.map(m => m.pass.id)).toEqual([
    'bar#0',
    'point#1',
    'span#2',
  ])
})

test('the domain spans every valued layer and widens to the origin for a bar', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
    { shape: 'point', encoding: { y: 'other' } },
  ])
  const { display } = createDisplay()
  expect(display.domain).toBeUndefined()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [12, 20] }]), REGION)
  expect(display.domain).toEqual([0, 20])
  expect(display.renderState.domainY).toEqual([0, 20])
})

test('the declared y scale is the axis: its type and its pinned bounds', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: { y: { field: 'score', scale: 'log', domain: [1, 1000] } },
    },
  ])
  const { display } = createDisplay()
  expect(display.scaleType).toBe('log')
  expect(display.minScoreBound).toBe(1)
  expect(display.maxScoreBound).toBe(1000)
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(display.domain).toEqual([1, 1000])
  expect(display.valueScales[0]!.scaleType).toBe('log')
  expect(display.renderState.scaleTypeY).toBe('log')
})

test('a bare y field is the linear autoscaled form it always was', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.scaleType).toBe('linear')
  expect(display.hasManualScoreBounds).toBe(false)
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(display.domain).toEqual([0, 8])
})

test('one end of a declared domain pins and the other autoscales', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: { field: 'score', domain: ['', '50'] } } },
  ])
  const { display } = createDisplay()
  expect(display.minScoreBound).toBeUndefined()
  expect(display.maxScoreBound).toBe(50)
})

test('the score menu edits the declaration, not a second pair of slots', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  display.setMaxScore(200)
  expect([...display.conf.marks[0]!.encoding.y.domain]).toEqual(['', '200'])
  expect(display.maxScore).toBe(Number.MAX_VALUE)
  expect(display.maxScoreBound).toBe(200)
  display.setScaleType('log')
  expect(display.conf.marks[0]!.encoding.y.scale).toBe('log')
  expect(display.scaleType).toBe('log')
  display.setMaxScore(undefined)
  expect([...display.conf.marks[0]!.encoding.y.domain]).toEqual([])
  expect(display.hasManualScoreBounds).toBe(false)
})

test('an unpinned ramp domain is the union of the loaded regions extremes', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: { y: 'score', color: { field: 'score', scale: 'linear' } },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8], scale: ramp([3, 8]) }]), REGION)
  expect(display.colorRamps[0]!.domain).toEqual([3, 8])
  display.setRpcData(1, result([{ y: [1, 20], scale: ramp([1, 20]) }]), REGION)
  expect(display.colorRamps[0]!.domain).toEqual([1, 20])
  expect(display.colorScales[0]).toMatchObject({
    kind: 'ramp',
    domain: [1, 20],
  })
})

test('a pinned ramp domain is every region s, whatever they hold', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'score', scale: 'linear', domain: [0, 100] },
      },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result([{ y: [3, 8], scale: ramp([3, 8], [0, 100]) }]),
    REGION,
  )
  display.setRpcData(
    1,
    result([{ y: [1, 20], scale: ramp([1, 20], [0, 100]) }]),
    REGION,
  )
  expect(display.colorRamps[0]!.domain).toEqual([0, 100])
})

test('an independent mark folds its own domain and takes the right-hand axis', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
    {
      shape: 'point',
      encoding: { y: { field: 'coverage', resolve: 'independent' } },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [200, 900] }]), REGION)
  expect(display.domain).toEqual([0, 8])
  expect(display.independentValueScale).toEqual({
    domain: [0, 900],
    scaleType: 'linear',
    field: 'coverage',
  })
  expect(display.renderState.independentY).toEqual({
    markIndex: 1,
    domain: [0, 900],
    scaleType: 'linear',
  })
  const [left, right] = display.valueScales
  expect(left).toMatchObject({ domain: [0, 8], caption: 'score' })
  expect(left!.side).toBeUndefined()
  expect(right).toMatchObject({
    domain: [0, 900],
    side: 'right',
    caption: 'coverage',
  })
  expect(display.axes.map(a => a.side)).toEqual([undefined, 'right'])
})

test('an independent mark keeps its own scale type and pins, and leaves the shared menu alone', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
    {
      shape: 'bar',
      encoding: {
        y: {
          field: 'coverage',
          scale: 'log',
          domain: [1, 1000],
          resolve: 'independent',
        },
      },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [200, 900] }]), REGION)
  expect(display.valueMarkIndex).toBe(0)
  expect(display.independentMarkIndex).toBe(1)
  expect(display.scaleType).toBe('linear')
  expect(display.independentValueScale).toMatchObject({
    domain: [1, 1000],
    scaleType: 'log',
  })
  display.setMaxScore(50)
  expect([...display.conf.marks[0]!.encoding.y.domain]).toEqual(['', '50'])
  expect([...display.conf.marks[1]!.encoding.y.domain]).toEqual(['1', '1000'])
})

test('a display with no independent mark declares one axis and no captions', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(display.valueScales).toHaveLength(1)
  expect(display.valueScales[0]!.caption).toBeUndefined()
  expect(display.renderState.independentY).toBeUndefined()
})

test('two independent marks are refused where the config is read', () => {
  expect(() =>
    createTestEnvironment([
      { shape: 'bar', encoding: { y: { field: 'a', resolve: 'independent' } } },
      { shape: 'bar', encoding: { y: { field: 'b', resolve: 'independent' } } },
    ]).createDisplay(),
  ).toThrow(/one mark at most may declare encoding.y.resolve "independent"/)
})

test('a span-only display has no score domain', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'span', encoding: {} },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [0, 0], row: [0, 0] }]), REGION)
  expect(display.domain).toBeUndefined()
  expect(display.rowCount).toBe(1)
})

test('a span stacked by a row field asks the worker for the row lane and bands the plot by the highest row', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'span', encoding: { row: 'sampleIndex' } },
  ])
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]).toEqual({
    encoding: {
      x: 'start',
      x2: 'end',
      y: undefined,
      row: 'sampleIndex',
      color: DEFAULT_MARK_COLOR,
      glyph: 'disc',
    },
    lanes: ['row', 'color', 'index'],
  })
  display.setRpcData(0, result([{ y: [0, 0, 0], row: [0, 2, 1] }]), REGION)
  expect(display.rowCount).toBe(3)
  expect(display.renderState.rowCount).toBe(3)
})

test("a transform list reaches the worker as its own layer's steps, defaults left off", () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: { y: 'count' },
      transform: [
        { type: 'filter', expr: "jexl:get(feature,'score') > 1" },
        { type: 'formula', expr: 'jexl:feature.score*2', as: 'twice' },
        { type: 'bin', step: 5000 },
        { type: 'bin', step: 10, field: 'end', as: ['b0', 'b1'] },
        {
          type: 'aggregate',
          groupby: ['start', 'end'],
          ops: [{ op: 'count' }, { op: 'mean', field: 'twice', as: 'm' }],
        },
        { type: 'coverage' },
        { type: 'coverage', as: 'depth' },
        { type: 'flatten' },
        { type: 'flatten', field: 'exons', as: 'nth' },
        { type: 'stack' },
        {
          type: 'stack',
          as: 'lane',
          fields: ['s', 'e'],
          padding: 20,
          groupby: ['sample'],
        },
      ],
    },
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  const { layers } = display.rpcProps()
  expect(layers[0]!.transform).toEqual([
    { type: 'filter', expr: "jexl:get(feature,'score') > 1" },
    { type: 'formula', expr: 'jexl:feature.score*2', as: 'twice' },
    { type: 'bin', step: 5000, field: undefined, as: undefined },
    { type: 'bin', step: 10, field: 'end', as: ['b0', 'b1'] },
    {
      type: 'aggregate',
      groupby: ['start', 'end'],
      ops: [
        { op: 'count', field: undefined, as: undefined },
        { op: 'mean', field: 'twice', as: 'm' },
      ],
    },
    { type: 'coverage', as: undefined },
    { type: 'coverage', as: 'depth' },
    { type: 'flatten', field: undefined, index: undefined },
    { type: 'flatten', field: 'exons', index: 'nth' },
    {
      type: 'stack',
      as: undefined,
      fields: undefined,
      padding: undefined,
      groupby: undefined,
    },
    {
      type: 'stack',
      as: 'lane',
      fields: ['s', 'e'],
      padding: 20,
      groupby: ['sample'],
    },
  ])
  expect(layers[1]).not.toHaveProperty('transform')
})

test('a mark outside its zoom range leaves the shared domain and the legend', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' }, maxBpPerPx: 4 },
    {
      shape: 'bar',
      encoding: { y: 'count', color: { field: 'type', scale: 'categorical' } },
      minBpPerPx: 4,
    },
  ])
  const { display, view } = createDisplay()
  display.setRpcData(
    0,
    result([
      { y: [3, 8] },
      {
        y: [500, 900],
        scale: {
          kind: 'categorical',
          field: 'type',
          entries: [{ label: 'gene', color: 0xff0000ff }],
        },
      },
    ]),
    REGION,
  )
  view.zoomTo(2)
  expect(display.markVisible).toEqual([true, false])
  expect(display.domain).toEqual([0, 8])
  expect(display.legendSections).toEqual([])
  expect(display.renderState.bpPerPx).toBe(2)
  view.zoomTo(8)
  expect(display.markVisible).toEqual([false, true])
  expect(display.domain).toEqual([0, 900])
  expect(display.legendSections.map(s => s.markIndex)).toEqual([1])
})

test('the legend reads the scale table the worker resolved', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: { y: 'score', color: { field: 'type', scale: 'categorical' } },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result([
      {
        y: [1],
        scale: {
          kind: 'categorical',
          field: 'type',
          entries: [{ label: 'gene', color: 0xff0000ff }],
        },
      },
    ]),
    REGION,
  )
  expect(display.legendSections).toEqual([
    {
      markIndex: 0,
      channel: 'color',
      scale: {
        kind: 'categorical',
        field: 'type',
        entries: [{ label: 'gene', color: 0xff0000ff }],
      },
    },
  ])
  expect(display.showLegend).toBe(true)
})

test('a glyph scale reaches the worker beside the colour, and its key draws the glyphs', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'point',
      encoding: {
        y: 'score',
        color: 'red',
        glyph: {
          field: 'strand',
          scale: 'categorical',
          domain: [1, -1],
          range: ['triangle', 'diamond'],
        },
      },
    },
  ])
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]?.encoding.glyph).toEqual({
    field: 'strand',
    scale: 'categorical',
    domain: ['1', '-1'],
    range: ['triangle', 'diamond'],
  })
  display.setRpcData(
    0,
    result([
      {
        y: [1, 2],
        glyphScale: {
          kind: 'glyph',
          field: 'strand',
          entries: [
            { label: '1', glyph: 'triangle' },
            { label: '-1', glyph: 'diamond' },
          ],
        },
      },
    ]),
    REGION,
  )
  expect(display.legendSections).toEqual([
    {
      markIndex: 0,
      channel: 'glyph',
      scale: {
        kind: 'glyph',
        field: 'strand',
        entries: [
          { label: '1', glyph: 'triangle' },
          { label: '-1', glyph: 'diamond' },
        ],
      },
    },
  ])
  expect(display.colorScales).toEqual([
    {
      kind: 'categorical',
      id: 'mark-0-glyph',
      title: 'strand',
      entries: [
        {
          value: '1',
          label: '1',
          swatches: [{ color: 'currentColor', glyph: 'triangle' }],
        },
        {
          value: '-1',
          label: '-1',
          swatches: [{ color: 'currentColor', glyph: 'diamond' }],
        },
      ],
    },
  ])
})

test('the hovered instance lights the box its shape painted, inset by the plot top', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'span', encoding: { row: 'sampleIndex' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [0, 0], row: [0, 1] }]), REGION)
  expect(display.hoverInk).toEqual([])
  display.setHoveredFeature({
    markIndex: 0,
    regionIndex: 0,
    instance: 1,
    refName: 'ctgA',
    start: 100,
    end: 150,
    y: undefined,
    color: undefined,
    colorValue: undefined,
    screenX: 0,
    screenY: 0,
  })
  const [box] = display.hoverInk
  const block = display.renderBlocks[0]!
  const pxPerBp = (block.screenEndPx - block.screenStartPx) / 10_000
  expect(box!.left).toBeCloseTo(block.screenStartPx + 100 * pxPerBp)
  expect(box!.width).toBeCloseTo(50 * pxPerBp)
  expect(box!.height).toBe(display.renderState.canvasHeight / 2)
  expect(box!.top).toBeGreaterThan(display.renderState.canvasHeight / 2)
  display.clearHoveredFeature()
  expect(display.hoverInk).toEqual([])
})

function onlyGetFeatures(mock: jest.Mock, reply: () => unknown) {
  mock.mockImplementation((_sessionId: string, method: string) => {
    if (method === 'CoreGetFeatures') {
      return reply()
    }
    return new Promise(() => {})
  })
}

function hitAt(markIndex: number, start: number, end: number) {
  return {
    markIndex,
    regionIndex: 0,
    instance: 0,
    refName: 'ctgA',
    start,
    end,
    y: undefined,
    color: undefined,
    colorValue: undefined,
    screenX: 0,
    screenY: 0,
  }
}

function feature(id: string, start: number, end: number, score = 1) {
  return new SimpleFeature({ uniqueId: id, refName: 'ctgA', start, end, score })
}

const DENSITY_MARKS = [
  { shape: 'bar', encoding: { y: 'score' } },
  {
    shape: 'bar',
    transform: [
      { type: 'filter', expr: "jexl:get(feature,'score') > 0" },
      { type: 'bin', step: 1000 },
      {
        type: 'aggregate',
        groupby: ['start', 'end'],
        ops: [{ op: 'count' }, { op: 'sum', field: 'score' }],
      },
    ],
    encoding: { y: 'count' },
  },
  {
    shape: 'bar',
    transform: [{ type: 'coverage' }],
    encoding: { y: 'coverage' },
  },
]

test('a click on a raw mark opens the feature the hit spans', async () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, session, mockRpcCall } = createDisplay()
  onlyGetFeatures(mockRpcCall, () => [
    feature('a', 1000, 1400),
    feature('b', 1200, 1700),
  ])
  display.selectFeature(hitAt(0, 1200, 1700))
  await waitFor(() => {
    expect(session.openedWidgets).toHaveLength(1)
  })
  expect(session.openedWidgets[0]!.featureData).toMatchObject({
    uniqueId: 'b',
    start: 1200,
    end: 1700,
  })
})

test('a click on a binned bar opens the bin the mark made, through its own steps', async () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, session, mockRpcCall } = createDisplay()
  onlyGetFeatures(mockRpcCall, () => [
    feature('a', 1000, 1400, 3),
    feature('b', 1200, 1700, 4),
    feature('c', 1900, 2100, 0),
    feature('d', 900, 1100, 5),
  ])
  display.selectFeature(hitAt(1, 1000, 2000))
  await waitFor(() => {
    expect(session.openedWidgets).toHaveLength(1)
  })
  expect(session.openedWidgets[0]!.featureData).toEqual({
    uniqueId: 'ctgA:1000-2000#0',
    refName: 'ctgA',
    start: 1000,
    end: 2000,
    count: 2,
    sum_score: 7,
  })
})

test('a click on a coverage run matches the run the narrower read-back remakes', async () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, session, mockRpcCall } = createDisplay()
  onlyGetFeatures(mockRpcCall, () => [feature('a', 0, 100)])
  display.selectFeature(hitAt(2, 0, 50))
  await waitFor(() => {
    expect(session.openedWidgets).toHaveLength(1)
  })
  expect(session.openedWidgets[0]!.featureData).toMatchObject({
    start: 0,
    end: 100,
    coverage: 1,
  })
})
