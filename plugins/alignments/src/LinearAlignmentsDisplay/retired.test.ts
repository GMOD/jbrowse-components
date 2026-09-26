import PluginManager from '@jbrowse/core/PluginManager'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import AlignmentsPlugin from '../index.ts'
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
  ['LinearPileupDisplay', { showCoverage: false }],
  [
    'LinearSNPCoverageDisplay',
    { showPileup: false, coverageHeight: 100, height: 100 },
  ],
  [
    'LinearReadArcsDisplay',
    { showPileup: false, showCoverage: false, readConnections: 'arc' },
  ],
  [
    'LinearReadCloudDisplay',
    { showPileup: false, showCoverage: false, readConnections: 'cloud' },
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

test('an explicit author value wins over the band a retired type implies', () => {
  const [entry] = alignmentsEntries([
    { type: 'LinearSNPCoverageDisplay', showPileup: true, height: 400 },
  ])
  expect(entry).toMatchObject({ showPileup: true, height: 400 })
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
      modifications: { fillUnmarked: true },
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
    filterBy: { flagInclude: 0, flagExclude: 1536 },
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
    filterBy: { flagInclude: 0, flagExclude: 1540 },
    maxHeight: 900,
    showMismatches: false,
  })
})

test('an instance with only live props lifts nothing', () => {
  expect(retiredState.lift({ type: 'LinearAlignmentsDisplay' })).toEqual({})
})
