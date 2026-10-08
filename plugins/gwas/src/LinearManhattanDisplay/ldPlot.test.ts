import fs from 'node:fs'
import path from 'node:path'

import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { diffTrackConfig } from '@jbrowse/core/util'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { INDEX_SNP_MISSING } from '../GWASAdapter/ldJoin.ts'
import { LD_COLOR, LD_INDEX_COLOR, LD_MARKS, MANHATTAN_MARK } from './ldPlot.ts'
import { manhattanFixture, topHitFacts } from './manhattan.fixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LinearManhattanDisplayModel } from './stateModelFactory.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { EncodedLayersResult } from '@jbrowse/core/util/markEncoding'
import type { MarkSnapshot } from '@jbrowse/plugin-marks'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 10_000,
  assemblyName: 'volvox',
}

function labels(items: MenuItem[]): string[] {
  return items.flatMap(i => [
    'label' in i && typeof i.label === 'string' ? i.label : '',
    ...('subMenu' in i ? labels(resolveSubMenu(i)) : []),
  ])
}

function marksOf(display: LinearManhattanDisplayModel): MarkSnapshot[] {
  return getSnapshot(display.conf.marks)
}

function ldItem(display: LinearManhattanDisplayModel) {
  const ld = display
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'LD')
  return ld && 'subMenu' in ld
    ? resolveSubMenu(ld).find(
        i => 'label' in i && i.label === 'Color by LD to index SNP',
      )
    : undefined
}

const HIT = {
  regionIndex: 0,
  instance: 0,
  featureIndex: 0,
  refName: 'ctgA',
  start: 499,
  end: 500,
  bp: 499,
  y: undefined,
  color: undefined,
  colorValue: undefined,
  glyph: undefined,
  row: undefined,
  screenX: 0,
  screenY: 0,
}

test('an unwritten plot is a point per feature at its score, which a snapshot leaves out', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(getSnapshot(display.conf.marks)).toEqual([MANHATTAN_MARK])
  expect(getSnapshot(display.conf)).not.toHaveProperty('marks')
  expect(display.plot.marks).toEqual([MANHATTAN_MARK])
  expect(display.layerRequests[0]?.encoding).toMatchObject({ y: 'score' })
  expect(display.gateEnabled).toBe(false)
})

test('the join runs where a mark names an LD field and the adapter has an LD file', () => {
  expect(createTestEnvironment().createDisplay().display.joinsLd).toBe(false)
  expect(
    createTestEnvironment({ marks: LD_MARKS }).createDisplay().display.joinsLd,
  ).toBe(true)
  expect(
    createTestEnvironment({
      marks: LD_MARKS,
      ldAdapter: false,
    }).createDisplay().display.joinsLd,
  ).toBe(false)
  const byRole = {
    mark: 'point',
    encoding: { y: 'score', shape: { field: 'ld_role' } },
  }
  expect(
    createTestEnvironment({ marks: [byRole] }).createDisplay().display.joinsLd,
  ).toBe(true)
})

// A plot restored with no index asks for no join, and the first load's top hit
// is what the join then reads r² to.
test('the index SNP is a fetch input only while the plot joins LD', () => {
  const plain = createTestEnvironment().createDisplay({
    displaySnapshot: { indexSnp: 'ctgA:101' },
  }).display
  expect(plain.rpcProps()).not.toHaveProperty('opts')

  const ld = createTestEnvironment({ marks: LD_MARKS }).createDisplay().display
  expect(ld.rpcProps()).not.toHaveProperty('opts')
  ld.setIndexSnp('ctgA:101')
  expect(ld.rpcProps().opts).toEqual({ ld: 'ctgA:101' })
})

test("LD colouring makes the default plot LocusZoom's, as the add-track workflow writes it, and the transform stays", () => {
  const { display } = createTestEnvironment().createDisplay()
  const transform = [{ type: 'filter', expr: "jexl:get(feature,'score') > 1" }]
  display.applyDisplaySettings({ transform })
  display.setLdColoring(true)
  expect(display.joinsLd).toBe(true)
  expect(marksOf(display)).toEqual(
    marksOf(createTestEnvironment({ marks: LD_MARKS }).createDisplay().display),
  )
  const [partners, index] = display.encodings
  expect(display.markColors).toMatchObject([
    {
      kind: 'numbers',
      encoding: {
        field: 'r2',
        scale: 'threshold',
        domain: LD_COLOR.domain,
        range: LD_COLOR.range,
      },
    },
    { kind: 'constant', color: cssColorToABGR(LD_INDEX_COLOR) },
  ])
  expect(partners?.color).toEqual({ field: 'r2', scale: 'threshold' })
  expect(index?.shape).toMatchObject({
    field: 'ld_role',
    domain: ['index'],
    range: ['diamond'],
  })
  expect(display.plot.transform).toEqual(transform)

  display.setLdColoring(false)
  expect(display.joinsLd).toBe(false)
  expect(getSnapshot(display.conf)).not.toHaveProperty('marks')
  expect(display.plot.transform).toEqual(transform)
})

