import { createElement } from 'react'

import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { MAX_GROUPS, OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import { DEFAULT_MARK_COLOR } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { YSCALEBAR_LABEL_OFFSET, axisPlotBox } from '@jbrowse/display-ui'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'
import { pointInsetPx } from '@jbrowse/render-core/marks'
import { makePinCurrentRangeItem } from '@jbrowse/wiggle-core'
import { render, screen, waitFor } from '@testing-library/react'

import MarkFacetChips from './components/MarkFacetChips.tsx'
import { configSchemaFactory } from './configSchema.ts'
import { stateModelFactory } from './model.ts'
import { BINNED_BP_PER_PX, defaultPlotMarks } from './plotFields.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { EncodedFeaturesResult } from '@jbrowse/core/util/markEncoding'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

const WIDE_REGION = {
  refName: 'ctgA',
  start: 0,
  end: 8_000_000,
  assemblyName: 'volvox',
}

function createTestEnvironment(
  marks: unknown[],
  region = REGION,
  adapterType = 'BedAdapter',
  display: Record<string, unknown> = {},
) {
  return createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: adapterType, config: { type: adapterType } },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: { marks, ...display },
    regions: [region],
    assemblyRegions: [region],
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
    color?: number[]
    scale?: Layer['scale']
    glyphScale?: Layer['glyphScale']
  }[],
  facet?: EncodedFeaturesResult['facet'],
): EncodedFeaturesResult {
  return {
    facet,
    layers: layers.map(({ y, row, color, scale, glyphScale }) => ({
      count: y.length,
      skipped: 0,
      x: Uint32Array.from(y.map((_, i) => i * 100)),
      x2: Uint32Array.from(y.map((_, i) => i * 100 + 50)),
      y: Float32Array.from(y),
      row: row ? Uint32Array.from(row) : undefined,
      color: color ? Uint32Array.from(color) : new Uint32Array(y.length),
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
        lanes: ['y', 'row', 'color', 'colorValue', 'index'],
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
        lanes: ['y', 'row', 'color', 'colorValue', 'glyph', 'index'],
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

test("the display's y scale is the axis: its type and its pinned ends", () => {
  const { createDisplay } = createTestEnvironment(
    [{ shape: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { type: 'log', domainMin: 1, domainMax: 1000 } } },
  )
  const { display } = createDisplay()
  expect(display.scaleType).toBe('log')
  expect(display.minScoreBound).toBe(1)
  expect(display.maxScoreBound).toBe(1000)
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(display.domain).toEqual([1, 1000])
  expect(display.valueScales[0]!.scaleType).toBe('log')
  expect(display.renderState.scaleTypeY).toBe('log')
})

test('nothing declared is the linear autoscaled form it always was', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.scaleType).toBe('linear')
  expect(display.hasManualScoreBounds).toBe(false)
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(display.domain).toEqual([0, 8])
})

// The modes the display gained with the shared factory. A spiky distribution
// is what tells them apart: `local` spends the whole axis on the one outlier,
// `localpercentile` clips it and leaves the baseline readable.
test('the autoscale mode scales.y names is the one the domain takes', () => {
  const spiky = [...Array.from({ length: 99 }, () => 2), 1000]
  const local = createTestEnvironment(
    [{ shape: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { autoscale: 'local' } } },
  ).createDisplay().display
  local.setRpcData(0, result([{ y: spiky }]), REGION)
  expect(local.domain![1]).toBe(1000)

  const clipped = createTestEnvironment(
    [{ shape: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { autoscale: 'localpercentile' } } },
  ).createDisplay().display
  clipped.setRpcData(0, result([{ y: spiky }]), REGION)
  expect(clipped.domain![1]).toBeLessThan(10)
})

// Both radios derive from `scales.y` now: two scale types declared, and an
// autoscale member present.
test('the score menu offers the scale-type and autoscale radios', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.scaleTypeChoices).toEqual(['linear', 'log'])
  const score = display
    .trackMenuItems()
    .find(item => 'subMenu' in item && item.label === 'Score')!
  const rows =
    'subMenu' in score
      ? resolveSubMenu(score).map(i => ('label' in i ? i.label : ''))
      : []
  expect(rows).toContain('Scale type')
  expect(rows).toContain('Autoscale type')
})

test('one end of the declared domain pins and the other autoscales', () => {
  const { createDisplay } = createTestEnvironment(
    [{ shape: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { domainMax: 50 } } },
  )
  const { display } = createDisplay()
  expect(display.minScoreBound).toBeUndefined()
  expect(display.maxScoreBound).toBe(50)
})

test("pinning the current range lands on the display's scale", () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 40] }]), REGION)
  const drawn = display.domain!
  expect(drawn[1]).toBeGreaterThanOrEqual(40)
  makePinCurrentRangeItem(display, drawn).onClick()
  expect([
    display.conf.scales.y.domainMin,
    display.conf.scales.y.domainMax,
  ]).toEqual(drawn)
  expect(display.hasManualScoreBounds).toBe(true)
})

