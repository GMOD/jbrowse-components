import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import AlignmentsPlugin from '../index.ts'
import { colorSlotsOf, retiredState } from './retired.ts'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

function alignmentsEntries(displays: Record<string, unknown>[]) {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const out = preprocessTrackConfigSnapshot(pluginManager, {
    type: 'AlignmentsTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'a.bam' },
    displays,
  })
  return (out.displays as Record<string, unknown>[]).filter(
    d => d.type === 'LinearAlignmentsDisplay',
  )
}

test.each([
  [
    'LinearPileupDisplay',
    { coverage: { show: false }, sashimi: { show: false } },
  ],
  [
    'LinearSNPCoverageDisplay',
    { pileup: { show: false }, coverage: { height: 100 }, height: 100 },
  ],
  [
    'LinearReadArcsDisplay',
    {
      pileup: { show: false },
      coverage: { show: false },
      sashimi: { show: false },
      readConnections: { show: true },
    },
  ],
  [
    'LinearReadCloudDisplay',
    {
      pileup: { show: false },
      coverage: { show: false },
      sashimi: { show: false },
      readConnections: { show: true, mark: 'rule' },
    },
  ],
])('a %s entry draws the band it drew', (type, bands) => {
  expect(alignmentsEntries([{ type, displayId: `t-${type}` }])).toEqual([
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 't-LinearAlignmentsDisplay',
      ...bands,
    },
  ])
})

test('a migrated SNPCoverage entry keeps the sashimi arcs v4 drew', () => {
  const [entry] = alignmentsEntries([{ type: 'LinearSNPCoverageDisplay' }])
  expect(entry).not.toHaveProperty('sashimi')
})

test('an explicit author value wins over the band a retired type implies', () => {
  const [entry] = alignmentsEntries([
    {
      type: 'LinearSNPCoverageDisplay',
      pileup: { show: true, mark: { height: 3 } },
      height: 400,
    },
  ])
  expect(entry).toMatchObject({
    pileup: { show: true, mark: { height: 3 } },
    coverage: { height: 100 },
    height: 400,
  })
})

function bases(field: string, rest: Record<string, unknown> = {}) {
  return { bases: { show: true, encoding: { color: { field } }, ...rest } }
}

test.each([
  [{ type: 'strand' }, { encoding: { color: { field: 'strand' } } }],
  [{ type: 'mappingQuality' }, { encoding: { color: { field: 'mapq' } } }],
  [{ type: 'tag', tag: 'HP' }, { encoding: { color: { field: 'tags.HP' } } }],
  [{ type: 'perBaseLettering' }, { pileup: bases('base') }],
  [
    { type: 'methylation' },
    { pileup: bases('modifications', { unmodified: { show: true } }) },
  ],
  [
    { type: 'modifications', modifications: { twoColor: true } },
    { pileup: bases('modifications', { unmodified: { show: true } }) },
  ],
  [
    {
      type: 'modifications',
      modifications: { isolatedModification: 'm', threshold: 10 },
    },
    {
      pileup: bases('modifications', {
        filter: [
          { field: 'probability', gte: 0.1 },
          { field: 'code', oneOf: ['m'] },
        ],
      }),
    },
  ],
])('a v4 colorBy %j becomes %j', (colorBy, slots) => {
  expect(colorSlotsOf(colorBy)).toEqual(slots)
})

// The schema declares `colorBy` retired, so the shorthand router asks it the
// same question a `displays` entry does.
test('a v4 colorBy reaches the display through displayDefaults too', () => {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const out = preprocessTrackConfigSnapshot(pluginManager, {
    type: 'AlignmentsTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'a.bam' },
    displayDefaults: { colorBy: { type: 'pairOrientation' } },
  })
  expect(
    (out.displays as Record<string, unknown>[]).find(
      d => d.type === 'LinearAlignmentsDisplay',
    ),
  ).toMatchObject({ encoding: { color: { field: 'pairOrientation' } } })
})

test('lifts the settings off the pre-4.x nested sub-nodes', () => {
  expect(
    retiredState.lift({
      type: 'LinearAlignmentsDisplay',
      PileupDisplay: {
        type: 'LinearPileupDisplay',
        colorBy: { type: 'modifications' },
        filterBy: { flagInclude: 0, flagExclude: 1536 },
      },
      SNPCoverageDisplay: { type: 'LinearSNPCoverageDisplay' },
    }),
  ).toEqual({
    pileup: bases('modifications'),
    // 1536 keeps unmapped reads, which the default 1540 drops
    filter: [{ field: 'flags.UNMAP' }],
  })
  expect(retiredState.keys).toEqual(
    expect.arrayContaining(['PileupDisplay', 'SNPCoverageDisplay']),
  )
})

// what a v4.3.0 session holds: its mixin wrote the `*Setting` names back out
test('lifts the released *Setting spelling, which wins over the bare one', () => {
  expect(
    retiredState.lift({
      colorBy: { type: 'strand' },
      colorBySetting: { type: 'insertSizeAndOrientation' },
      filterBySetting: { flagInclude: 0, flagExclude: 1540 },
      trackMaxHeight: 900,
      hideMismatchesSetting: true,
    }),
  ).toEqual({
    encoding: { color: { field: 'insertSizeAndOrientation' } },
    // the default masks, so nothing to write
    filter: [],
    pileup: { maxLayoutHeight: 900, mismatches: { show: false } },
  })
})