const DEMO_LD_PLOT = (
  JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, '../../../../test_data/config_gwas.json'),
      'utf8',
    ),
  ) as {
    tracks: {
      trackId: string
      displays: { marks: Record<string, unknown>[] }[]
    }[]
  }
).tracks.find(t => t.trackId === 'sle_gwas_ld')!.displays[0]!.marks

// Unticking and ticking again leaves the plot as it was, so the session delta
// drops `marks` and the track follows its admin's plot again.
test.each([
  ['the default plot', undefined],
  ['the SLE demo, whose points are 7 px', DEMO_LD_PLOT],
  [
    'labels over the top hits',
    [
      MANHATTAN_MARK,
      {
        mark: 'text',
        transform: [{ type: 'filter', expr: 'jexl:feature.score > 8' }],
      },
    ],
  ],
  [
    'a shape scale over svtype',
    [
      {
        mark: 'point',
        encoding: {
          y: 'score',
          shape: { field: 'svtype', domain: ['INS'], range: ['triangle-down'] },
        },
      },
    ],
  ],
  [
    'a constant colour',
    [{ mark: 'point', encoding: { y: 'score', color: { value: 'green' } } }],
  ],
  [
    'bins zoomed out and points zoomed in',
    [
      {
        mark: 'bar',
        minBpPerPx: 1000,
        transform: [
          { type: 'bin', step: 'auto' },
          { type: 'aggregate', ops: [{ op: 'max', field: 'score' }] },
        ],
      },
      { ...MANHATTAN_MARK, maxBpPerPx: 1000 },
    ],
  ],
])('a round trip through LD colouring keeps %s', (_, marks) => {
  const { display } = createTestEnvironment({ marks }).createDisplay()
  const before = getSnapshot(display.conf)
  const colored = display.joinsLd
  display.setLdColoring(!colored)
  expect(display.joinsLd).toBe(!colored)
  display.setLdColoring(colored)
  expect(display.joinsLd).toBe(colored)
  expect(diffTrackConfig(before, getSnapshot(display.conf))).not.toHaveProperty(
    'marks',
  )
})

test('LD colouring leaves every other mark and member where it was', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'point',
        encoding: { y: 'score', color: { value: 'green' }, size: 6 },
      },
      {
        mark: 'text',
        transform: [{ type: 'filter', expr: 'jexl:feature.score > 8' }],
      },
    ],
  }).createDisplay()
  display.setLdColoring(true)
  const [partners, index, labels] = marksOf(display)
  expect(partners).toMatchObject({
    encoding: {
      color: { value: 'green', field: 'r2', scale: 'threshold' },
      size: { value: 6 },
    },
  })
  expect(index).toMatchObject({
    encoding: { color: { value: LD_INDEX_COLOR }, size: { value: 6 } },
  })
  expect(labels).toMatchObject({ mark: 'text' })
  expect(display.encodings[0]?.color).toMatchObject({ field: 'r2' })

  display.setPointSize(9)
  display.setLdColoring(false)
  expect(marksOf(display)).toEqual([
    {
      mark: 'point',
      encoding: { y: 'score', color: { value: 'green' }, size: { value: 9 } },
    },
    {
      mark: 'text',
      transform: [{ type: 'filter', expr: 'jexl:feature.score > 8' }],
    },
  ])
})

test('every index twin draws after the last partner, so the index is over every point', () => {
  const { display } = createTestEnvironment({
    marks: [
      { ...MANHATTAN_MARK, maxBpPerPx: 1000 },
      {
        ...MANHATTAN_MARK,
        minBpPerPx: 1000,
        encoding: { ...MANHATTAN_MARK.encoding, size: 2 },
      },
    ],
  }).createDisplay()
  display.setLdColoring(true)
  expect(
    marksOf(display).map(m => [
      m.transform?.find(step => step.type === 'filter')?.expr,
      m.maxBpPerPx ?? m.minBpPerPx,
    ]),
  ).toEqual([
    ["jexl:feature.ld_role != 'index'", 1000],
    ["jexl:feature.ld_role != 'index'", 1000],
    ["jexl:feature.ld_role == 'index'", 1000],
    ["jexl:feature.ld_role == 'index'", 1000],
  ])
  display.setLdColoring(true)
  expect(marksOf(display)).toHaveLength(4)
})

test('a plot with no point placing each SNP greys the item out and changes nothing', () => {
  const bars = [{ mark: 'bar', encoding: { y: 'score' } }]
  const binned = [
    { ...MANHATTAN_MARK, transform: [{ type: 'bin', step: 1000 }] },
  ]
  for (const marks of [bars, binned]) {
    const { display } = createTestEnvironment({ marks }).createDisplay()
    expect(display.ldColorable).toBe(false)
    const item = ldItem(display)
    expect(item).toMatchObject({ disabled: true })
    expect(item).toHaveProperty(
      'disabledHelpText',
      expect.stringMatching(/Edit plot/),
    )
    display.setLdColoring(true)
    expect(marksOf(display)).toEqual(
      marksOf(createTestEnvironment({ marks }).createDisplay().display),
    )
  }
})