test('the score menu edits scales.y, the one place the axis is written', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
    { shape: 'point', encoding: { y: 'other' } },
  ])
  const { display } = createDisplay()
  display.setMaxScore(200)
  expect(display.conf.scales.y.domainMax).toBe(200)
  expect(display.maxScoreBound).toBe(200)
  display.setScaleType('log')
  expect(display.conf.scales.y.type).toBe('log')
  expect(display.scaleType).toBe('log')
  display.setMaxScore(undefined)
  expect(display.conf.scales.y.domainMax).toBeUndefined()
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

// Two marks measuring two quantities is two plots, not two axes: the display
// declares one scale and every drawing mark folds into it.
test('two valued marks share the one axis, whatever they measure', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
    { shape: 'point', encoding: { y: 'coverage' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [200, 900] }]), REGION)
  expect(display.domain).toEqual([0, 900])
  expect(display.renderState.domainY).toEqual([0, 900])
  expect(display.valueScales).toHaveLength(1)
  const [only] = display.valueScales
  expect(only).toMatchObject({ domain: [0, 900] })
  expect(only!.side).toBeUndefined()
  expect(only!.caption).toBeUndefined()
  expect(display.axes.map(a => a.side)).toEqual([undefined])
})

// The encoder reads a missing y as 0 for every feature, so before this a
// bar with only a colour was an empty track with no message.
test('a bar or point naming no y is refused where the config is read', () => {
  expect(() =>
    createTestEnvironment([
      { shape: 'bar', encoding: { color: 'red' } },
    ]).createDisplay(),
  ).toThrow(/a bar or point stands at a value and needs encoding.y/)
  expect(() =>
    createTestEnvironment([
      { shape: 'point', encoding: { y: '' } },
    ]).createDisplay(),
  ).toThrow(/mark 0 \(point\) names none/)
  expect(() =>
    createTestEnvironment([{ shape: 'span', encoding: {} }]).createDisplay(),
  ).not.toThrow()
})

test('an encoding channel refuses a key it does not declare', () => {
  expect(() =>
    createTestEnvironment([
      { shape: 'span', encoding: { color: { colour: 'strand' } } },
    ]).createDisplay(),
  ).toThrow(
    'MarkColor takes value, field, scale, domain, palette, ramp and domainMid, not colour',
  )
  expect(() =>
    createTestEnvironment([
      { shape: 'point', encoding: { y: 'score', glyph: { shape: 'disc' } } },
    ]).createDisplay(),
  ).toThrow('MarkGlyph takes value, field, scale, range and domain, not shape')
  expect(() =>
    createTestEnvironment(
      [{ shape: 'bar', encoding: { y: 'score' } }],
      REGION,
      'BedAdapter',
      { scales: { y: { min: 0 } } },
    ).createDisplay(),
  ).toThrow(
    'ValueScale takes type, domainMin, domainMax, autoscale, numStdDev and numQuantile, not min',
  )
})

// A span's ramp resolves in the worker (ADR-113), one table per region, under
// a legend that unions their extents.
test('a span painting an unpinned colour ramp is refused, and a pinned one is not', () => {
  expect(() =>
    createTestEnvironment([
      {
        shape: 'span',
        encoding: { color: { field: 'score', scale: 'linear' } },
      },
    ]).createDisplay(),
  ).toThrow(/mark 0 leaves encoding.color.domain short or open/)
  expect(() =>
    createTestEnvironment([
      {
        shape: 'span',
        encoding: { color: { field: 'score', ramp: ['white', 'red'] } },
      },
    ]).createDisplay(),
  ).toThrow(/mark 0 leaves encoding.color.domain short or open/)
  expect(() =>
    createTestEnvironment([
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
    ]).createDisplay(),
  ).not.toThrow()
})

test('a channel the shape does not read is refused where the config is read', () => {
  expect(() =>
    createTestEnvironment([
      { shape: 'span', encoding: { y: 'score' } },
    ]).createDisplay(),
  ).toThrow(
    /mark 0 \(span\) declares encoding.y, which its shape does not read/,
  )
  expect(() =>
    createTestEnvironment([
      { shape: 'bar', encoding: { y: 'score', glyph: 'triangle' } },
    ]).createDisplay(),
  ).toThrow(
    /mark 0 \(bar\) declares encoding.glyph, which its shape does not read/,
  )
  expect(() =>
    createTestEnvironment([
      { shape: 'span', source: 'density', encoding: {} },
    ]).createDisplay(),
  ).toThrow(/mark 0 \(span\) declares source "density"/)
  expect(() =>
    createTestEnvironment([
      { shape: 'point', encoding: { y: 'score', glyph: 'triangle' } },
    ]).createDisplay(),
  ).not.toThrow()
})

