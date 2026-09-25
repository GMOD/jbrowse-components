import { createElement } from 'react'

import {
  getConfigurationSchemaDefinition,
  getConfigurationSchemaUnion,
  isSlotDefinitionEntry,
  setConf,
} from '@jbrowse/core/configuration'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import { MAX_GROUPS, OVERFLOW_GROUP_KEY } from '@jbrowse/core/util/groupKeys'
import {
  DEFAULT_MARK_COLOR,
  NO_VALUE_ABGR,
  encodeFeatures,
} from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { thresholdPalette } from '@jbrowse/core/util/thresholdScale'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { YSCALEBAR_LABEL_OFFSET, axisPlotBox } from '@jbrowse/display-ui'
import { asArrayType, isType } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory,
} from '@jbrowse/plugin-linear-genome-view'
import WigglePlugin from '@jbrowse/plugin-wiggle'
import { LINK_NO_REGION, pointInsetPx } from '@jbrowse/render-core/marks'
import { makePinCurrentRangeItem } from '@jbrowse/wiggle-core'
import { render, screen, waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import MarkFacetChips from './components/MarkFacetChips.tsx'
import { configSchemaFactory } from './configSchema.ts'
import { markTransformStep } from './markTransformConfigSchema.ts'
import { stateModelFactory } from './model.ts'
import {
  BINNED_BP_PER_PX,
  EMPTY_PLOT_SPEC,
  defaultPlotMarks,
  plotMarks,
} from './plotFields.ts'
import { placeTextMarks } from './textMarks.ts'

import type { LinearMarkDisplayModel } from './model.ts'
import type { EncodedFeaturesResult } from '@jbrowse/core/util/markEncoding'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

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
  region: typeof REGION | (typeof REGION)[] = REGION,
  adapterType = 'BedAdapter',
  display: Record<string, unknown> = {},
  rpcCall?: (sessionId: string, method: string, args: unknown) => unknown,
) {
  const regions = Array.isArray(region) ? region : [region]
  return createDisplayTestEnvironment<LinearMarkDisplayModel>({
    plugins: [new LinearGenomeViewPlugin(), new WigglePlugin()],
    trackType: 'FeatureTrack',
    adapter: { name: adapterType, config: { type: adapterType } },
    displayName: 'LinearMarkDisplay',
    configSchema: () => configSchemaFactory(),
    stateModel: (pm, schema) => stateModelFactory(pm, schema),
    viewModel: linearGenomeViewStateModelFactory,
    displayConfig: { marks, ...display },
    regions,
    assemblyRegions: regions,
    onViewReady: view => {
      view.showAllRegions()
    },
    rpcCall,
  })
}

type Layer = EncodedFeaturesResult['layers'][number]

function ramp(
  extent: [number, number],
  pinnedDomain?: [number, number],
): Extract<Layer['scale'], { kind: 'ramp' }> {
  return {
    kind: 'ramp',
    field: 'score',
    scale: 'linear',
    domain: pinnedDomain ?? extent,
    pinned: [pinnedDomain !== undefined, pinnedDomain !== undefined],
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
    shapeScale?: Layer['shapeScale']
  }[],
  facet?: EncodedFeaturesResult['facet'],
): EncodedFeaturesResult {
  return {
    facet,
    layers: layers.map(({ y, row, color, scale, shapeScale }) => ({
      count: y.length,
      skipped: 0,
      x: Uint32Array.from(y.map((_, i) => i * 100)),
      x2: Uint32Array.from(y.map((_, i) => i * 100 + 50)),
      y: Float32Array.from(y),
      row: row ? Uint32Array.from(row) : undefined,
      color: color ? Uint32Array.from(color) : new Uint32Array(y.length),
      shape: new Uint8Array(y.length),
      featureIndex: Uint32Array.from(y.map((_, i) => i)),
      ...extremes(y),
      scale,
      shapeScale,
    })),
  }
}

test('the config reaches the worker as one encoding per mark, jexl unevaluated', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical', domain: [1, -1] },
      },
    },
    {
      mark: 'point',
      encoding: {
        x: "jexl:get(feature,'thickStart')",
        y: 'jexl:feature.score*2',
        color: "jexl:get(feature,'name')=='a'?'red':'blue'",
        shape: 'triangle-down',
      },
    },
    {
      mark: 'span',
      encoding: {
        color: {
          field: 'score',
          scale: 'log',
          domainMin: 1,
          domainMax: 1000,
          range: ['white', 'red'],
        },
      },
    },
  ])
  const { display } = createDisplay()
  expect(display.markTypes).toEqual(['bar', 'point', 'span'])
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
            range: undefined,
            domain: ['1', '-1'],
          },
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
          shape: 'triangle-down',
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
            domainMin: 1,
            domainMax: 1000,
            range: ['white', 'red'],
            reverse: false,
          },
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

test('a text mark asks the worker for the text lane and no hit index, and takes no place in the mark list', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'text', encoding: { y: 'score' } },
    { mark: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  const [text, bar] = display.rpcProps().layers
  expect(text).toMatchObject({
    encoding: { y: 'score', text: 'name' },
    lanes: ['y', 'row', 'color', 'text'],
  })
  expect(bar!.lanes).toContain('index')
  expect(display.markList.map(m => [m.pass.id, m.markIndex])).toEqual([
    ['bar#1', 1],
  ])
})

test("a text mark's values fold into the axis, and one naming no y asks for no y lane and draws without one", () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'text', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.notices).toEqual([])
  display.setRpcData(0, result([{ y: [3, 90] }]), REGION)
  expect(display.domain![1]).toBeGreaterThanOrEqual(90)
  const banded = createTestEnvironment([{ mark: 'text' }]).createDisplay()
    .display
  expect(banded.notices).toEqual([])
  expect(banded.textMarkEntries[0]).toMatchObject({
    placed: true,
    valued: false,
    ownColor: false,
  })
  expect(banded.rpcProps().layers[0]!.lanes).toEqual(['row', 'color', 'text'])
  banded.setRpcData(0, result([{ y: [] }]), REGION)
  expect(banded.domain).toBeUndefined()
})

test('a text mark beside points keeps the points where they were', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'point', size: 6, encoding: { y: 'score' } },
    { mark: 'text', encoding: { y: 'score', color: 'red' } },
  ])
  const { display } = createDisplay()
  expect(display.valueInsetPx).toBe(pointInsetPx(6))
  expect(display.textMarkEntries[1]!.ownColor).toBe(true)
  const alone = createTestEnvironment([
    { mark: 'text', encoding: { y: 'score' } },
  ]).createDisplay().display
  expect(alone.valueInsetPx).toBe(0)
})

test('a slot write only a label reads leaves the mark list as it was, so the backend stands', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'point', encoding: { y: 'score' } },
    { mark: 'text', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  // Tracked, as the chrome tracks it: outside a reaction a computed answers
  // afresh on every read, so identity is a question only an observer can ask.
  const lists: unknown[] = []
  const stop = autorun(() => {
    lists.push(display.markList)
  })
  display.setPointSize(9)
  expect(display.textMarkEntries[1]!.ownColor).toBe(false)
  setConf(display.conf.marks[1]!, ['encoding', 'color', 'value'], 'red')
  expect(display.textMarkEntries[1]!.ownColor).toBe(true)
  stop()
  expect(lists).toHaveLength(1)
})

test('the worker fills the text lane the request names, and the placement reads it back', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' } },
    { mark: 'text', encoding: { y: 'score' } },
    { mark: 'text', encoding: { text: 'type' } },
  ])
  const { display } = createDisplay()
  const feats = [
    new SimpleFeature({
      uniqueId: 'a',
      refName: 'ctgA',
      start: 1000,
      end: 2000,
      score: 5,
      name: 'geneA',
      type: 'gene',
    }),
    new SimpleFeature({
      uniqueId: 'b',
      refName: 'ctgA',
      start: 6000,
      end: 7000,
      score: 9,
      name: 'geneB',
    }),
  ]
  const { layers } = display.rpcProps()
  display.setRpcData(
    0,
    {
      layers: layers.map(request =>
        encodeFeatures(feats, request.encoding, request.lanes),
      ),
    },
    REGION,
  )
  const [, named, typed] = display.rpcDataMap.get(0)!.layers
  expect(named!.text).toEqual(['geneA', 'geneB'])
  expect(named!.y).toBeDefined()
  expect(typed!.text).toEqual(['gene', ''])
  expect(typed!.y).toBeUndefined()
  const labels = placeTextMarks(
    display.textMarkEntries,
    display.rpcDataMap,
    display.renderBlocks,
    display.renderState,
    { size: 11, family: 'sans-serif' },
    'black',
  )
  expect(labels.map(l => [l.markIndex, l.text])).toEqual([
    [1, 'geneA'],
    [2, 'gene'],
    [1, 'geneB'],
  ])
  const { canvasHeight } = display.renderState
  // the typed label names no y, so it sits in the middle of the one band
  expect(labels[1]!.baseline).toBeCloseTo(canvasHeight / 2 + 11 * 0.34)
  expect(labels[0]!.baseline).toBeLessThan(canvasHeight / 2)
})

