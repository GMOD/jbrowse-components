import { SAM_FLAG_PAIRED } from '@jbrowse/alignments-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'
import { makeEmptyPileupData } from './testUtils.ts'

import type { PileupDataResult } from '../RenderAlignmentDataRPC/types.ts'
import type { SectionsLayout } from './sectionLayout.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Boots a real LinearAlignmentsDisplay in a measured view, so the per-lane band
// decision is exercised through the actual `arcsByGroup` → `sections` chain
// rather than by calling `computeStackedSections` directly (sectionLayout.test.ts
// covers the pure function).
function createEnv() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'AlignmentsTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'AlignmentsTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'AlignmentsTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
    },
    { pluginManager },
  )

  // `arcsByGroup` normalizes SA/RNEXT refNames through the assembly, so the mock
  // has to answer `initialized` + `getCanonicalRefName2`.
  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getCanonicalRefName2: (refName: string) => refName,
  }
  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // every promotable slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
    }))

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'AlignmentsTrack',
          configuration: 'test_track',
          displays: [{ type: 'LinearAlignmentsDisplay' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return { view, display: view.tracks[0]!.displays[0]! }
}

// One read spanning 1000..1100. `mateBp` makes it a same-chromosome pair, which
// is what `computeArcsFromPileupData` turns into an arc; without it the lane has
// reads but no arc — the 'Not split' lane of a split-read grouping.
function oneRead(mateBp?: number): PileupDataResult {
  return {
    ...makeEmptyPileupData(),
    readIds: ['r0'],
    readNames: ['readA'],
    readPositions: new Uint32Array([1000, 1100]),
    readYs: new Uint16Array(1),
    readFlags: new Uint16Array([mateBp === undefined ? 0 : SAM_FLAG_PAIRED]),
    readMapqs: new Uint8Array(1),
    readStrands: new Int8Array([1]),
    readInsertSizes: new Float32Array([500]),
    readPairOrientations: new Uint8Array([1]),
    readNextRefs: mateBp === undefined ? undefined : ['ctgA'],
    readNextPositions:
      mateBp === undefined ? undefined : new Uint32Array([mateBp]),
  }
}

// Two lanes, only the second holding a pair, with down-mode arcs on so the band
// is a reserved strip rather than a coverage overlay.
function twoLanes() {
  const { view, display } = createEnv()
  display.setReadConnections('arc')
  display.setReadConnectionsDown(true)
  display.setRpcData(0, {
    groups: [
      { key: 'notsplit', label: 'Not split', data: oneRead() },
      { key: 'split', label: 'Split (SA)', data: oneRead(2000) },
    ],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return { view, display }
}

test('only the lane with arcs reserves the arc band', () => {
  const { display } = twoLanes()
  const layout: SectionsLayout = display.sections
  const sections = layout.sections
  expect(sections.map(s => [s.groupKey, s.hasArcsBand])).toEqual([
    ['notsplit', false],
    ['split', true],
  ])
  // The arc-less lane's pileup starts right at its coverage bottom; the lane
  // with arcs is pushed down by the whole band.
  const [notsplit, split] = sections
  expect(notsplit!.pileupTop - notsplit!.coverageTop).toBe(
    display.coverageHeight,
  )
  expect(split!.pileupTop - split!.coverageTop).toBe(
    display.coverageHeight + display.readConnectionsHeight,
  )
})

test('the reserved band tracks the arc feed, not just the setting', () => {
  const { display } = twoLanes()
  const withArcs = display.sections.contentHeight
  // Same reads, but now nothing pairs => neither lane has an arc to draw, so
  // both strips go away and the whole stack shortens by one band.
  display.setRpcData(0, {
    groups: [
      { key: 'notsplit', label: 'Not split', data: oneRead() },
      { key: 'split', label: 'Split (SA)', data: oneRead() },
    ],
  })
  const layout: SectionsLayout = display.sections
  expect(layout.sections.every(s => !s.hasArcsBand)).toBe(true)
  expect(display.sections.contentHeight).toBe(
    withArcs - display.readConnectionsHeight,
  )
})

test('turning read connections off drops the band from the lane that had one', () => {
  const { display } = twoLanes()
  const withArcs = display.sections.contentHeight
  display.setReadConnections('off')
  const layout: SectionsLayout = display.sections
  expect(layout.sections.every(s => !s.hasArcsBand)).toBe(true)
  expect(display.sections.contentHeight).toBe(
    withArcs - display.readConnectionsHeight,
  )
})