test('a mistyped key on a mark, a step or an op is refused where the config is read', () => {
  expect(() =>
    createTestEnvironment([
      { shape: 'bar', encoding: { y: 'score' }, transforms: [] },
    ]).createDisplay(),
  ).toThrow(/Mark takes .* not transforms/)
  expect(() =>
    createTestEnvironment([
      {
        shape: 'bar',
        encoding: { y: 'count' },
        transform: [{ type: 'aggregate', groupBy: ['type'] }],
      },
    ]).createDisplay(),
  ).toThrow(/MarkTransformStep takes .* not groupBy/)
  expect(() =>
    createTestEnvironment([
      {
        shape: 'bar',
        encoding: { y: 'mean_score' },
        transform: [
          { type: 'aggregate', ops: [{ op: 'mean', fields: 'score' }] },
        ],
      },
    ]).createDisplay(),
  ).toThrow(/MarkAggregateOp takes .* not fields/)
})

// `encodingOf` maps the ramp's domain through `Number`, so an empty entry pins
// that end to 0 rather than autoscaling it the way `y.domain` does.
test('a colour ramp domain with an open end is refused where the config is read', () => {
  expect(() =>
    createTestEnvironment([
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'score', scale: 'linear', domain: ['0', ''] },
        },
      },
    ]).createDisplay(),
  ).toThrow(/mark 0 leaves encoding.color.domain short or open/)
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

test('a span outside its zoom range adds no bands', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'span', encoding: { row: 'sampleIndex' }, minBpPerPx: 4 },
    { shape: 'span', encoding: {} },
  ])
  const { display, view } = createDisplay()
  display.setRpcData(
    0,
    result([{ y: [0, 0, 0], row: [0, 2, 1] }, { y: [0] }]),
    REGION,
  )
  view.zoomTo(2)
  expect(display.rowCount).toBe(1)
  view.zoomTo(8)
  expect(display.rowCount).toBe(3)
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
        { type: 'stack', as: 'lane', fields: ['s', 'e'], padding: 20 },
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
    { type: 'stack', as: undefined, fields: undefined, padding: undefined },
    { type: 'stack', as: 'lane', fields: ['s', 'e'], padding: 20 },
  ])
  expect(layers[1]).not.toHaveProperty('transform')
})

// Each of these is a restatement a config author had to write out, and each
// has one answer the step or the channel beside it already knows.
test('a bin hands its edges to the aggregate behind it, and a stack its rows to the encoding', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      transform: [
        { type: 'bin', step: 5000 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      encoding: { y: 'count' },
    },
    {
      shape: 'bar',
      transform: [
        { type: 'bin', step: 5000, as: ['lo', 'hi'] },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      encoding: { y: 'count' },
    },
    {
      shape: 'bar',
      transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
      encoding: { y: 'count' },
    },
    { shape: 'span', transform: [{ type: 'stack' }], encoding: {} },
    {
      shape: 'span',
      transform: [{ type: 'stack', as: 'lane' }],
      encoding: {},
    },
    { shape: 'span', encoding: {} },
  ])
  const { display } = createDisplay()
  const { layers } = display.rpcProps()
  const groupbyOf = (i: number) =>
    (layers[i]!.transform![1] as { groupby: string[] }).groupby
  expect(groupbyOf(0)).toEqual(['start', 'end'])
  expect(groupbyOf(1)).toEqual(['lo', 'hi'])
  // with no bin in front, an empty groupby still folds the whole region
  expect((layers[2]!.transform![0] as { groupby: string[] }).groupby).toEqual(
    [],
  )
  expect(layers[3]!.encoding.row).toBe('row')
  expect(layers[4]!.encoding.row).toBe('lane')
  expect(layers[5]!.encoding.row).toBeUndefined()
})

test('a flatten keeping its empty features says so on the wire', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'span',
      transform: [
        { type: 'flatten', keepEmpty: true },
        { type: 'flatten', field: 'exons' },
      ],
      encoding: {},
    },
  ])
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]!.transform).toEqual([
    {
      type: 'flatten',
      field: undefined,
      index: undefined,
      keepEmpty: true,
    },
    {
      type: 'flatten',
      field: 'exons',
      index: undefined,
      keepEmpty: undefined,
    },
  ])
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
          domain: [],
          entries: [{ value: 'gene', color: 0xff0000ff }],
        },
      },
    ]),
    REGION,
  )
  view.zoomTo(2)
  expect(display.markView.visible).toEqual([true, false])
  expect(display.domain).toEqual([0, 8])
  expect(display.legendSections).toEqual([])
  expect(display.renderState.bpPerPx).toBe(2)
  view.zoomTo(8)
  expect(display.markView.visible).toEqual([false, true])
  expect(display.domain).toEqual([0, 900])
  expect(display.legendSections.flatMap(s => s.markIndexes)).toEqual([1])
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
          domain: [],
          entries: [{ value: 'gene', color: 0xff0000ff }],
        },
      },
    ]),
    REGION,
  )
  expect(display.legendSections).toEqual([
    {
      markIndexes: [0],
      channel: 'color',
      scale: {
        kind: 'categorical',
        field: 'type',
        domain: [],
        entries: [{ value: 'gene', color: 0xff0000ff }],
      },
    },
  ])
  expect(display.showLegend).toBe(true)
})