test('a hover on a mark after a text mark lights its own ink', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'text', encoding: { row: 'sampleIndex' } },
    { mark: 'span', encoding: { row: 'sampleIndex' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result([
      { y: [0], row: [0] },
      { y: [0, 0], row: [0, 1] },
    ]),
    REGION,
  )
  display.setHoveredFeature({
    markIndex: 1,
    regionIndex: 0,
    instance: 1,
    featureIndex: 1,
    refName: 'ctgA',
    start: 100,
    end: 150,
    bp: 100,
    y: undefined,
    color: undefined,
    colorValue: undefined,
    glyph: undefined,
    row: undefined,
    screenX: 0,
    screenY: 0,
  })
  const [box] = display.hoverInk
  expect(box!.height).toBe(display.renderState.canvasHeight / 2)
  expect(box!.top).toBeGreaterThan(display.renderState.canvasHeight / 2)
})

test('the domain spans every valued layer and widens to the origin for a bar', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' } },
    { mark: 'point', encoding: { y: 'other' } },
  ])
  const { display } = createDisplay()
  expect(display.domain).toBeUndefined()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [12, 20] }]), REGION)
  expect(display.domain).toEqual([0, 20])
  expect(display.renderState.domainY).toEqual([0, 20])
})

test("the display's y scale is the axis: its type and its pinned ends", () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
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
    { mark: 'bar', encoding: { y: 'score' } },
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
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { autoscale: 'local' } } },
  ).createDisplay().display
  local.setRpcData(0, result([{ y: spiky }]), REGION)
  expect(local.domain![1]).toBe(1000)

  const clipped = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { autoscale: 'localpercentile' } } },
  ).createDisplay().display
  clipped.setRpcData(0, result([{ y: spiky }]), REGION)
  expect(clipped.domain![1]).toBeLessThan(10)
})

// Both radios derive from `scales.y` now: three scale types declared, and an
// autoscale member present.
test('the score menu offers the scale-type and autoscale radios', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.scaleTypeChoices).toEqual(['linear', 'log', 'symlog'])
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
    [{ mark: 'bar', encoding: { y: 'score' } }],
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
    { mark: 'bar', encoding: { y: 'score' } },
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
    { mark: 'bar', encoding: { y: 'score' } },
    { mark: 'point', encoding: { y: 'other' } },
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
      mark: 'bar',
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
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'score',
          scale: 'linear',
          domainMin: 0,
          domainMax: 100,
        },
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
    { mark: 'bar', encoding: { y: 'score' } },
    { mark: 'point', encoding: { y: 'coverage' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [200, 900] }]), REGION)
  expect(display.domain).toEqual([0, 900])
  expect(display.renderState.domainY).toEqual([0, 900])
  expect(display.valueScales).toHaveLength(1)
  const [only] = display.valueScales
  expect(only).toMatchObject({ domain: [0, 900] })
  expect(only!.side).toBeUndefined()
  expect(only!.caption).toBe('')
  expect(display.axes.map(a => a.side)).toEqual([undefined])
})

function ruleMarksOf(display: LinearMarkDisplayModel) {
  return display.axes[0]?.ruleMarks ?? []
}

test('a rule widens the axis to reach it and lands on its own value', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'point', encoding: { y: 'neg_log10_p' } }],
    REGION,
    'BedAdapter',
    {
      scales: {
        y: { rules: [20, { value: 5, color: 'red', label: 'suggestive' }] },
      },
    },
  )
  const { display } = createDisplay()
  expect(ruleMarksOf(display)).toEqual([])
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  expect(display.domain).toEqual([0, 20])
  const [axis] = display.axes
  const { yTop, yBottom } = axis!.ticks
  const [top, suggestive] = ruleMarksOf(display)
  expect(top).toEqual({ value: 20, y: yTop })
  expect(suggestive).toMatchObject({
    value: 5,
    color: 'red',
    label: 'suggestive',
  })
  expect(suggestive!.y).toBeCloseTo(yBottom - (5 / 20) * (yBottom - yTop))
})

test('a rule at zero is a rule, and a pinned end that excludes one drops it', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'point', encoding: { y: 'log_ratio' } }],
    REGION,
    'BedAdapter',
    { scales: { y: { rules: [0, 100], domainMax: 10 } } },
  )
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [2, 8] }]), REGION)
  expect(display.domain).toEqual([0, 10])
  expect(ruleMarksOf(display).map(r => r.value)).toEqual([0])
})

test('a rule on a log axis sits where the log places its value', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'point', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    {
      scales: { y: { type: 'log', domainMin: 1, domainMax: 100, rules: [10] } },
    },
  )
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  const { yTop, yBottom } = display.axes[0]!.ticks
  expect(ruleMarksOf(display)[0]!.y).toBeCloseTo((yTop + yBottom) / 2)
})

// The axis resolves symlog's constant from the domain inside `computeYTicks`,
// the bars from the render state; both are far from the 1 the bars once took.
test.each([
  ['derived from the domain, 0.05', {}],
  ['configured, 5', { symlogConstant: 5 }],
])(
  'a symlog axis ticks each value at the height its bar reaches, its constant %s',
  (_label, constant) => {
    const { createDisplay } = createTestEnvironment(
      [{ mark: 'bar', encoding: { y: 'score' } }],
      REGION,
      'BedAdapter',
      {
        scales: {
          y: {
            type: 'symlog',
            domainMin: -20,
            domainMax: 50,
            rules: [7],
            ...constant,
          },
        },
      },
    )
    const { display } = createDisplay()
    display.setRpcData(0, result([{ y: [1] }]), REGION)
    const { ticks } = display.axes[0]!
    const tickAt = (value: number) =>
      ticks.items.find(t => t.value === value)!.y
    const valued = ticks.items.map(t => t.value).filter(v => v !== 0)
    expect(valued.length).toBeGreaterThan(3)
    const values = [...valued, 7]
    display.setRpcData(0, result([{ y: values }]), REGION)
    const [rule] = ruleMarksOf(display)
    values.forEach((value, i) => {
      display.setHoveredFeature(hitOn(0, i))
      const [box] = display.hoverInk
      const [valueEnd, originEnd] =
        value > 0
          ? [box!.top, box!.top + box!.height]
          : [box!.top + box!.height, box!.top]
      expect(valueEnd).toBeCloseTo(value === 7 ? rule!.y : tickAt(value), 3)
      expect(originEnd).toBeCloseTo(tickAt(0), 3)
    })
  },
)

test('a rule in a banded plot is placed in the band every row repeats', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { facet: 'source', scales: { y: { rules: [4] } } },
  )
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result(
      [{ y: [3, 8], row: [0, 1] }],
      [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
      ],
    ),
    REGION,
  )
  const [axis] = display.axes
  expect(axis!.bandTops).toHaveLength(2)
  const [rule] = ruleMarksOf(display)
  const { yTop, yBottom } = axis!.ticks
  expect(yBottom).toBeLessThanOrEqual(axis!.height)
  expect(rule!.y).toBe(yBottom - (4 / 8) * (yBottom - yTop))
})

test('the axis carries only the caption title writes, at every zoom', () => {
  const multiscale = [
    { mark: 'bar', encoding: { y: 'score' }, maxBpPerPx: 4 },
    { mark: 'bar', encoding: { y: 'count' }, minBpPerPx: 4 },
  ]
  const captions = (y: Record<string, unknown>) => {
    const { display, view } = createTestEnvironment(
      multiscale,
      REGION,
      'BedAdapter',
      { scales: { y } },
    ).createDisplay()
    view.zoomTo(2)
    const zoomedIn = display.valueScales[0]!.caption
    view.zoomTo(8)
    return [zoomedIn, display.valueScales[0]!.caption]
  }
  expect(captions({})).toEqual(['', ''])
  expect(captions({ title: 'Alu copies' })).toEqual([
    'Alu copies',
    'Alu copies',
  ])
})

