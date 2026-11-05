import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { colorKeyTables } from '@jbrowse/core/ui/rampKey'
import { cssColorToHex } from '@jbrowse/core/util/colorBits'
import { DEFAULT_RULE_COLOR } from '@jbrowse/display-ui/yAxisConstants'
import WigglePlugin from '@jbrowse/plugin-wiggle'

import { createTablesEngine } from '../index.ts'
import {
  COVERAGE_BIGWIG,
  MULTI_BIGWIG,
  SIGNED_BIGWIG,
} from '../volvox.fixture.ts'
import { hasDisplayType, standUpDisplay } from './testEnv.ts'
import { parityCases } from './testUtils.ts'

import type { WiggleTables } from '../index.ts'
import type { ParityAdapter } from './testUtils.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { LinearWiggleDisplayModel } from '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel'

interface WiggleFixture {
  adapterConfig: Record<string, unknown>
  region: TablesRegion
  contigLength: number
  bpPerPx: number
  trackType: 'QuantitativeTrack' | 'MultiQuantitativeTrack'
}

const WIGGLE_DECISIONS = [
  'rows',
  'markColors',
  'domain',
  'scaleType',
  'rules',
  'ramps',
  'legend',
  'layout',
  'height',
] as const

type WiggleDecision = (typeof WIGGLE_DECISIONS)[number]

const hexOrEmpty = (color: string | undefined) =>
  color ? cssColorToHex(color) : ''

const engine = createTablesEngine()

/**
 * The wiggle display beside `engine.wiggle` over one fixture: the rows in
 * order with their labels and groups, each row's mark color, the score
 * domain and scale type, the rules the axis draws, the score ramp and the
 * categorical key, the row layout, summary and origin, and the height.
 */
function wiggleParity(
  fixture: WiggleFixture,
): ParityAdapter<
  Record<string, unknown>,
  LinearWiggleDisplayModel,
  WiggleTables,
  WiggleDecision
> {
  return {
    decisionNames: WIGGLE_DECISIONS,
    buildModel: async display => {
      const { display: model, dispose } =
        await standUpDisplay<LinearWiggleDisplayModel>({
          plugins: [new WigglePlugin()],
          track: { type: fixture.trackType, adapter: fixture.adapterConfig },
          displayType: 'LinearWiggleDisplay',
          isDisplay: (d): d is LinearWiggleDisplayModel =>
            hasDisplayType(d, 'LinearWiggleDisplay'),
          displayConfig: display,
          region: fixture.region,
          contigLength: fixture.contigLength,
          bpPerPx: fixture.bpPerPx,
        })
      return { model, dispose }
    },
    buildExport: display =>
      engine.wiggle({
        adapterConfig: fixture.adapterConfig,
        region: fixture.region,
        bpPerPx: fixture.bpPerPx,
        trackType: fixture.trackType,
        display,
      }),
    modelDecisions: m => {
      const key = colorKeyTables(m.colorScales)
      return {
        rows: m.sources.map(s => ({
          name: s.name,
          label: s.label ?? s.name,
          group: s.group ?? '',
        })),
        markColors: m.markSources.map(s => hexOrEmpty(s.color)),
        domain: m.domain,
        scaleType: m.scaleType,
        rules: m.scoreRulesDrawn
          ? m.scoreRules.map(r => ({
              value: r.value,
              color: cssColorToHex(r.color ?? DEFAULT_RULE_COLOR),
              label: r.label ?? '',
            }))
          : [],
        ramps: key.ramps,
        legend: key.legend,
        layout: {
          rowLayout: m.isRowLayout,
          summaryField: m.summaryField,
          origin: m.origin,
        },
        height: m.height,
      }
    },
    exportDecisions: t => ({
      rows: t.sources.name.map((name, i) => ({
        name,
        label: t.sources.label[i],
        group: t.sources.group[i],
      })),
      markColors: t.sources.color,
      domain: t.scoreScale.domain,
      scaleType: t.scoreScale.type,
      rules: t.rules.value.map((value, i) => ({
        value,
        color: t.rules.color[i],
        label: t.rules.label[i],
      })),
      ramps: t.ramps,
      legend: t.legend,
      layout: {
        rowLayout: t.rowLayout,
        summaryField: t.summaryField,
        origin: t.origin,
      },
      height: t.height,
    }),
  }
}