// Two marks over one field through one declaration paint a value alike, so
// two keys listing the same rows said it twice.
test('two marks colouring by one field through one palette share a key', () => {
  const strandTable = (
    entries: { value: string; color: number }[],
    palette?: string[],
  ): Layer['scale'] => ({
    kind: 'categorical',
    field: 'strand',
    domain: [],
    ...(palette ? { palette } : {}),
    entries,
  })
  const marks = [
    {
      shape: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical' },
      },
    },
    {
      shape: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical' },
      },
    },
  ]
  const shared = createTestEnvironment(marks).createDisplay().display
  shared.setRpcData(
    0,
    result([
      { y: [1], scale: strandTable([{ value: '1', color: 0xff0000ff }]) },
      { y: [2], scale: strandTable([{ value: '-1', color: 0xff00ff00 }]) },
    ]),
    REGION,
  )
  expect(shared.legendSections).toEqual([
    {
      markIndexes: [0, 1],
      channel: 'color',
      scale: strandTable([
        { value: '1', color: 0xff0000ff },
        { value: '-1', color: 0xff00ff00 },
      ]),
    },
  ])
  expect(shared.colorScales.map(s => s.id)).toEqual(['mark-0-1-color'])

  const apart = createTestEnvironment(marks).createDisplay().display
  apart.setRpcData(
    0,
    result([
      {
        y: [1],
        scale: strandTable([{ value: '1', color: 0xff0000ff }], ['red']),
      },
      {
        y: [2],
        scale: strandTable([{ value: '1', color: 0xff0000ff }], ['blue']),
      },
    ]),
    REGION,
  )
  expect(apart.colorScales.map(s => s.id)).toEqual([
    'mark-0-color',
    'mark-1-color',
  ])
})