test('two fields, or an expression, leave the axis untitled until title names it', () => {
  const caption = (marks: unknown[], y: Record<string, unknown> = {}) =>
    createTestEnvironment(marks, REGION, 'BedAdapter', {
      scales: { y },
    }).createDisplay().display.valueScales[0]!.caption
  const expression = [{ mark: 'bar', encoding: { y: 'jexl:feature.score*2' } }]
  expect(caption(expression)).toBe('')
  expect(caption(expression, { title: 'doubled score' })).toBe('doubled score')
  expect(
    caption(
      [
        { mark: 'bar', encoding: { y: 'score' } },
        { mark: 'point', encoding: { y: 'score' } },
      ],
      { title: '-log10 p' },
    ),
  ).toBe('-log10 p')
})

test('an unset or empty title leaves the axis bare, and a reset returns it there', () => {
  const marks = [{ mark: 'bar', encoding: { y: 'score' } }]
  const titled = (y: Record<string, unknown>) =>
    createTestEnvironment(marks, REGION, 'BedAdapter', {
      scales: { y },
    }).createDisplay().display
  expect(titled({}).valueScales[0]!.caption).toBe('')
  expect(titled({ title: '' }).valueScales[0]!.caption).toBe('')
  const display = titled({ title: 'score' })
  expect(display.valueScales[0]!.caption).toBe('score')
  setConf(display, ['scales', 'y', 'title'], undefined)
  expect(display.valueScales[0]!.caption).toBe('')
})

test('a banded plot carries its one caption, which the chrome draws once', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { facet: 'source', scales: { y: { title: 'score' } } },
  )
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result(
      [{ y: [3, 8], row: [0, 1] }],
      [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
      ],
    ),
    REGION,
  )
  expect(display.valueScales[0]!.bandTops).toHaveLength(2)
  expect(display.valueScales[0]!.caption).toBe('score')
})

function noticesOf(marks: unknown[], display: Record<string, unknown> = {}) {
  return createTestEnvironment(
    marks,
    REGION,
    'BedAdapter',
    display,
  ).createDisplay().display.notices
}

// The encoder reads a missing y as 0 for every feature, so a bar with only a
// colour was an empty track with no message, and then a track that would not
// load. It loads, draws nothing for that mark, and says so.
test('a bar or point naming no y loads, draws nothing and says so', () => {
  expect(noticesOf([{ mark: 'bar', encoding: { color: 'red' } }])).toEqual([
    'mark 0 encoding.y: a bar or a point stands at a value and names no y field to plot, so it draws nothing',
  ])
  expect(noticesOf([{ mark: 'point', encoding: { y: '' } }])).toHaveLength(1)
  expect(noticesOf([{ mark: 'span', encoding: {} }])).toEqual([])
  const { display } = createTestEnvironment([
    { mark: 'bar', encoding: { color: 'red' } },
    { mark: 'bar', encoding: { y: 'score' } },
  ]).createDisplay()
  expect(display.markView.visible).toEqual([false, true])
})

test('an encoding channel refuses a key it does not declare', () => {
  expect(() =>
    createTestEnvironment([
      { mark: 'span', encoding: { color: { colour: 'strand' } } },
    ]).createDisplay(),
  ).toThrow(
    'MarkColor takes value, field, scale, domain, domainMin, domainMax, range, labels, scheme, reverse, domainMid and title, not colour',
  )
  expect(() =>
    createTestEnvironment([
      { mark: 'point', encoding: { y: 'score', shape: { glyph: 'circle' } } },
    ]).createDisplay(),
  ).toThrow('MarkShape takes value, field, scale, range and domain, not glyph')
  expect(() =>
    createTestEnvironment(
      [{ mark: 'bar', encoding: { y: 'score' } }],
      REGION,
      'BedAdapter',
      { scales: { y: { min: 0 } } },
    ).createDisplay(),
  ).toThrow(
    'ValueScale takes type, domainMin, domainMax, autoscaleGroup, symlogConstant, autoscale, numStdDev, numQuantile, title and rules, not min',
  )
  expect(() =>
    createTestEnvironment(
      [{ mark: 'bar', encoding: { y: 'score' } }],
      REGION,
      'BedAdapter',
      { scales: { y: { rules: [{ value: 5, colour: 'red' }] } } },
    ).createDisplay(),
  ).toThrow('ValueScaleRule takes value, color and label, not colour')
})

// Each of these loaded and painted something else: a scheme name inside a
// list of colour stops painted the invalid-colour sentinel, and a shape range
// or value naming no shape drew a circle under a key saying otherwise, or made
// the worker throw for every mark.
test.each([
  [
    { field: 'score', scale: 'linear', range: ['magma'] },
    undefined,
    '"magma" is not a color',
  ],
  [
    { field: 'score', scale: 'linear', scheme: 'rainbow' },
    undefined,
    '(ColorScheme | undefined)',
  ],
  [undefined, { field: 'svtype', range: ['star', 'triangle-down'] }, '"star"'],
  [undefined, 'triangl', '"triangl"'],
])(
  'a colour %j or shape %j naming nothing the display paints fails the load',
  (color, shape, message) => {
    expect(() =>
      createTestEnvironment([
        {
          mark: 'point',
          encoding: {
            y: 'score',
            ...(color ? { color } : {}),
            ...(shape ? { shape } : {}),
          },
        },
      ]).createDisplay(),
    ).toThrow(message)
  },
)

// A span's ramp resolves in the worker (ADR-113), one table per region, under
// a legend that unions their extents.
test('a span painting an unpinned colour ramp says its colours differ by region, and a pinned one says nothing', () => {
  expect(
    noticesOf([
      {
        mark: 'span',
        encoding: {
          color: { field: 'score', scale: 'linear', range: ['white', 'red'] },
        },
      },
    ]),
  ).toEqual([
    expect.stringMatching(/^mark 0 encoding.color.domainMin: a span's ramp/),
  ])
  expect(
    noticesOf([
      {
        mark: 'span',
        encoding: {
          color: {
            field: 'score',
            scale: 'log',
            domainMin: 1,
            domainMax: 1000,
            range: ['white', 'red'],
          },
        },
      },
    ]),
  ).toEqual([])
})

test('a channel the mark does not read is named, and the rest still draws', () => {
  expect(noticesOf([{ mark: 'span', encoding: { y: 'score' } }])).toEqual([
    'mark 0 encoding.y: a span does not read y',
  ])
  expect(
    noticesOf([
      { mark: 'bar', encoding: { y: 'score', shape: 'triangle-down' } },
    ]),
  ).toEqual(['mark 0 encoding.shape: a bar does not read shape'])
  expect(
    noticesOf([{ mark: 'span', source: 'density', encoding: {} }]),
  ).toEqual(['mark 0 source: a span does not draw the density sidecar'])
  expect(
    noticesOf([
      { mark: 'point', encoding: { y: 'score', shape: 'triangle-down' } },
    ]),
  ).toEqual([])
})

test('a mark type the display does not draw is named as the problem, not the channels it carries', () => {
  expect(() =>
    createTestEnvironment([
      { mark: 'rule', encoding: { y: 'score' } },
    ]).createDisplay(),
  ).toThrow(/marks.0.mark is "rule", and a mark is one of bar, point, span/)
})

test('a mistyped key on a mark, a step or an op is refused where the config is read', () => {
  expect(() =>
    createTestEnvironment([
      { mark: 'bar', encoding: { y: 'score' }, transforms: [] },
    ]).createDisplay(),
  ).toThrow(/Mark takes .* not transforms/)
  expect(() =>
    createTestEnvironment([
      {
        mark: 'bar',
        encoding: { y: 'count' },
        transform: [{ type: 'aggregate', groupBy: ['type'] }],
      },
    ]).createDisplay(),
  ).toThrow('aggregate takes groupby, ops and type, not groupBy')
  expect(() =>
    createTestEnvironment([
      {
        mark: 'bar',
        encoding: { y: 'score' },
        transform: [{ type: 'filter', expr: 'jexl:true', step: 50 }],
      },
    ]).createDisplay(),
  ).toThrow('filter takes expr and type, not step')
  expect(() =>
    createTestEnvironment([
      { mark: 'bar', encoding: { y: 'score' }, transform: [{ step: 1000 }] },
    ]).createDisplay(),
  ).toThrow(
    'a MarkTransform names its type, one of filter, formula, bin, aggregate, coverage, flatten, pileup and mate, and names none',
  )
  expect(() =>
    createTestEnvironment([
      {
        mark: 'bar',
        encoding: { y: 'mean_score' },
        transform: [
          { type: 'aggregate', ops: [{ op: 'mean', fields: 'score' }] },
        ],
      },
    ]).createDisplay(),
  ).toThrow(/MarkAggregateOp takes .* not fields/)
})

// A ramp spelled with the pair `domain` used to be how its ends were pinned,
// so a config written that way loads, paints over each region's extremes, and
// says the domain is not what a ramp reads.
test('a colour ramp pins the end it names, and a domain beside it is named as unread', () => {
  const { display } = createTestEnvironment([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'score',
          scale: 'linear',
          domainMin: 0,
          domain: ['0', '10'],
        },
      },
    },
  ]).createDisplay()
  expect(display.notices).toEqual([
    expect.stringMatching(
      /^mark 0 encoding.color.domain: a linear or log scale reads no domain/,
    ),
  ])
  expect(display.encodings[0]!.color).toMatchObject({
    domainMin: 0,
    domainMax: undefined,
  })
})

