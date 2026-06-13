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
  test('toggleSashimiArcs turns on coverage and flips visibility', () => {
    const display = createDisplay()
    display.setShowSashimiArcs(false)
    display.setShowCoverage(false)

    display.toggleSashimiArcs()
    expect(display.showSashimiArcs).toBe(true)
    expect(display.showCoverage).toBe(true)

    display.toggleSashimiArcs()
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
