import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'

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
    filters: [],
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
        lanes: ['y', 'color', 'index'],
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
        lanes: ['y', 'color', 'glyph', 'index'],
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
