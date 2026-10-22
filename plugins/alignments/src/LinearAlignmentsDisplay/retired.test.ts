import PluginManager from '@jbrowse/core/PluginManager'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import AlignmentsPlugin from '../index.ts'
import { filterListOf } from '../shared/alignmentsFilter.ts'
import { colorSlotsOf, retiredState } from './retired.ts'

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
      pileup: { show: true, readHeight: 3 },
      height: 400,
    },
  ])
  expect(entry).toMatchObject({
    pileup: { show: true, readHeight: 3 },
    coverage: { height: 100 },
    height: 400,
  })
})

test.each([
  [{ type: 'strand' }, { color: { field: 'strand' } }],
  [{ type: 'mappingQuality' }, { color: { field: 'mapq' } }],
  [{ type: 'tag', tag: 'HP' }, { color: { field: 'tags.HP' } }],
  [{ type: 'perBaseLettering' }, { baseColor: { field: 'base' } }],
  [
    { type: 'methylation' },
    {
      baseColor: { field: 'modifications' },
      modifications: { unmodified: 'all' },
    },
  ],
  [
    {
      type: 'modifications',
      modifications: { isolatedModification: 'm', threshold: 10 },
    },
    {
      baseColor: { field: 'modifications' },
      modifications: { shownModifications: ['m'], threshold: 10 },
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
  ).toMatchObject({ color: { field: 'pairOrientation' } })
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
    baseColor: { field: 'modifications' },
    filter: expect.objectContaining({ flagInclude: 0, flagExclude: 1536 }),
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
    color: { field: 'insertSizeAndOrientation' },
    filter: expect.objectContaining({ flagInclude: 0, flagExclude: 1540 }),
    pileup: { maxLayoutHeight: 900, mismatches: { show: false } },
  })
})

// v4's read cloud toggled these off from its menu; on, they asked for nothing
test("the read cloud's hidden singletons and proper pairs lift", () => {
  expect(
    retiredState.lift({ drawSingletons: false, drawProperPairs: false }),
  ).toEqual({
    filter: { alone: 'exclude' },
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
  }) as { filter: Record<string, unknown> }
  expect(filter).toMatchObject({ flagExclude: 1028, tags: null })
  expect(filterListOf(filter)).not.toContainEqual(
    expect.objectContaining({ field: 'tags.HP' }),
  )
  expect(
    filterListOf(
      retiredState.lift({
        filterBySetting: { tagFilter: { tag: 'HP', value: '1' } },
      }).filter,
    ),
  ).toContainEqual({ field: 'tags.HP', equal: '1' })
})

// v4's filterBy held the read members alone, so its lift leaves a v4
// LinearReadArcsDisplay's `drawInter` lift in `filter.connections` standing
test('a v4 filter lift leaves the junction and connection filters', () => {
  const { filter } = retiredState.lift({
    filterBySetting: { flagInclude: 0, flagExclude: 1028 },
  }) as { filter: Record<string, unknown> }
  expect(filter).not.toHaveProperty('junctions')
  expect(filter).not.toHaveProperty('connections')
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

test('an instance with only live props lifts nothing', () => {
  expect(retiredState.lift({ type: 'LinearAlignmentsDisplay' })).toEqual({})
})