test('a span-only display has no score domain', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'span', encoding: {} },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [0, 0], row: [0, 0] }]), REGION)
  expect(display.domain).toBeUndefined()
  expect(display.rowCount).toBe(1)
})

test('a span stacked by a row field asks the worker for the row lane and bands the plot by the highest row', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'span', encoding: { row: 'sampleIndex' } },
  ])
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]).toEqual({
    encoding: {
      x: 'start',
      x2: 'end',
      y: undefined,
      row: 'sampleIndex',
      color: DEFAULT_MARK_COLOR,
    },
    lanes: ['row', 'color', 'index'],
  })
  display.setRpcData(0, result([{ y: [0, 0, 0], row: [0, 2, 1] }]), REGION)
  expect(display.rowCount).toBe(3)
  expect(display.renderState.rowCount).toBe(3)
})

test('rows deeper than the plot squash into it, and rows that fit keep whole px', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'span', encoding: { row: 'sampleIndex' } }],
    WIDE_REGION,
  )
  const { display } = createDisplay()
  const rows = (n: number) => Array.from({ length: n }, (_, i) => i)
  const lastRowInk = (n: number) => {
    display.setRpcData(0, result([{ y: rows(n), row: rows(n) }]), WIDE_REGION)
    display.setHoveredFeature({
      ...hitOn(0, n - 1),
      start: (n - 1) * 100,
      end: (n - 1) * 100 + 50,
    })
    return display.hoverInk[0]!
  }
  const { yTop, plotHeight } = axisPlotBox(display.height)

  const fits = lastRowInk(40)
  expect(fits.height).toBe(Math.floor(plotHeight / 40))
  expect(fits.top + fits.height).toBeLessThanOrEqual(yTop + plotHeight)

  const deep = lastRowInk(400)
  expect(deep.height).toBe(1)
  expect(deep.top + deep.height).toBeLessThanOrEqual(yTop + plotHeight + 0.5)
  expect(deep.top).toBeGreaterThan(yTop + plotHeight - 2)
})

test('a span outside its zoom range adds no bands', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'span', encoding: { row: 'sampleIndex' }, minBpPerPx: 4 },
    { mark: 'span', encoding: {} },
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

test("a transform list reaches the worker as its own layer's steps, every slot written out", () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'bar',
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
        { type: 'flatten', field: 'exons', index: 'nth' },
        { type: 'pileup' },
        { type: 'pileup', as: 'lane', fields: ['s', 'e'], padding: 20 },
      ],
    },
    { mark: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  const { layers } = display.rpcProps()
  expect(layers[0]!.transform).toEqual([
    { type: 'filter', expr: "jexl:get(feature,'score') > 1" },
    { type: 'formula', expr: 'jexl:feature.score*2', as: 'twice' },
    { type: 'bin', step: 5000, field: 'start', as: ['start', 'end'] },
    { type: 'bin', step: 10, field: 'end', as: ['b0', 'b1'] },
    {
      type: 'aggregate',
      groupby: ['start', 'end'],
      ops: [
        { op: 'count', field: undefined, as: 'count' },
        { op: 'mean', field: 'twice', as: 'm' },
      ],
    },
    { type: 'coverage', as: 'coverage' },
    { type: 'coverage', as: 'depth' },
    {
      type: 'flatten',
      field: 'subfeatures',
      index: '',
      keepEmpty: false,
    },
    { type: 'flatten', field: 'exons', index: 'nth', keepEmpty: false },
    { type: 'pileup', as: 'row', fields: ['start', 'end'], padding: 0 },
    { type: 'pileup', as: 'lane', fields: ['s', 'e'], padding: 20 },
  ])
  expect(layers[1]).not.toHaveProperty('transform')
})

// Each of these is a restatement a config author had to write out, and each
// has one answer the step or the channel beside it already knows.
test('a bin hands its edges to the aggregate behind it, and a pileup leaves the row to the worker', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'bar',
      transform: [
        { type: 'bin', step: 5000 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      encoding: { y: 'count' },
    },
    {
      mark: 'bar',
      transform: [
        { type: 'bin', step: 5000, as: ['lo', 'hi'] },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      encoding: { y: 'count' },
    },
    {
      mark: 'bar',
      transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
      encoding: { y: 'count' },
    },
    { mark: 'span', transform: [{ type: 'pileup' }], encoding: {} },
    {
      mark: 'span',
      transform: [{ type: 'pileup', as: 'lane' }],
      encoding: {},
    },
    { mark: 'span', encoding: {} },
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
  // the worker reads the layer's own pileup (CoreEncodeFeatures.test.ts), so
  // a caller of the RPC gets the same row a display does
  expect(layers.slice(3).map(l => l.encoding.row)).toEqual([
    undefined,
    undefined,
    undefined,
  ])
})

// Group by → None keeps the facet's steps, so with no field to split on they
// run over the one section there is, or a mark grouping by the bin they wrote
// folds every feature into one group.
test("a facet with no field still runs its steps, on the shared list after the display's", () => {
  const { createDisplay } = createTestEnvironment(
    [
      {
        mark: 'bar',
        transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
        encoding: { y: 'count' },
      },
    ],
    undefined,
    undefined,
    {
      transform: [{ type: 'filter', expr: 'jexl:true' }],
      facet: { transform: [{ type: 'bin', step: 500, as: ['lo', 'hi'] }] },
    },
  )
  const { display } = createDisplay()
  const props = display.rpcProps()
  expect(props.facet).toBeUndefined()
  expect(props.transform).toEqual([
    { type: 'filter', expr: 'jexl:true' },
    { type: 'bin', step: 500, field: 'start', as: ['lo', 'hi'] },
  ])
  expect(
    (props.layers[0]!.transform![0] as { groupby: string[] }).groupby,
  ).toEqual(['lo', 'hi'])
})

test("the facet's steps ride the request per section, hand their bin to the marks, and survive a field change", () => {
  const { createDisplay } = createTestEnvironment(
    [
      {
        mark: 'bar',
        transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
        encoding: { y: 'count' },
      },
    ],
    undefined,
    undefined,
    {
      facet: {
        field: 'sample',
        transform: [{ type: 'bin', step: 500, as: ['lo', 'hi'] }],
      },
    },
  )
  const { display } = createDisplay()
  expect(display.rpcProps().facet).toEqual({
    field: 'sample',
    transform: [{ type: 'bin', step: 500, field: 'start', as: ['lo', 'hi'] }],
  })
  expect(
    (display.rpcProps().layers[0]!.transform![0] as { groupby: string[] })
      .groupby,
  ).toEqual(['lo', 'hi'])
  display.setFacetField('name')
  expect(display.rpcProps().facet).toMatchObject({
    field: 'name',
    transform: [{ type: 'bin' }],
  })
})

test("a mark's aggregate behind a bin in the display's transform groups by that bin's edges", () => {
  const { createDisplay } = createTestEnvironment(
    [
      {
        mark: 'bar',
        transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
        encoding: { y: 'count' },
      },
      {
        mark: 'bar',
        transform: [
          { type: 'bin', step: 500, as: ['a', 'b'] },
          { type: 'aggregate', ops: [{ op: 'count' }] },
        ],
        encoding: { y: 'count' },
      },
    ],
    undefined,
    undefined,
    { transform: [{ type: 'bin', step: 1000, as: ['lo', 'hi'] }] },
  )
  const { display } = createDisplay()
  const { layers } = display.rpcProps()
  const groupbyOf = (i: number, step: number) =>
    (layers[i]!.transform![step] as { groupby: string[] }).groupby
  expect(groupbyOf(0, 0)).toEqual(['lo', 'hi'])
  expect(groupbyOf(1, 1)).toEqual(['a', 'b'])
})

test('a flatten keeping its empty features says so on the wire', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'span',
      transform: [
        { type: 'flatten', keepEmpty: true },
        { type: 'flatten', field: 'exons' },
      ],
      encoding: {},
    },
  ])
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]!.transform).toEqual([
    { type: 'flatten', field: 'subfeatures', index: '', keepEmpty: true },
    { type: 'flatten', field: 'exons', index: '', keepEmpty: false },
  ])
})