// Colour and glyph over one field listed the same values twice under one
// title, and on a short display the second key ran past the bottom edge.
test('a glyph scale over the field the colour classifies folds into one key', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'point',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical' },
        glyph: { field: 'strand', scale: 'categorical' },
      },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result([
      {
        y: [1, 2],
        scale: {
          kind: 'categorical',
          field: 'strand',
          domain: [],
          entries: [
            { value: '1', color: 0xff0000ff },
            { value: '-1', color: 0xff00ff00 },
          ],
        },
        glyphScale: {
          kind: 'glyph',
          field: 'strand',
          domain: [],
          entries: [
            { value: '1', glyph: 'triangle' },
            { value: '-1', glyph: 'diamond' },
          ],
        },
      },
    ]),
    REGION,
  )
  expect(display.legendSections).toHaveLength(2)
  expect(display.colorScales).toEqual([
    {
      kind: 'categorical',
      id: 'mark-0-color',
      title: 'strand',
      entries: [
        {
          value: '1',
          label: 'Forward strand',
          swatches: [{ color: 'rgba(255,0,0,1)', glyph: 'triangle' }],
        },
        {
          value: '-1',
          label: 'Reverse strand',
          swatches: [{ color: 'rgba(0,255,0,1)', glyph: 'diamond' }],
        },
      ],
    },
  ])
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
          domain: [],
          entries: [
            { value: '1', glyph: 'triangle' },
            { value: '-1', glyph: 'diamond' },
          ],
        },
      },
    ]),
    REGION,
  )
  expect(display.legendSections).toEqual([
    {
      markIndexes: [0],
      channel: 'glyph',
      scale: {
        kind: 'glyph',
        field: 'strand',
        domain: [],
        entries: [
          { value: '1', glyph: 'triangle' },
          { value: '-1', glyph: 'diamond' },
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
          label: 'Forward strand',
          swatches: [{ color: 'currentColor', glyph: 'triangle' }],
        },
        {
          value: '-1',
          label: 'Reverse strand',
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
    glyph: undefined,
    row: undefined,
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
    glyph: undefined,
    row: undefined,
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

test('the read-back reads at the zoom the hit was drawn at', async () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, view, session, mockRpcCall } = createDisplay()
  onlyGetFeatures(mockRpcCall, () => [feature('a', 1200, 1700)])
  view.zoomTo(37)
  display.selectFeature(hitAt(0, 1200, 1700))
  await waitFor(() => {
    expect(session.openedWidgets).toHaveLength(1)
  })
  const [, , args] = mockRpcCall.mock.calls.find(
    ([, method]) => method === 'CoreGetFeatures',
  )!
  expect(args).toMatchObject({ opts: { bpPerPx: view.bpPerPx } })
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

const AUTO_BIN_MARKS = [
  {
    shape: 'bar',
    transform: [
      { type: 'bin', step: 'auto' },
      { type: 'aggregate', groupby: ['start', 'end'], ops: [{ op: 'count' }] },
    ],
    encoding: { y: 'count' },
  },
]

test('an auto bin resolves to the 1/2/5 rung above four pixels of bp', () => {
  const { createDisplay } = createTestEnvironment(AUTO_BIN_MARKS, WIDE_REGION)
  const { display, view } = createDisplay()
  const stepAt = (bpPerPx: number) => {
    view.zoomTo(bpPerPx)
    const [step] = display.rpcProps().layers[0]!.transform!
    return (step as { step: number }).step
  }
  expect(stepAt(0.5)).toBe(2)
  expect(stepAt(1)).toBe(5)
  expect(stepAt(2)).toBe(10)
  expect(stepAt(4)).toBe(20)
  expect(stepAt(10)).toBe(50)
  expect(stepAt(1000)).toBe(5000)
})

test('a zoom sweep over a BigWig refetches once per tier, not once per step', () => {
  const { createDisplay } = createTestEnvironment(
    [{ shape: 'bar', encoding: { y: 'score' } }],
    WIDE_REGION,
    'BigWigAdapter',
  )
  const { display, view } = createDisplay()
  // tiers 4x apart, as a BigWig writes them; bbi picks the finest whose
  // reduction fits twice into a pixel
  const levels = [4, 16, 64, 256, 1024, 4096]
  const tierAt = (bpPerPx: number) =>
    levels.filter(l => l <= 2 * bpPerPx).length
  let fetches = 0
  const tiers = new Set<number>()
  let bpPerPx = 1
  for (let i = 0; i < 64; i++) {
    view.zoomTo(bpPerPx)
    const tier = tierAt(view.bpPerPx)
    tiers.add(tier)
    if (!display.isCacheValid(0)) {
      fetches++
      display.setRpcData(
        0,
        {
          ...result([{ y: [1, 2] }]),
          zoomRange: {
            minBpPerPx: tier === 0 ? 0 : levels[tier - 1]! / 2,
            maxBpPerPx: tier === levels.length ? Infinity : levels[tier]! / 2,
          },
        },
        WIDE_REGION,
      )
    }
    bpPerPx *= 1.125
  }
  // 64 steps of 1.125x, 1 to 1,600 bp/px, touch six tiers
  expect(tiers.size).toBe(6)
  expect(fetches).toBe(6)
})

test('a payload without a zoom range is never refetched for a zoom', () => {
  const { createDisplay } = createTestEnvironment(AUTO_BIN_MARKS, WIDE_REGION)
  const { display, view } = createDisplay()
  view.zoomTo(1)
  display.setRpcData(0, result([{ y: [1, 2] }]), WIDE_REGION)
  view.zoomTo(1000)
  expect(display.regionHasData(0)).toBe(true)
})

test('a fixed bin width ignores the zoom, and its fetch key with it', () => {
  const { createDisplay } = createTestEnvironment(
    [
      {
        shape: 'bar',
        transform: [{ type: 'bin', step: 5000 }],
        encoding: { y: 'count' },
      },
    ],
    WIDE_REGION,
  )
  const { display, view } = createDisplay()
  view.zoomTo(1)
  const key = display.settingsFetchInputs
  view.zoomTo(1000)
  expect(display.settingsFetchInputs).toEqual(key)
  expect(display.rpcProps().layers[0]!.transform![0]).toMatchObject({
    step: 5000,
  })
})

test('a point-only axis is inset by the glyph room the shape draws in', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'point', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  const inset = pointInsetPx(display.scatterPointSize)
  expect(inset).toBeGreaterThan(0)
  expect(display.valueScales[0]!.offset).toBe(YSCALEBAR_LABEL_OFFSET + inset)
  expect(display.renderState.valueInsetPx).toBe(inset)
  const [axis] = display.axes
  expect(axis!.ticks.yTop).toBe(YSCALEBAR_LABEL_OFFSET + inset)
  expect(axis!.ticks.yBottom).toBe(
    display.height - YSCALEBAR_LABEL_OFFSET - inset,
  )
})

test('a bar sharing the axis keeps it on the plot box, where a bar top is drawn', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
    { shape: 'point', encoding: { y: 'other' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [12, 20] }]), REGION)
  expect(display.valueScales[0]!.offset).toBe(YSCALEBAR_LABEL_OFFSET)
  // the point reads the same box, so a point and a bar top at one value meet
  expect(display.renderState.valueInsetPx).toBe(0)
})

const FACET_MARKS = [
  { shape: 'span', transform: [{ type: 'stack' }], encoding: { row: 'row' } },
]

function facetedEnvironment(display: Record<string, unknown> = {}) {
  return createTestEnvironment(FACET_MARKS, REGION, 'BedAdapter', {
    facet: 'sample',
    ...display,
  })
}

// Two sections the worker stacked: 'a' on row 0, 'b' on rows 1 and 2.
function facetResult(rows: number[]) {
  return result(
    [{ y: rows.map(() => 0), row: rows }],
    [
      { key: 'a', firstRow: 0, rowCount: 1 },
      { key: 'b', firstRow: 1, rowCount: 2 },
    ],
  )
}

function rowsOf(display: LinearMarkDisplayModel, region = 0) {
  return [...(display.rpcDataMap.get(region)!.layers[0]!.row ?? [])]
}

test('bars faceted by a field stand in a band each, the axis ruling every band', () => {
  const { createDisplay } = createTestEnvironment(
    [{ shape: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { facet: 'source' },
  )
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]!.lanes).toContain('row')
  expect(display.rpcProps().facet).toEqual({ field: 'source' })
  display.setRpcData(
    0,
    result(
      [{ y: [3, 8, 5], row: [0, 1, 2] }],
      [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
        { key: 'c', firstRow: 2, rowCount: 1 },
      ],
    ),
    REGION,
  )
  expect(display.rowCount).toBe(3)
  const { plotHeight, yTop } = axisPlotBox(display.height)
  const rowHeight = Math.floor(plotHeight / 3)
  expect(display.renderState.rowCount).toBe(3)
  const [axis] = display.valueScales
  expect(axis).toMatchObject({
    height: rowHeight,
    offset: 0,
    bandTops: [yTop, yTop + rowHeight, yTop + 2 * rowHeight],
  })
  // the one-row display keeps the plot box as its axis
  const single = createTestEnvironment([
    { shape: 'bar', encoding: { y: 'score' } },
  ]).createDisplay().display
  single.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(single.valueScales[0]).toMatchObject({
    height: single.height,
    offset: YSCALEBAR_LABEL_OFFSET,
  })
  expect(single.valueScales[0]!.bandTops).toBeUndefined()
})

test('the facet reaches the worker on the request, and the sections band the plot', () => {
  const { display } = facetedEnvironment().createDisplay()
  expect(display.facet?.field).toBe('sample')
  expect(display.rpcProps().facet).toEqual({ field: 'sample' })
  display.setRpcData(0, facetResult([0, 1, 2]), REGION)
  expect(display.facetLayout).toMatchObject({
    sections: [
      { key: 'a', label: 'sample: a', firstRow: 0, rowCount: 1 },
      { key: 'b', label: 'sample: b', firstRow: 1, rowCount: 2 },
    ],
    rowCount: 3,
  })
  expect(display.rowCount).toBe(3)
  expect(rowsOf(display)).toEqual([0, 1, 2])
})

test('a display transform runs before the facet splits the features', () => {
  const { display } = facetedEnvironment({
    facet: 'nm',
    transform: [
      { type: 'formula', expr: "jexl:getTag(feature,'NM')", as: 'nm' },
    ],
  }).createDisplay()
  expect(display.rpcProps()).toMatchObject({
    transform: [
      { type: 'formula', expr: "jexl:getTag(feature,'NM')", as: 'nm' },
    ],
    facet: { field: 'nm' },
  })
})

test('a facet domain orders the folded sections and stays off the worker request', () => {
  const { display } = facetedEnvironment({
    facet: { field: 'sample', domain: ['b'] },
  }).createDisplay()
  expect(display.rpcProps().facet).toEqual({ field: 'sample' })
  display.setRpcData(0, facetResult([0, 1, 2]), REGION)
  expect(display.facetLayout).toMatchObject({
    sections: [
      { key: 'b', label: 'sample: b', firstRow: 0, rowCount: 2 },
      { key: 'a', label: 'sample: a', firstRow: 2, rowCount: 1 },
    ],
    rowCount: 3,
  })
  expect(rowsOf(display)).toEqual([2, 0, 1])
})

test('the Sections menu moves a section and writes the drawn order as the facet domain', () => {
  const { display } = facetedEnvironment().createDisplay()
  const sectionsItem = () =>
    display.trackMenuItems().find(i => 'label' in i && i.label === 'Sections')
  expect(sectionsItem()).toBeUndefined()
  display.setRpcData(0, facetResult([0, 1, 2]), REGION)
  const rows = () =>
    resolveSubMenu(sectionsItem() as Parameters<typeof resolveSubMenu>[0])
  expect(rows().map(r => ('label' in r ? r.label : undefined))).toEqual([
    'sample: a',
    'sample: b',
    'Reset section order',
  ])
  const fetched = display.rpcProps()
  const first = rows()[0] as Parameters<typeof resolveSubMenu>[0]
  ;(resolveSubMenu(first)[1] as { onClick: () => void }).onClick()
  expect(display.facet?.domain).toEqual(['b', 'a'])
  expect(display.rpcProps()).toEqual(fetched)
  expect(display.facetLayout.sections.map(s => s.key)).toEqual(['b', 'a'])
  ;(rows()[2] as { onClick: () => void }).onClick()
  expect(display.facet?.domain).toEqual([])
})

test('two regions fold into one row space, the deeper pack setting each band', () => {
  const { display } = facetedEnvironment().createDisplay()
  display.setRpcData(0, facetResult([0, 1, 2]), REGION)
  display.setRpcData(
    1,
    result(
      [{ y: [0, 0], row: [0, 1] }],
      [
        { key: 'a', firstRow: 0, rowCount: 2 },
        { key: 'b', firstRow: 2, rowCount: 1 },
      ],
    ),
    REGION,
  )
  expect(display.facetLayout.sections).toEqual([
    { key: 'a', label: 'sample: a', firstRow: 0, rowCount: 2 },
    { key: 'b', label: 'sample: b', firstRow: 2, rowCount: 2 },
  ])
  // Both regions are offset onto that one space, so region 0's 'b' rows move
  // down past the two rows region 1's 'a' needs.
  expect(rowsOf(display, 0)).toEqual([0, 2, 3])
  expect(rowsOf(display, 1)).toEqual([0, 1])
})

test('the cap reads every region, and the merged values keep bands of their own', () => {
  const { display } = facetedEnvironment().createDisplay()
  const keys = Array.from({ length: MAX_GROUPS + 1 }, (_, i) => `v${i}`)
  const table = (of: string[]) =>
    of.map((key, i) => ({ key, firstRow: i, rowCount: 1 }))
  display.setRpcData(
    0,
    result([{ y: keys.map(() => 0), row: keys.map((_, i) => i) }], table(keys)),
    REGION,
  )
  const tail = keys.slice(MAX_GROUPS - 1)
  display.setRpcData(
    1,
    result([{ y: [0, 0], row: [0, 1] }], table(tail)),
    REGION,
  )
  const { sections } = display.facetLayout
  expect(sections).toHaveLength(MAX_GROUPS)
  expect(sections.at(-1)).toEqual({
    key: OVERFLOW_GROUP_KEY,
    label: '2 merged values',
    firstRow: MAX_GROUPS - 1,
    rowCount: 2,
  })
  expect(rowsOf(display, 0).slice(-2)).toEqual([MAX_GROUPS - 1, MAX_GROUPS])
  expect(rowsOf(display, 1)).toEqual([MAX_GROUPS - 1, MAX_GROUPS])
})

test('hiding a section takes its instances out of the drawn layer and lifts the ones below it', () => {
  const { display } = facetedEnvironment().createDisplay()
  display.setRpcData(0, facetResult([0, 1, 2]), REGION)
  display.hideGroup('a')
  expect(display.facetLayout.sections.map(s => s.key)).toEqual(['b'])
  expect(display.rowCount).toBe(2)
  const [layer] = display.rpcDataMap.get(0)!.layers
  expect(layer!.count).toBe(2)
  expect([...layer!.featureIndex]).toEqual([1, 2])
  expect(rowsOf(display)).toEqual([0, 1])
  display.showAllGroups()
  expect(rowsOf(display)).toEqual([0, 1, 2])
})

test('a hidden section leaves the key and the axis the way it leaves the plot', () => {
  const { display } = createTestEnvironment(
    [
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'type', scale: 'categorical' },
        },
      },
    ],
    REGION,
    'BedAdapter',
    { facet: 'sample' },
  ).createDisplay()
  const RED = 0xff0000ff
  const BLUE = 0xffff0000
  display.setRpcData(
    0,
    result(
      [
        {
          y: [3, 90],
          row: [0, 1],
          color: [RED, BLUE],
          scale: {
            kind: 'categorical',
            field: 'type',
            domain: [],
            entries: [
              { value: 'exon', color: RED },
              { value: 'gene', color: BLUE },
            ],
          },
        },
      ],
      [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
      ],
    ),
    REGION,
  )
  const keyed = () =>
    display.colorScales.flatMap(c =>
      c.kind === 'categorical' ? c.entries.map(e => e.value) : [],
    )
  expect(keyed()).toEqual(['exon', 'gene'])
  expect(display.domain![1]).toBeGreaterThanOrEqual(90)
  display.hideGroup('b')
  expect(keyed()).toEqual(['exon'])
  expect(display.domain![1]).toBeLessThan(90)
})