const CTGA = { refName: 'ctgA', start: 0, end: 50_000 }
const CTGA_LENGTH = 50_001

const multi = wiggleParity({
  adapterConfig: MULTI_BIGWIG.adapterConfig,
  region: CTGA,
  contigLength: CTGA_LENGTH,
  bpPerPx: 50,
  trackType: 'MultiQuantitativeTrack',
})

describe('a MultiQuantitativeTrack of three signed BigWigs', () => {
  parityCases(multi, [
    { name: 'defaults', config: {} },
    {
      name: 'overlay',
      config: { rows: { field: '' } },
    },
    { name: 'rows.sort', config: { rows: { sort: ['posneg_rw3'] } } },
    {
      name: 'rows.kept',
      config: { rows: { kept: ['posneg_rw3', 'posneg_rw1'] } },
    },
    {
      name: 'rows.labels',
      config: { rows: { labels: { posneg_rw1: 'First' } } },
    },
    {
      name: 'rows.colors in rows',
      config: { rows: { colors: { posneg_rw2: '#0000ff' } } },
    },
    {
      name: 'rows.colors in an overlay',
      config: { rows: { field: '', colors: { posneg_rw2: '#0000ff' } } },
    },
    {
      name: 'rows.color by name in an overlay',
      config: { rows: { field: '', color: 'name' } },
    },
    {
      name: 'rows.tree',
      config: {
        rows: { tree: '((posneg_rw3:1,posneg_rw1:1):1,posneg_rw2:2);' },
      },
    },
    {
      name: 'encoding.color source in rows',
      config: { encoding: { color: 'source' } },
    },
    {
      name: 'encoding.y pinned bounds',
      config: {
        encoding: { y: { scale: { domainMin: -50, domainMax: 300 } } },
      },
    },
    {
      name: 'encoding.y one pinned end',
      config: { encoding: { y: { scale: { domainMax: 40 } } } },
    },
    {
      name: 'encoding.y zero off',
      config: { encoding: { y: { scale: { zero: false } } } },
    },
    {
      name: 'encoding.y symlog',
      config: { encoding: { y: { scale: { type: 'symlog' } } } },
    },
    {
      name: 'encoding.y fence',
      config: { encoding: { y: { scale: { fenceQuantile: 0.9 } } } },
    },
    {
      name: 'encoding.y maxScore',
      config: { encoding: { y: { field: 'maxScore' } } },
    },
    {
      name: 'encoding.y rules',
      config: {
        encoding: {
          y: {
            rules: [{ value: 0 }, { value: 500, color: 'red', label: 'gain' }],
          },
        },
      },
    },
    { name: 'mark line', config: { mark: 'line' } },
    { name: 'mark rect', config: { mark: 'rect' } },
    {
      name: 'mark rect, encoding.color linear',
      config: {
        mark: 'rect',
        encoding: { color: { scale: { type: 'linear', scheme: 'viridis' } } },
      },
    },
    {
      name: 'encoding.color threshold',
      config: {
        encoding: {
          color: {
            scale: {
              type: 'threshold',
              domain: [-20, 20],
              range: ['#2166ac', '#999999', '#b2182b'],
            },
          },
        },
      },
    },
    {
      name: 'encoding.color value',
      config: { encoding: { color: { value: '#008000' } } },
    },
    { name: 'height', config: { height: 120 } },
  ])
})

const subtrack = (n: number, attributes: Record<string, string>) => ({
  type: 'BigWigAdapter',
  name: `posneg_rw${n}`,
  bigWigLocation: {
    uri: pathToFileURL(path.resolve(`test_data/volvox/posneg_rw${n}.bw`)).href,
    locationType: 'UriLocation',
  },
  ...attributes,
})

const grouped = wiggleParity({
  adapterConfig: {
    type: 'MultiWiggleAdapter',
    subadapters: [
      subtrack(1, { group: 'islet', color: '#ff0000' }),
      subtrack(2, { group: 'islet' }),
      subtrack(3, { group: 'liver' }),
    ],
  },
  region: CTGA,
  contigLength: CTGA_LENGTH,
  bpPerPx: 50,
  trackType: 'MultiQuantitativeTrack',
})