test('unticking a hand-edited LD plot leaves no mark reading LD', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'point',
        transform: [{ type: 'filter', expr: "jexl:feature.ld_role!='index'" }],
        encoding: { y: 'score', color: LD_COLOR, size: { field: 'r2' } },
      },
      {
        mark: 'point',
        transform: [
          { type: 'filter', expr: "jexl: feature.ld_role == 'index'" },
        ],
        encoding: { y: 'score', color: { value: '#c951c9' } },
      },
      { mark: 'text', encoding: { text: 'r2' } },
    ],
  }).createDisplay()
  expect(display.joinsLd).toBe(true)
  expect(ldItem(display)).toMatchObject({ disabled: false })
  display.setLdColoring(false)
  expect(display.joinsLd).toBe(false)
  expect(marksOf(display)).toEqual([
    { mark: 'point', encoding: { y: 'score' } },
  ])
})

test('right-click offers LD to a SNP only on a mark that places each SNP', () => {
  const { display } = createTestEnvironment({
    marks: [
      {
        mark: 'bar',
        transform: [
          { type: 'bin', step: 1000 },
          { type: 'aggregate', ops: [{ op: 'max', field: 'score' }] },
        ],
      },
      MANHATTAN_MARK,
    ],
  }).createDisplay()
  const offered = (markIndex: number) => {
    display.openContextMenu({
      clientX: 0,
      clientY: 0,
      hit: { ...HIT, markIndex },
    })
    return labels(display.contextMenuItems()).some(l =>
      l.startsWith('Color by LD to ctgA'),
    )
  }
  expect(offered(0)).toBe(false)
  expect(offered(1)).toBe(true)
})

test('right-clicking a point colours by LD to it and pins it', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.colorByLdToHit({ refName: 'ctgA', start: 499 })
  expect(display.joinsLd).toBe(true)
  expect(display.indexSnp).toBe('ctgA:500')
  expect(display.indexSnpPinned).toBe(true)

  display.useTopHitAsIndex()
  expect(display.indexSnpPinned).toBe(false)
})

test('the LD menu is there only for a track with an LD file', () => {
  const withLd = createTestEnvironment().createDisplay().display
  expect(labels(withLd.trackMenuItems())).toEqual(
    expect.arrayContaining([
      'Edit plot...',
      'LD',
      'Color by LD to index SNP',
      'Set index SNP to top hit',
    ]),
  )
  const without = createTestEnvironment({ ldAdapter: false }).createDisplay()
    .display
  expect(labels(without.trackMenuItems())).not.toContain('LD')
})

// A focus uploads one table and no instance bytes, which a moved index would
// undo with a refetch of every region.
test('the top hit reads every loaded row, focused out or not', () => {
  const { display } = createTestEnvironment({
    marks: LD_MARKS,
    rows: 'source',
  }).createDisplay()
  display.setRpcData(
    0,
    {
      layers: [
        manhattanFixture({
          x: [100, 500],
          y: [3, 9],
          flatbush: false,
          row: Uint32Array.from([0, 1]),
        }),
        manhattanFixture({ x: [], y: [], flatbush: false }),
      ],
      facet: [
        { key: 'p1', firstRow: 0, rowCount: 1 },
        { key: 'p2', firstRow: 1, rowCount: 1 },
      ],
      facts: topHitFacts(500, 9),
    },
    REGION,
  )
  expect(display.topSnp).toBe('ctgA:501')
  display.setRowFocus(['p1'])
  expect(display.sources.map(s => s.name)).toEqual(['p1'])
  expect(display.topSnp).toBe('ctgA:501')
})

// Without the notice an export where nothing matched the index SNP is an
// all-grey plot under a full r² key. The adapter says so on the region it
// found the index in, and the corner notice says it once however many do.
test('a region whose join found no partner carries the notice to the corner', () => {
  const { display } = createTestEnvironment({ marks: LD_MARKS }).createDisplay()
  const load = (notices?: string[]): EncodedLayersResult => ({
    layers: [
      manhattanFixture({ x: [200], y: [3], flatbush: false }),
      manhattanFixture({ x: [100], y: [5], flatbush: false }),
    ],
    ...(notices ? { notices } : {}),
  })
  display.setRpcData(0, load(), REGION)
  expect(display.notices).toEqual([])
  display.setRpcData(0, load([INDEX_SNP_MISSING]), REGION)
  display.setRpcData(1, load([INDEX_SNP_MISSING]), {
    ...REGION,
    refName: 'ctgB',
  })
  expect(display.notices).toEqual([
    expect.stringMatching(/^No point has LD data to the index SNP/),
  ])
})