test("a key over the facet's field follows the sections' order", () => {
  const { display } = createTestEnvironment(
    [
      {
        shape: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'sample', scale: 'categorical' },
        },
      },
    ],
    REGION,
    'BedAdapter',
    { facet: { field: 'sample', domain: ['b'] } },
  ).createDisplay()
  display.setRpcData(
    0,
    result(
      [
        {
          y: [1, 2],
          row: [0, 1],
          color: [1, 2],
          scale: {
            kind: 'categorical',
            field: 'sample',
            domain: [],
            entries: [
              { value: 'a', color: 1 },
              { value: 'b', color: 2 },
            ],
          },
        },
      ],
      [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
      ],
    ),
    REGION,
  )
  const keyed = () =>
    display.colorScales.flatMap(c =>
      c.kind === 'categorical' ? c.entries.map(e => e.value) : [],
    )
  expect(display.facetLayout.sections.map(s => s.key)).toEqual(['b', 'a'])
  expect(keyed()).toEqual(['b', 'a'])
  display.setFacetDomain(['a', 'b'])
  expect(keyed()).toEqual(['a', 'b'])
})

test('moving the facet field drops what was hidden, the keys having meant that field', () => {
  const { display } = facetedEnvironment().createDisplay()
  const before = display.groupKeySpace
  display.hideGroup('a')
  expect(display.hiddenGroups.size).toBe(1)
  display.setFacetField('type')
  expect(display.groupKeySpace).not.toBe(before)
  expect(display.hiddenGroups.size).toBe(0)
})