type StepPair = [Record<string, unknown>, Record<string, unknown>]

// What a step writes at its defaults, as pairs of snapshots meaning the same
// step: the slot left off, and the slot written at its default. An array of
// sub-schemas (an aggregate's ops) contributes each of its entry's pairs.
function defaultWrites(schema: IAnyType): StepPair[] {
  return Object.entries(getConfigurationSchemaDefinition(schema)!).flatMap(
    ([slot, entry]): StepPair[] => {
      if (isSlotDefinitionEntry(entry)) {
        return [[{}, { [slot]: entry.defaultValue }]]
      }
      const array = isType(entry) ? asArrayType(entry) : undefined
      return array
        ? defaultWrites(array.getChildType()).map(([left, written]) => [
            { [slot]: [left] },
            { [slot]: [written] },
          ])
        : []
    },
  )
}

function stepFetch(steps: Record<string, unknown>[]) {
  return createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { transform: steps },
  )
    .createDisplay()
    .display.rpcProps()
}

// A step on the wire that leaned on a worker default for a slot would be one
// fetch left off and another written at that default, drawing one picture
// from two cache entries: every slot is written out instead.
test('every step type reaches the worker with each of its slots written out', () => {
  const { members } = getConfigurationSchemaUnion(markTransformStep)!
  const types = Object.keys(members)
  const wire = stepFetch(types.map(type => ({ type }))).transform
  expect(
    wire.map(step =>
      Object.entries(step).flatMap(([key, value]) =>
        value === undefined ? [] : [key],
      ),
    ),
  ).toEqual(
    types.map(type => [
      'type',
      ...Object.keys(getConfigurationSchemaDefinition(members[type]!)!),
    ]),
  )
})

test('a step slot left at its default and one written at it are one fetch, for every step type and an aggregate op named its own output name', () => {
  const { members } = getConfigurationSchemaUnion(markTransformStep)!
  const aggregateAs = (op: Record<string, unknown>, as: string): StepPair => [
    { type: 'aggregate', ops: [op] },
    { type: 'aggregate', ops: [{ ...op, as }] },
  ]
  const pairs = [
    ...Object.entries(members).flatMap(([type, member]) =>
      defaultWrites(member).map(([left, written]): StepPair => [
        { type, ...left },
        { type, ...written },
      ]),
    ),
    aggregateAs({ op: 'count' }, 'count'),
    aggregateAs({ op: 'mean', field: 'score' }, 'mean_score'),
  ]
  const fetchKey = (step: Record<string, unknown>) =>
    JSON.stringify(stepFetch([step]))
  expect(pairs.map(([, written]) => written)).toContainEqual({
    type: 'aggregate',
    ops: [{ field: '' }],
  })
  for (const [left, written] of pairs) {
    expect([written, fetchKey(written)]).toEqual([written, fetchKey(left)])
  }
})

test('a mark outside its zoom range leaves the shared domain and the legend', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' }, maxBpPerPx: 4 },
    {
      mark: 'bar',
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
      mark: 'bar',
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
      title: 'type',
    },
  ])
  expect(display.showLegend).toBe(true)
})

test("the colour's title heads its key, and a write retitles it without a fetch", () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'score', scale: 'linear', title: 'Mapping quality' },
      },
    },
  ])
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result([{ y: [10, 60], scale: ramp([10, 60]) }]),
    REGION,
  )
  const heading = () => display.colorScales.map(s => s.title)
  expect(heading()).toEqual(['Mapping quality'])
  const fetched = display.rpcProps()
  const { color } = display.conf.marks[0]!.encoding
  setConf(color, 'title', '')
  expect(heading()).toEqual([undefined])
  setConf(color, 'title', undefined)
  expect(heading()).toEqual(['score'])
  expect(display.rpcProps()).toEqual(fetched)
})

// Two marks over one field through one declaration paint a value alike, so
// two keys listing the same rows said it twice.
test('two marks colouring by one field through one range share a key', () => {
  const strandTable = (
    entries: { value: string; color: number }[],
    range?: string[],
  ): Layer['scale'] => ({
    kind: 'categorical',
    field: 'strand',
    domain: [],
    ...(range ? { range } : {}),
    entries,
  })
  const marks = [
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical' },
      },
    },
    {
      mark: 'bar',
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
      title: 'strand',
    },
  ])
  expect(shared.colorScales.map(s => s.id)).toEqual(['mark-0-1-color'])

  const apart = createTestEnvironment(marks).createDisplay().display
  const both = [
    { value: '1', color: 0xff0000ff },
    { value: '-1', color: 0xff00ff00 },
  ]
  apart.setRpcData(
    0,
    result([
      { y: [1], scale: strandTable(both, ['red']) },
      { y: [2], scale: strandTable(both, ['blue']) },
    ]),
    REGION,
  )
  expect(apart.colorScales.map(s => s.id)).toEqual([
    'mark-0-color',
    'mark-1-color',
  ])
})

// Colour and shape over one field listed the same values twice under one
// title, and on a short display the second key ran past the bottom edge.
test('a shape scale over the field the colour classifies folds into one key', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'strand', scale: 'categorical' },
        shape: { field: 'strand', scale: 'categorical' },
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
        shapeScale: {
          kind: 'shape',
          field: 'strand',
          domain: [],
          entries: [
            { value: '1', shape: 'triangle-down' },
            { value: '-1', shape: 'diamond' },
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
      domain: ['1', '-1', '0'],
      entries: [
        {
          value: '1',
          values: ['1'],
          label: 'Forward strand',
          color: 'rgba(255,0,0,1)',
          swatches: [{ color: 'rgba(255,0,0,1)', shape: 'triangle-down' }],
        },
        {
          value: '-1',
          values: ['-1'],
          label: 'Reverse strand',
          color: 'rgba(0,255,0,1)',
          swatches: [{ color: 'rgba(0,255,0,1)', shape: 'diamond' }],
        },
      ],
    },
  ])
})

test('a shape scale reaches the worker beside the colour, and its key draws the shapes', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: 'red',
        shape: {
          field: 'strand',
          scale: 'categorical',
          domain: [1, -1],
          range: ['triangle-down', 'diamond'],
        },
      },
    },
  ])
  const { display } = createDisplay()
  expect(display.rpcProps().layers[0]?.encoding.shape).toEqual({
    field: 'strand',
    scale: 'categorical',
    domain: ['1', '-1'],
    range: ['triangle-down', 'diamond'],
  })
  display.setRpcData(
    0,
    result([
      {
        y: [1, 2],
        shapeScale: {
          kind: 'shape',
          field: 'strand',
          domain: [],
          entries: [
            { value: '1', shape: 'triangle-down' },
            { value: '-1', shape: 'diamond' },
          ],
        },
      },
    ]),
    REGION,
  )
  expect(display.legendSections).toEqual([
    {
      markIndexes: [0],
      channel: 'shape',
      scale: {
        kind: 'shape',
        field: 'strand',
        domain: [],
        entries: [
          { value: '1', shape: 'triangle-down' },
          { value: '-1', shape: 'diamond' },
        ],
      },
      title: 'strand',
    },
  ])
  expect(display.colorScales).toEqual([
    {
      kind: 'categorical',
      id: 'mark-0-shape',
      title: 'strand',
      entries: [
        {
          value: '1',
          label: 'Forward strand',
          swatches: [{ color: 'currentColor', shape: 'triangle-down' }],
        },
        {
          value: '-1',
          label: 'Reverse strand',
          swatches: [{ color: 'currentColor', shape: 'diamond' }],
        },
      ],
    },
  ])
})