describe('a MultiQuantitativeTrack whose subtracks carry a group and a color', () => {
  parityCases(grouped, [
    { name: 'defaults', config: {} },
    {
      name: 'overlay',
      config: { rows: { field: '' } },
    },
    {
      name: 'rows.filter',
      config: { rows: { filter: [{ field: 'group', oneOf: ['liver'] }] } },
    },
    {
      name: 'rows.filter and rows.kept',
      config: {
        rows: {
          filter: [{ field: 'group', oneOf: ['islet'] }],
          kept: ['posneg_rw2'],
        },
      },
    },
    {
      name: 'rows.color by group',
      config: { rows: { color: 'group' } },
    },
    {
      name: 'rows.color by group in an overlay',
      config: { rows: { field: '', color: 'group' } },
    },
    {
      name: 'rows.color by group under a pinned color',
      config: { rows: { color: 'group', colors: { posneg_rw3: '#00ff00' } } },
    },
    {
      name: 'rows.color by group, line',
      config: { mark: 'line', rows: { color: 'group' } },
    },
    {
      name: 'rows.filter, the axis over the rows left',
      config: {
        rows: { filter: [{ field: 'group', oneOf: ['islet'] }] },
        encoding: { y: { scale: { fenceQuantile: 0.95 } } },
      },
    },
  ])
})

const signed = wiggleParity({
  adapterConfig: SIGNED_BIGWIG.adapterConfig,
  region: CTGA,
  contigLength: CTGA_LENGTH,
  bpPerPx: 50,
  trackType: 'QuantitativeTrack',
})

describe('a QuantitativeTrack of one signed BigWig', () => {
  parityCases(signed, [
    { name: 'defaults', config: {} },
    { name: 'origin', config: { origin: 20 } },
    {
      name: 'encoding.y log',
      config: { encoding: { y: { scale: { type: 'log' } } } },
    },
    {
      name: 'encoding.y rules in density',
      config: { mark: 'rect', encoding: { y: { rules: [{ value: 10 }] } } },
    },
    {
      name: 'encoding.y rules outside the domain',
      config: { encoding: { y: { rules: [{ value: 5000 }] } } },
    },
    {
      name: 'encoding.color linear on bars',
      config: { encoding: { color: { scale: { type: 'linear' } } } },
    },
    {
      name: 'encoding.color legend title',
      config: {
        mark: 'rect',
        encoding: { color: { legend: { title: 'Signal' } } },
      },
    },
    { name: 'mark point', config: { mark: 'point' } },
  ])
})

const coverage = wiggleParity({
  adapterConfig: COVERAGE_BIGWIG.adapterConfig,
  region: CTGA,
  contigLength: CTGA_LENGTH,
  bpPerPx: 1000,
  trackType: 'QuantitativeTrack',
})

describe('a QuantitativeTrack zoomed out to summary bins', () => {
  parityCases(coverage, [
    { name: 'min-max extent', config: { mark: { extent: 'min-max' } } },
    {
      name: 'line with a min-max band',
      config: { mark: { type: 'line', extent: 'min-max' } },
    },
    { name: 'no extent', config: { mark: { extent: 'none' } } },
    {
      name: 'encoding.y zero off',
      config: { encoding: { y: { scale: { zero: false } } } },
    },
    {
      name: 'encoding.y log',
      config: { encoding: { y: { scale: { type: 'log' } } } },
    },
  ])
})

describe('a 10 kb window of three signed BigWigs, inside the contig', () => {
  parityCases(
    wiggleParity({
      adapterConfig: MULTI_BIGWIG.adapterConfig,
      region: { refName: 'ctgA', start: 20_000, end: 30_000 },
      contigLength: CTGA_LENGTH,
      bpPerPx: 20,
      trackType: 'MultiQuantitativeTrack',
    }),
    [
      { name: 'defaults', config: {} },
      { name: 'overlay', config: { rows: { field: '' } } },
      {
        name: 'encoding.y fence',
        config: { encoding: { y: { scale: { fenceQuantile: 0.9 } } } },
      },
    ],
  )
})