test('the chip row names each section at the top of the rows it labels', () => {
  const { display } = facetedEnvironment().createDisplay()
  display.setRpcData(0, facetResult([0, 1, 2]), REGION)
  render(createElement(MarkFacetChips, { model: display, plotHeight: 60 }))
  expect(
    screen.getAllByTestId('group-label-text').map(e => e.textContent),
  ).toEqual(['sample: a', 'sample: b'])
  expect(
    screen.getAllByTestId('group-label-chip').map(e => e.style.top),
  ).toEqual(['1px', '21px'])
})

test('nothing declared draws nothing, and the default rule is a bar of score', () => {
  const { createDisplay } = createTestEnvironment([])
  const { display } = createDisplay()
  expect(display.markShapes).toEqual([])
  expect(display.rpcProps().layers).toEqual([])
  display.conf.setSubschemaArray(
    'marks',
    defaultPlotMarks({ numeric: ['score'], categorical: ['name'] })!,
  )
  expect(display.markShapes).toEqual(['bar'])
  expect(display.rpcProps().layers[0]!.encoding.y).toBe('score')
})

test('the dialog submit writes the plot and its binned count into config', () => {
  const { createDisplay } = createTestEnvironment([])
  const { display } = createDisplay()
  display.setPlotFields({ numeric: ['score'], categorical: ['repClass'] })
  display.setPlotMarks({
    field: 'score',
    shape: 'point',
    colorField: 'repClass',
    binned: true,
  })
  expect(display.markShapes).toEqual(['point', 'bar'])
  expect(display.conf.marks[0]!.encoding.color.scale).toBe('categorical')
  expect(display.conf.marks[0]!.maxBpPerPx).toBe(BINNED_BP_PER_PX)
  expect(display.conf.marks[1]!.minBpPerPx).toBe(BINNED_BP_PER_PX)
  expect(
    display.conf.marks[1]!.transform.map((s: { type: string }) => s.type),
  ).toEqual(['bin', 'aggregate'])
  expect(display.plotSpec).toMatchObject({
    field: 'score',
    shape: 'point',
    colorField: 'repClass',
    binned: true,
  })
  expect(display.plotSpecReplaces).toBe(0)
})