// v4's read cloud toggled these off from its menu; on, they asked for nothing
test("the read cloud's hidden singletons and proper pairs lift", () => {
  expect(
    retiredState.lift({ drawSingletons: false, drawProperPairs: false }),
  ).toEqual({
    filter: [{ field: 'alone', equal: false }],
    readConnections: { ordinaryPairs: { show: false } },
  })
  expect(
    retiredState.lift({ drawSingletons: true, drawProperPairs: true }),
  ).toEqual({})
})

// a v4 filterBy was the whole filter, so the display's own replaces the
// sub-node's rather than inheriting its tag filter
test("an instance's v4 filter replaces its sub-node's whole", () => {
  const { filter } = retiredState.lift({
    PileupDisplay: {
      filterBySetting: {
        flagInclude: 0,
        flagExclude: 1540,
        tagFilter: { tag: 'HP', value: '1' },
      },
    },
    filterBySetting: { flagInclude: 0, flagExclude: 1028 },
  }) as { filter: FieldPredicate[] }
  // 1028 keeps QC-failed reads, which the default 1540 drops
  expect(filter).toEqual([{ field: 'flags.QCFAIL' }])
  expect(
    retiredState.lift({
      filterBySetting: { tagFilter: { tag: 'HP', value: '1' } },
    }).filter,
  ).toEqual([{ field: 'tags.HP', equal: '1' }])
})

// v4's filterBy held the read members alone, so its lift leaves a v4
// LinearReadArcsDisplay's draw verbs to their own lift
test('a v4 filter lift names no junction or connection field', () => {
  const { filter } = retiredState.lift({
    filterBySetting: { flagInclude: 0, flagExclude: 1028 },
  }) as { filter: FieldPredicate[] }
  expect(
    filter.some(p => /^(junction|connection|breakpoint)\./.test(p.field)),
  ).toBe(false)
})

test('a v4 sort carries into sort by its v5 name, counted from 0', () => {
  expect(
    retiredState.lift({
      sortedBy: {
        type: 'Base pair',
        pos: 101,
        refName: 'ctgA',
        assemblyName: 'volvox',
      },
    }),
  ).toEqual({
    sort: { field: 'base', pos: 100, refName: 'ctgA' },
  })
  expect(
    retiredState.lift({
      sortedBy: { type: 'tag', pos: 5, refName: 'ctgA', tag: 'HP' },
    }),
  ).toEqual({ sort: { field: 'tags.HP', pos: 4, refName: 'ctgA' } })
  expect(
    retiredState.lift({
      sortedBy: { type: 'tag', pos: 5, refName: 'ctgA', tag: '' },
    }),
  ).toEqual({})
  expect(
    retiredState.lift({
      sortedBy: { type: 'Start location', pos: 5, refName: 'ctgA' },
    }),
  ).toEqual({})
})

test("a v4.3.0 display's showLegend state lifts to legend.show", () => {
  expect(retiredState.lift({ showLegend: true })).toEqual({
    legend: { show: true },
  })
  expect(retiredState.lift({ PileupDisplay: { showLegend: false } })).toEqual({
    legend: { show: false },
  })
})

test('a v4 arc lineWidth strokes every connection at it', () => {
  expect(
    alignmentsEntries([{ type: 'LinearReadArcsDisplay', lineWidth: 3 }]),
  ).toMatchObject([
    { readConnections: { encoding: { strokeWidth: { value: 3 } } } },
  ])
})

test('an instance with only live props lifts nothing', () => {
  expect(retiredState.lift({ type: 'LinearAlignmentsDisplay' })).toEqual({})
})

test('a v5 coverage scale beats the v4 key it overlaps', () => {
  expect(
    alignmentsEntries([
      {
        type: 'LinearAlignmentsDisplay',
        scaleType: 'log',
        scales: { y: { type: 'linear' } },
      },
    ]),
  ).toMatchObject([
    { coverage: { encoding: { y: { scale: { type: 'linear' } } } } },
  ])
})

// v4.3.0's SNP coverage display was a wiggle display, axis state and all
test.each([
  [
    'the nested sub-node',
    {
      type: 'LinearAlignmentsDisplay',
      PileupDisplay: { type: 'LinearPileupDisplay' },
      SNPCoverageDisplay: {
        type: 'LinearSNPCoverageDisplay',
        scale: 'log',
        constraints: { max: 100 },
        displayCrossHatches: true,
      },
    },
  ],
  [
    'a standalone display',
    {
      type: 'LinearSNPCoverageDisplay',
      scale: 'log',
      constraints: { max: 100 },
      displayCrossHatches: true,
    },
  ],
])('a v4.3.0 coverage axis on %s loads as a log axis to 100', (_, v4) => {
  const pluginManager = new PluginManager([new AlignmentsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const conf = pluginManager
    .getDisplayType('LinearAlignmentsDisplay')
    .configSchema.create({
      type: 'LinearAlignmentsDisplay',
      displayId: 'd',
      ...retiredState.lift(v4),
    })
  const y = ['coverage', 'encoding', 'y']
  expect(readConfObject(conf, [...y, 'scale', 'type'])).toBe('log')
  expect(readConfObject(conf, [...y, 'scale', 'domainMax'])).toBe(100)
  expect(readConfObject(conf, [...y, 'axis', 'grid'])).toBe(true)
  expect(retiredState.keys).toEqual(
    expect.arrayContaining(['scale', 'constraints', 'displayCrossHatches']),
  )
})
