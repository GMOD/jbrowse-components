import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { SimpleFeature } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Builds a real LinearAlignmentsDisplay so the cross-feature coupling that
// lives in the model actions (not the menu handlers) is tested against the
// actual model rather than a mock that would just reimplement it.
function createDisplay() {
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

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearAlignmentsDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'AlignmentsTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

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

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      // satisfies isSessionModel so getSession(view) resolves; the LGV
      // localStorage autorun calls getSession via the trackLabels getter
      rpcManager: {},
    }))
    .views(() => ({
      getTracksById() {
        return { test_track: trackConfig }
      },
      get tracksById() {
        return this.getTracksById()
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
  return view.tracks[0]!.displays[0]!
}

describe('alignments display cross-feature coupling', () => {
  // Sashimi only draws over the coverage band, so enabling it must enable
  // coverage or the toggle silently does nothing.
  test('setShowSashimiArcs turns on coverage when enabled', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(false)
    display.setShowCoverage(false)

    display.setShowSashimiArcs(true)
    expect(display.showSashimiArcs).toBe(true)
    expect(display.showCoverage).toBe(true)

    display.setShowSashimiArcs(false)
    expect(display.showSashimiArcs).toBe(false)
  })

  // Direction is a single shared field (readConnectionsDown); sashimi stores
  // no direction of its own, so there is nothing to keep in sync and
  // setReadConnectionsDown can't disturb sashimi visibility.
  test('setReadConnectionsDown does not affect sashimi visibility', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(true)

    display.setReadConnectionsDown(true)
    expect(display.showSashimiArcs).toBe(true)
    expect(display.readConnectionsDown).toBe(true)

    display.setShowSashimiArcs(false)
    display.setReadConnectionsDown(false)
    expect(display.showSashimiArcs).toBe(false)
    expect(display.readConnectionsDown).toBe(false)
  })
})

// Toggling "view as pairs" auto-switches coloring for the common case but must
// not stomp on a color scheme the user picked deliberately (regression guard —
// the auto-switch previously overwrote colorBy unconditionally).
describe('setLinkedReads color scheme preservation', () => {
  test('entering pairs nudges the plain default to insert-size-and-orientation', () => {
    const display = createDisplay()
    expect(display.colorBy.type).toBe('normal')

    display.setLinkedReads('normal')
    expect(display.linkedReads).toBe('normal')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')
  })

  test('entering pairs preserves an explicit non-pairing color scheme', () => {
    const display = createDisplay()
    display.setColorScheme({ type: 'tag', tag: 'HP' })

    display.setLinkedReads('normal')
    expect(display.colorBy.type).toBe('tag')
    expect(display.colorBy.tag).toBe('HP')
  })

  test('leaving pairs reverts a pairing-specific scheme to normal', () => {
    const display = createDisplay()
    display.setLinkedReads('normal')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')

    display.setLinkedReads('off')
    expect(display.linkedReads).toBe('off')
    expect(display.colorBy.type).toBe('normal')
  })

  test('leaving pairs preserves an explicit non-pairing color scheme', () => {
    const display = createDisplay()
    display.setLinkedReads('normal')
    display.setColorScheme({ type: 'tag', tag: 'HP' })

    display.setLinkedReads('off')
    expect(display.linkedReads).toBe('off')
    expect(display.colorBy.type).toBe('tag')
    expect(display.colorBy.tag).toBe('HP')
  })
})

// openContextMenu sets coord + block + hit kinds as one unit and resets the
// read feature. These invariants are what let the menu builder read a block
// without its hit going missing, and stop a repositioned menu from showing the
// previous read — behavior otherwise guarded only by a comment.
describe('openContextMenu atomic state and stale-read reset', () => {
  test('sets coord and hit fields together', () => {
    const display = createDisplay()
    display.openContextMenu({
      coord: [10, 20],
      cigarHit: { type: 'mismatch', index: 0, position: 42 },
    })
    expect(display.contextMenuCoord).toEqual([10, 20])
    expect(display.contextMenuCigarHit).toEqual({
      type: 'mismatch',
      index: 0,
      position: 42,
    })
  })

  // A consecutive right-click repositions the still-open menu without a clear,
  // so opening over a new hit must drop the previous read's feature items.
  test('reopening over a new hit resets the previous read feature', () => {
    const display = createDisplay()
    display.setContextMenuFeature(
      new SimpleFeature({ uniqueId: 'read1', refName: 'ctgA', start: 0, end: 100 }),
    )
    expect(display.contextMenuFeature).toBeDefined()

    display.openContextMenu({
      coord: [1, 2],
      indicatorHit: {
        type: 'indicator',
        position: 5,
        indicatorType: 'insertion',
      },
    })
    expect(display.contextMenuFeature).toBeUndefined()
    expect(display.contextMenuIndicatorHit).toEqual({
      type: 'indicator',
      position: 5,
      indicatorType: 'insertion',
    })
  })

  test('clearContextMenu wipes all context-menu state', () => {
    const display = createDisplay()
    display.openContextMenu({
      coord: [3, 4],
      cigarHit: { type: 'mismatch', index: 1, position: 9 },
    })
    display.clearContextMenu()
    expect(display.contextMenuCoord).toBeUndefined()
    expect(display.contextMenuCigarHit).toBeUndefined()
    expect(display.contextMenuIndicatorHit).toBeUndefined()
    expect(display.contextMenuFeature).toBeUndefined()
    expect(display.contextMenuBlock).toBeUndefined()
  })
})