test('the hovered instance lights the box its mark painted, inset by the plot top', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'span', encoding: { row: 'sampleIndex' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [0, 0], row: [0, 1] }]), REGION)
  expect(display.hoverInk).toEqual([])
  display.setHoveredFeature({
    markIndex: 0,
    regionIndex: 0,
    instance: 1,
    featureIndex: 1,
    refName: 'ctgA',
    start: 100,
    end: 150,
    bp: 100,
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

const DENSITY_MARKS = [
  { mark: 'bar', encoding: { y: 'score' } },
  {
    mark: 'bar',
    transform: [
      { type: 'bin', step: 1000 },
      { type: 'aggregate', ops: [{ op: 'count' }] },
    ],
    encoding: { y: 'count' },
  },
]

async function loadedThroughTheWorker(
  display: LinearMarkDisplayModel,
  mock: jest.Mock,
  readBack: unknown,
) {
  mock.mockImplementation((_sessionId: string, method: string) =>
    method === 'CoreEncodeFeatures'
      ? Promise.resolve(result([{ y: [3, 8] }, { y: [2] }]))
      : method === 'CoreGetEncodedFeature'
        ? Promise.resolve(readBack)
        : new Promise(() => {}),
  )
  display.fetchNeeded([{ region: REGION, displayedRegionIndex: 0 }])
  await waitFor(() => {
    expect(display.featurePayloads.get(0)?.request).toBeDefined()
  })
}

function callsOf(mock: jest.Mock, method: string) {
  return mock.mock.calls.filter(call => call[1] === method)
}

function hitOn(markIndex: number, featureIndex: number) {
  return {
    markIndex,
    regionIndex: 0,
    instance: featureIndex,
    featureIndex,
    refName: 'ctgA',
    start: 0,
    end: 50,
    bp: 0,
    y: undefined,
    color: undefined,
    colorValue: undefined,
    glyph: undefined,
    row: undefined,
    screenX: 0,
    screenY: 0,
  }
}

test('a click asks the worker which feature the instance is, under the request its region was fetched by', async () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, session, mockRpcCall } = createDisplay()
  const made = {
    uniqueId: 'ctgA:1000-2000#1',
    refName: 'ctgA',
    start: 1000,
    end: 2000,
    count: 2,
  }
  await loadedThroughTheWorker(display, mockRpcCall, made)
  const [, , fetched] = callsOf(mockRpcCall, 'CoreEncodeFeatures').at(-1)!
  display.selectFeature(hitOn(1, 1))
  await waitFor(() => {
    expect(session.openedWidgets).toHaveLength(1)
  })
  expect(session.openedWidgets[0]!.featureData).toEqual(made)
  const [, , asked] = callsOf(mockRpcCall, 'CoreGetEncodedFeature')[0]!
  const { region, layers, transform, bpPerPx, adapterConfig } = fetched
  expect(asked).toMatchObject({
    region,
    layers,
    transform,
    bpPerPx,
    adapterConfig,
    layer: 1,
    featureIndex: 1,
  })
  expect(asked).not.toHaveProperty('byteLimit')
})

test('a region no worker fetch produced holds no request, and a click on it asks nothing', () => {
  const { createDisplay } = createTestEnvironment(DENSITY_MARKS)
  const { display, mockRpcCall } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [2] }]), REGION)
  mockRpcCall.mockClear()
  display.selectFeature(hitOn(0, 0))
  expect(callsOf(mockRpcCall, 'CoreGetEncodedFeature')).toHaveLength(0)
})

const AUTO_BIN_MARKS = [
  {
    mark: 'bar',
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

test('an auto bin on a mark outside its zoom range refetches nothing as the view zooms', () => {
  const { createDisplay } = createTestEnvironment(
    plotMarks(
      { ...EMPTY_PLOT_SPEC, field: 'score', binned: true },
      { numeric: ['score'], categorical: [] },
    ),
    WIDE_REGION,
  )
  const { display, view } = createDisplay()
  let fetches = 0
  for (let bpPerPx = 0.3; bpPerPx < BINNED_BP_PER_PX; bpPerPx *= 1.125) {
    view.zoomTo(bpPerPx)
    expect(display.markView.visible).toEqual([true, false])
    if (!display.isCacheValid(0)) {
      fetches++
      display.setRpcData(0, result([{ y: [1] }, { y: [1] }]), WIDE_REGION)
    }
  }
  expect(fetches).toBe(1)
})

test('a zoom sweep over a BigWig refetches once per tier, not once per step', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
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
        mark: 'bar',
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

test('a point-only axis is inset by the room the point draws in', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'point', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }]), REGION)
  const inset = pointInsetPx(display.pointSize)
  expect(inset).toBeGreaterThan(0)
  expect(display.valueScales[0]!.offset).toBe(YSCALEBAR_LABEL_OFFSET + inset)
  expect(display.renderState.valueInsetPx).toBe(inset)
  const [axis] = display.axes
  expect(axis!.ticks.yTop).toBe(YSCALEBAR_LABEL_OFFSET + inset)
  expect(axis!.ticks.yBottom).toBe(
    display.height - YSCALEBAR_LABEL_OFFSET - inset,
  )
})

test("a point mark's size is its own, the axis insets by the largest, and the menu writes them all", () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'point', encoding: { y: 'score' } },
    { mark: 'point', size: 10, encoding: { y: 'other' } },
    { mark: 'bar', size: 9, encoding: { y: 'score' }, maxBpPerPx: 0.001 },
  ])
  const { display } = createDisplay()
  display.setRpcData(
    0,
    result([{ y: [3, 8] }, { y: [1, 2] }, { y: [5, 6] }]),
    REGION,
  )
  expect(display.renderState.markSizes).toEqual([4, 10, 9])
  expect(display.renderState.valueInsetPx).toBe(pointInsetPx(10))
  expect(display.pointSize).toBe(4)
  display.setPointSize(6)
  expect(display.markSizes).toEqual([6, 6, 9])
  display.setPointSize()
  expect(display.markSizes).toEqual([4, 4, 9])
})

test('a bar sharing the axis keeps it on the plot box, where a bar top is drawn', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' } },
    { mark: 'point', encoding: { y: 'other' } },
  ])
  const { display } = createDisplay()
  display.setRpcData(0, result([{ y: [3, 8] }, { y: [12, 20] }]), REGION)
  expect(display.valueScales[0]!.offset).toBe(YSCALEBAR_LABEL_OFFSET)
  // the point reads the same box, so a point and a bar top at one value meet
  expect(display.renderState.valueInsetPx).toBe(0)
})

