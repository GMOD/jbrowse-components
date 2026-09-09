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

function result(
  layers: {
    y: number[]
    scale?: Layer['scale']
    glyphScale?: Layer['glyphScale']
  }[],
): EncodedFeaturesResult {
  return {
    layers: layers.map(({ y, scale, glyphScale }) => ({
      count: y.length,
      x: Uint32Array.from(y.map((_, i) => i * 100)),
      x2: Uint32Array.from(y.map((_, i) => i * 100 + 50)),
      y: Float32Array.from(y),
      color: new Uint32Array(y.length),
      glyph: new Uint8Array(y.length),
      featureIndex: Uint32Array.from(y.map((_, i) => i)),
      yMin: Math.min(...y),
      yMax: Math.max(...y),
      flatbushData: undefined,
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
    encodings: [
      {
        x: 'start',
        x2: 'end',
        y: 'score',
        color: {
          field: 'strand',
          scale: 'categorical',
          palette: undefined,
          domain: ['1', '-1'],
        },
        glyph: 'disc',
      },
      {
        x: "jexl:get(feature,'thickStart')",
        x2: 'end',
        y: 'jexl:feature.score*2',
        color: "jexl:get(feature,'name')=='a'?'red':'blue'",
        glyph: 'triangle',
      },
      {
        x: 'start',
        x2: 'end',
        y: undefined,
        color: {
          field: 'score',
          scale: 'log',
          domain: [1, 1000],
          ramp: ['white', 'red'],
        },
        glyph: 'disc',
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
  display.setRpcData(0, result([{ y: [0, 0] }]), REGION)
  expect(display.domain).toBeUndefined()
  expect(display.rpcDataMap.get(0)?.layers[0]?.row).toEqual(new Uint32Array(2))
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
  expect(display.rpcProps().encodings[0]?.glyph).toEqual({
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