// A config the dialog cannot read back is one a save would replace, and the
// dialog says so before it does.
test('a declared list the dialog cannot read counts as what a save replaces', () => {
  const { createDisplay } = createTestEnvironment([
    { shape: 'span', transform: [{ type: 'stack' }], encoding: {} },
    { shape: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.plotSpecReplaces).toBe(2)
})

// The dialog writes a colour object it did not author every member of, so a
// reopen and save has to hand the declared palette and order back.
test('a reopened plot keeps the colour domain, palette and ramp it was declared with', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'repClass',
          scale: 'categorical',
          domain: ['Alu', 'L1'],
          palette: ['red', 'blue'],
        },
      },
    },
  ])
  const { display } = createDisplay()
  display.setPlotFields({ numeric: ['score'], categorical: ['repClass'] })
  display.setPlotMarks(display.plotSpec)
  const { color } = display.conf.marks[0]!.encoding
  expect([...color.domain]).toEqual(['Alu', 'L1'])
  expect([...color.palette]).toEqual(['red', 'blue'])
})

test('a color or glyph naming a field and no scale reads it categorically, or through a ramp as linear', () => {
  const { createDisplay } = createTestEnvironment([
    {
      shape: 'point',
      encoding: {
        y: 'score',
        color: { field: 'source' },
        glyph: { field: 'type' },
      },
    },
    {
      shape: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'score', ramp: ['white', 'red'] },
      },
    },
  ])
  const { display } = createDisplay()
  expect(display.encodings[0]!.color).toMatchObject({
    field: 'source',
    scale: 'categorical',
  })
  expect(display.encodings[0]!.glyph).toMatchObject({
    field: 'type',
    scale: 'categorical',
  })
  expect(display.encodings[1]!.color).toMatchObject({
    field: 'score',
    scale: 'linear',
  })
})