const FACET_MARKS = [
  { mark: 'span', transform: [{ type: 'pileup' }], encoding: { row: 'row' } },
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
    [{ mark: 'bar', encoding: { y: 'score' } }],
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
    { mark: 'bar', encoding: { y: 'score' } },
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
        mark: 'bar',
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
  const GREEN = 0xff00ff00
  const BLUE = 0xffff0000
  display.setRpcData(
    0,
    result(
      [
        {
          y: [3, 5, 90],
          row: [0, 0, 1],
          color: [RED, GREEN, BLUE],
          scale: {
            kind: 'categorical',
            field: 'type',
            domain: [],
            entries: [
              { value: 'exon', color: RED },
              { value: 'CDS', color: GREEN },
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
  expect(keyed()).toEqual(['CDS', 'exon', 'gene'])
  expect(display.domain![1]).toBeGreaterThanOrEqual(90)
  display.hideGroup('b')
  expect(keyed()).toEqual(['CDS', 'exon'])
  expect(display.domain![1]).toBeLessThan(90)
})

test("a threshold key keeps the no-value row another region paints after a hidden section took one region's", () => {
  const { display } = createTestEnvironment(
    [
      {
        mark: 'bar',
        encoding: {
          y: 'score',
          color: { field: 'pip', scale: 'threshold', domain: [0.5] },
        },
      },
    ],
    REGION,
    'BedAdapter',
    { facet: 'sample' },
  ).createDisplay()
  const LOW = cssColorToABGR(thresholdPalette(2)[0]!)
  const threshold = {
    kind: 'threshold' as const,
    field: 'pip',
    domain: [0.5],
    missing: true,
  }
  display.setRpcData(
    0,
    result(
      [
        {
          y: [3, 4],
          row: [0, 1],
          color: [NO_VALUE_ABGR, LOW],
          scale: threshold,
        },
      ],
      [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
      ],
    ),
    REGION,
  )
  display.setRpcData(
    1,
    result(
      [{ y: [5], row: [0], color: [NO_VALUE_ABGR], scale: threshold }],
      [{ key: 'b', firstRow: 0, rowCount: 1 }],
    ),
    REGION,
  )
  const keyed = () =>
    display.colorScales.flatMap(c =>
      c.kind === 'categorical' ? c.entries.map(e => e.label) : [],
    )
  expect(keyed()).toContain('(no value)')
  display.hideGroup('a')
  expect(keyed()).toContain('(no value)')
})

test("a span ramp's key drops the no-value row with the section that painted it", () => {
  const { display } = createTestEnvironment(
    [
      {
        mark: 'span',
        encoding: { color: { field: 'score', scale: 'linear' } },
      },
    ],
    REGION,
    'BedAdapter',
    { facet: 'sample' },
  ).createDisplay()
  display.setRpcData(
    0,
    result(
      [
        {
          y: [0, 0],
          row: [0, 1],
          color: [NO_VALUE_ABGR, 0xff0000ff],
          scale: { ...ramp([1, 1]), missing: true },
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
      c.kind === 'categorical' ? c.entries.map(e => e.label) : [],
    )
  expect(keyed()).toContain('(no value)')
  display.hideGroup('a')
  expect(keyed()).not.toContain('(no value)')
})

test("a key over the facet's field follows the sections' order", () => {
  const { display } = createTestEnvironment(
    [
      {
        mark: 'bar',
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
  expect(display.markTypes).toEqual([])
  expect(display.rpcProps().layers).toEqual([])
  display.conf.setSubschema(
    'marks',
    defaultPlotMarks({ numeric: ['score'], categorical: ['name'] })!,
  )
  expect(display.markTypes).toEqual(['bar'])
  expect(display.rpcProps().layers[0]!.encoding.y).toBe('score')
})

test('the dialog submit writes the plot and its binned count into config', () => {
  const { createDisplay } = createTestEnvironment([])
  const { display } = createDisplay()
  display.setPlotFields({ numeric: ['score'], categorical: ['repClass'] })
  display.setPlotMarks({
    field: 'score',
    mark: 'point',
    colorField: 'repClass',
    binned: true,
  })
  expect(display.markTypes).toEqual(['point', 'bar'])
  expect(display.conf.marks[0]!.encoding.color.scale).toBe('categorical')
  expect(display.conf.marks[0]!.maxBpPerPx).toBe(BINNED_BP_PER_PX)
  expect(display.conf.marks[1]!.minBpPerPx).toBe(BINNED_BP_PER_PX)
  expect(
    display.conf.marks[1]!.transform.map((s: { type: string }) => s.type),
  ).toEqual(['bin', 'aggregate'])
  expect(display.plotSpec).toMatchObject({
    field: 'score',
    mark: 'point',
    colorField: 'repClass',
    binned: true,
  })
  expect(display.plotSpecReplaces).toBe(0)
})

test('a dialog submit over a display already faceted by source keeps its section order', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { facet: { field: 'source', domain: ['tumor', 'normal'] } },
  )
  const { display } = createDisplay()
  display.setPlotFields({
    numeric: ['score'],
    categorical: [],
    rows: 'source',
  })
  display.setPlotMarks({ ...display.plotSpec, mark: 'point' })
  expect(display.markTypes).toEqual(['point'])
  expect(display.facet).toEqual({
    field: 'source',
    domain: ['tumor', 'normal'],
  })
})

test('a dialog submit over a display drawing a row per source keeps drawing rows', () => {
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    REGION,
    'BedAdapter',
    { rows: 'source' },
  )
  const { display } = createDisplay()
  expect(display.drawsRows).toBe(true)
  display.setPlotFields({
    numeric: ['score'],
    categorical: [],
    rows: 'source',
  })
  display.setPlotMarks({ ...display.plotSpec, mark: 'point' })
  expect(display.markTypes).toEqual(['point'])
  expect(display.facet).toBeUndefined()
  expect(display.drawsRows).toBe(true)
})

// A config the dialog cannot read back is one a save would replace, and the
// dialog says so before it does.
test('a declared list the dialog cannot read counts as what a save replaces', () => {
  const { createDisplay } = createTestEnvironment([
    { mark: 'span', transform: [{ type: 'pileup' }], encoding: {} },
    { mark: 'bar', encoding: { y: 'score' } },
  ])
  const { display } = createDisplay()
  expect(display.plotSpecReplaces).toBe(2)
})

// The dialog writes a colour object it did not author every member of, so a
// reopen and save has to hand the declared range and order back.
test('a reopened plot keeps the colour domain and range it was declared with', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: {
          field: 'repClass',
          scale: 'categorical',
          domain: ['Alu', 'L1'],
          range: ['red', 'blue'],
        },
      },
    },
  ])
  const { display } = createDisplay()
  display.setPlotFields({ numeric: ['score'], categorical: ['repClass'] })
  display.setPlotMarks(display.plotSpec)
  const { color } = display.conf.marks[0]!.encoding
  expect([...color.domain]).toEqual(['Alu', 'L1'])
  expect([...color.range]).toEqual(['red', 'blue'])
})

// Categorical whatever else is written: a range beside an unset scale used to
// make it linear, so emptying the range in the editor flipped the scale.
test('a color or shape naming a field and no scale reads it categorically, a range beside it or not', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'point',
      encoding: {
        y: 'score',
        color: { field: 'source' },
        shape: { field: 'type' },
      },
    },
    {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'score', range: ['white', 'red'] },
      },
    },
  ])
  const { display } = createDisplay()
  expect(display.encodings[0]!.color).toMatchObject({
    field: 'source',
    scale: 'categorical',
  })
  expect(display.encodings[0]!.shape).toMatchObject({
    field: 'type',
    scale: 'categorical',
  })
  expect(display.encodings[1]!.color).toMatchObject({
    field: 'score',
    scale: 'categorical',
    range: ['white', 'red'],
  })
})

// A bin writes a missing field's edges as NaN, so the aggregate's group
// behind it has no position and the encoder skips it: the notice has to
// name the field the bin read, not the `y` every group has.
test('a feature skipped for its position names the field the bin could not read', () => {
  const { createDisplay } = createTestEnvironment([
    {
      mark: 'bar',
      transform: [
        { type: 'bin', field: 'INFO.AF', step: 0.1 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      encoding: { y: 'count' },
    },
  ])
  const { display } = createDisplay()
  const features = [0.25, 0.35, undefined].map(
    (af, i) =>
      new SimpleFeature({
        uniqueId: `v${i}`,
        refName: 'ctgA',
        start: i * 10,
        end: i * 10 + 1,
        INFO: af === undefined ? {} : { AF: [af] },
      }),
  )
  const [request] = display.layerRequests
  display.setRpcData(
    0,
    {
      layers: [
        encodeFeatures(
          runTransforms(features, request!.transform!),
          request!.encoding,
          request!.lanes,
        ),
      ],
    },
    REGION,
  )
  expect(display.skippedFeatures).toEqual({
    skipped: 1,
    total: 3,
    fields: ['INFO.AF'],
  })
})

function scanEnvironment(answers: (() => Promise<unknown>)[]) {
  const scanned: unknown[] = []
  const { createDisplay } = createTestEnvironment(
    [{ mark: 'bar', encoding: { y: 'score' } }],
    WIDE_REGION,
    'BedAdapter',
    {},
    (_sessionId, method, args) => {
      if (method === 'MarkScanPlotFields') {
        scanned.push((args as { regions: unknown }).regions)
        return answers[scanned.length - 1]!()
      }
      return new Promise(() => {})
    },
  )
  return { ...createDisplay(), scanned }
}

const SCORED = () => Promise.resolve({ numeric: ['score'], categorical: [] })
const NOTHING = () => Promise.resolve({ numeric: [], categorical: [] })

test('a scan finding no numeric field answers only for the window it read', async () => {
  const { display, view, scanned } = scanEnvironment([NOTHING, SCORED])
  expect(await display.ensurePlotFields()).toEqual({
    numeric: [],
    categorical: [],
  })
  expect(display.plotScanLocus).toBe('ctgA:1..20,000')
  await display.ensurePlotFields()
  expect(scanned).toHaveLength(1)
  view.setNewView(1, 1_000_000)
  expect((await display.ensurePlotFields()).numeric).toEqual(['score'])
  expect(scanned).toHaveLength(2)
  view.setNewView(1, 3_000_000)
  await display.ensurePlotFields()
  expect(scanned).toHaveLength(2)
})

test('a scan a newer one aborted answers with the newer one', async () => {
  let rejectFirst: (e: Error) => void = () => {}
  const { display, view, scanned } = scanEnvironment([
    () =>
      new Promise((_resolve, reject) => {
        rejectFirst = reject
      }),
    SCORED,
  ])
  const first = display.ensurePlotFields()
  view.setNewView(1, 1_000_000)
  const second = display.ensurePlotFields()
  expect(scanned).toHaveLength(2)
  expect((await second).numeric).toEqual(['score'])
  rejectFirst(new DOMException('aborted', 'AbortError'))
  expect((await first).numeric).toEqual(['score'])
  expect(display.plotFields?.numeric).toEqual(['score'])
  expect(display.plotFieldsError).toBeUndefined()
})

test('a failed scan is tried again on the next ask', async () => {
  const { display, scanned } = scanEnvironment([
    () => Promise.reject(new Error('network')),
    SCORED,
  ])
  await expect(display.ensurePlotFields()).rejects.toThrow('network')
  expect(String(display.plotFieldsError)).toMatch('network')
  expect((await display.ensurePlotFields()).numeric).toEqual(['score'])
  expect(display.plotFieldsError).toBeUndefined()
  expect(scanned).toHaveLength(2)
})

const LINK = {
  mark: 'link',
  encoding: {
    x2: { chrom: 'mate.refName', pos: 'mate.start' },
    size: { field: 'score', scale: 'log', range: [1, 8] },
    color: 'red',
  },
  transform: [{ type: 'mate' }],
}

function linkLayer(
  x: number[],
  x2: number[],
  x2Ref: number[],
  x2RefNames: string[],
  size?: number[],
): Layer {
  const count = x.length
  return {
    count,
    skipped: 0,
    x: Uint32Array.from(x),
    x2: Uint32Array.from(x2),
    x2Ref: Uint32Array.from(x2Ref),
    x2RefNames,
    color: new Uint32Array(count),
    featureIndex: Uint32Array.from(x.map((_, i) => i)),
    yMin: Infinity,
    yMax: -Infinity,
    ...(size
      ? {
          size: Float32Array.from(size),
          sizeScale: {
            field: 'score',
            scale: 'log' as const,
            domain: [Math.min(...size), 100] as [number, number],
            pinned: [false, true] as [boolean, boolean],
            range: [1, 8] as [number, number],
            extent: [Math.min(...size), Math.max(...size)] as [number, number],
          },
        }
      : {}),
  }
}

test('a link mark sends its far foot as a locus, its size as a scale, and asks for the lanes both need', () => {
  const { display } = createTestEnvironment([LINK]).createDisplay()
  expect(display.hasLinkMark).toBe(true)
  expect(display.rpcProps().layers[0]).toMatchObject({
    encoding: {
      x2: { chrom: 'mate.refName', pos: 'mate.start' },
      size: { field: 'score', scale: 'log', range: [1, 8] },
    },
    lanes: ['row', 'color', 'colorValue', 'size', 'x2Ref', 'index'],
    transform: [{ type: 'mate' }],
  })
  expect(display.markList.map(m => m.pass.id)).toEqual(['link#0'])
  // unwritten, a link strokes at its own 2 px rather than a point's diameter
  expect(display.markSizes).toEqual([2])
  const plain = createTestEnvironment([
    { mark: 'link', encoding: { x2: 'mate.start' }, size: 3 },
  ]).createDisplay().display
  expect(plain.rpcProps().layers[0]).toMatchObject({
    encoding: { x2: 'mate.start' },
    lanes: ['row', 'color', 'colorValue', 'x2Ref', 'index'],
  })
  expect(plain.markSizes).toEqual([3])
  expect(plain.markEntries[0]).toMatchObject({
    linkShape: 'dome',
    valued: false,
  })
})

test('each far foot resolves to the displayed region holding it, or to none', () => {
  const ctgB = { refName: 'ctgB', start: 0, end: 5000, assemblyName: 'volvox' }
  const { display } = createTestEnvironment(
    [LINK],
    [REGION, ctgB],
  ).createDisplay()
  display.setRpcData(
    0,
    {
      layers: [
        linkLayer(
          [100, 200, 300, 400],
          [5000, 4000, 9000, 42],
          [0, 1, 1, 2],
          ['ctgA', 'ctgB', 'ctgC'],
        ),
      ],
    },
    REGION,
  )
  const [layer] = display.rpcDataMap.get(0)!.layers
  expect([...layer!.x2Region!]).toEqual([0, 1, LINK_NO_REGION, LINK_NO_REGION])
  // a display with no link mark hands its payloads through untouched
  const bars = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' } },
  ]).createDisplay().display
  bars.setRpcData(0, result([{ y: [1] }]), REGION)
  expect(bars.rpcDataMap.get(0)!.layers[0]!.x2Region).toBeUndefined()
})

test("a far foot on the block's own contig places through the block's own region", () => {
  const sub = {
    refName: 'ctgA',
    start: 1000,
    end: 2000,
    assemblyName: 'volvox',
  }
  const past = createTestEnvironment([LINK], [sub]).createDisplay().display
  past.setRpcData(
    0,
    { layers: [linkLayer([1500], [2500], [0], ['ctgA'])] },
    sub,
  )
  expect([...past.rpcDataMap.get(0)!.layers[0]!.x2Region!]).toEqual([0])

  const reversed = { ...REGION, reversed: true }
  const twice = createTestEnvironment(
    [LINK],
    [REGION, reversed],
  ).createDisplay().display
  twice.setRpcData(
    1,
    { layers: [linkLayer([100], [200], [0], ['ctgA'])] },
    reversed,
  )
  expect([...twice.rpcDataMap.get(1)!.layers[0]!.x2Region!]).toEqual([1])
})

test('the link regions place a bp where the view does, and are empty without a link mark', () => {
  const ctgB = { refName: 'ctgB', start: 0, end: 5000, assemblyName: 'volvox' }
  const { display, view } = createTestEnvironment(
    [LINK],
    [REGION, ctgB],
  ).createDisplay()
  view.scrollTo(300)
  const regions = display.linkRegions
  expect(regions).toHaveLength(2)
  for (const [i, { refName, coord }] of [
    [0, { refName: 'ctgA', coord: 4000 }],
    [1, { refName: 'ctgB', coord: 1234 }],
  ] as const) {
    const { anchorPx, anchorBp, signedPxPerBp } = regions[i]!
    const px = anchorPx + (coord - anchorBp) * signedPxPerBp
    const own = view.bpToPx({ refName, coord })!.offsetPx - view.offsetPx
    expect(Math.abs(px - own)).toBeLessThan(1)
    // the anchor is a bp of the region, near the view's left edge
    expect(anchorBp).toBeGreaterThanOrEqual(i === 0 ? REGION.start : ctgB.start)
  }
  const bars = createTestEnvironment([
    { mark: 'bar', encoding: { y: 'score' } },
  ]).createDisplay().display
  expect(bars.linkRegions).toEqual([])
})

test('a size scale unions its open end over the regions and keeps the pinned one', () => {
  const ctgB = { refName: 'ctgB', start: 0, end: 5000, assemblyName: 'volvox' }
  const { display } = createTestEnvironment(
    [LINK],
    [REGION, ctgB],
  ).createDisplay()
  display.setRpcData(
    0,
    { layers: [linkLayer([100], [200], [0], ['ctgA'], [10])] },
    REGION,
  )
  display.setRpcData(
    1,
    { layers: [linkLayer([100], [200], [0], ['ctgB'], [3])] },
    ctgB,
  )
  expect(display.sizeScales).toEqual([
    { domain: [3, 100], scale: 'log', range: [1, 8] },
  ])
  expect(display.renderState.sizeScales).toEqual(display.sizeScales)
})

test('a hidden section leaves the link stroke domain the way it leaves the key', () => {
  const { display } = createTestEnvironment([LINK], REGION, 'BedAdapter', {
    facet: 'sample',
  }).createDisplay()
  display.setRpcData(
    0,
    {
      layers: [
        {
          ...linkLayer([100, 300], [200, 400], [0, 0], ['ctgA'], [3, 50]),
          row: Uint32Array.from([0, 1]),
        },
      ],
      facet: [
        { key: 'a', firstRow: 0, rowCount: 1 },
        { key: 'b', firstRow: 1, rowCount: 1 },
      ],
    },
    REGION,
  )
  expect(display.sizeScales[0]!.domain).toEqual([3, 100])
  display.hideGroup('a')
  expect(display.sizeScales[0]!.domain).toEqual([50, 100])
})

test('a scan finding a mate writes the link and its step, with nothing declared', async () => {
  const { display } = createTestEnvironment(
    [],
    WIDE_REGION,
    'BedAdapter',
    {},
    (_sessionId, method) =>
      method === 'MarkScanPlotFields'
        ? Promise.resolve({
            numeric: ['score'],
            categorical: [],
            mated: 'mate',
          })
        : new Promise(() => {}),
  ).createDisplay()
  await waitFor(() => {
    expect(display.markTypes).toEqual(['link'])
  })
  expect(display.rpcProps().layers[0]!.transform).toEqual([{ type: 'mate' }])
  expect(display.rpcProps().layers[0]!.encoding.x2).toEqual({
    chrom: 'mate.refName',
    pos: 'mate.start',
  })
})
