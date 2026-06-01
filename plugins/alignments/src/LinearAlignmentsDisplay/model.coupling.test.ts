import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { stateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/model'

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
    { type: 'AlignmentsTrack', trackId: 'test_track', assemblyNames: ['volvox'] },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
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
  test('toggleSashimiArcs turns on coverage and follows direction', () => {
    const display = createDisplay()
    display.setSashimiArcs('off')
    display.setShowCoverage(false)

    display.toggleSashimiArcs()
    expect(display.sashimiArcs).toBe('up')
    expect(display.showCoverage).toBe(true)

    display.toggleSashimiArcs()
    expect(display.sashimiArcs).toBe('off')
  })

  test('toggleSashimiArcs respects readConnectionsDown for direction', () => {
    const display = createDisplay()
    display.setSashimiArcs('off')
    display.setReadConnectionsDown(true)
    display.toggleSashimiArcs()
    expect(display.sashimiArcs).toBe('down')
  })

  test('setReadConnectionsDown keeps sashimi direction in sync when on', () => {
    const display = createDisplay()
    display.setSashimiArcs('up')

    display.setReadConnectionsDown(true)
    expect(display.sashimiArcs).toBe('down')

    display.setReadConnectionsDown(false)
    expect(display.sashimiArcs).toBe('up')
  })

  test('setReadConnectionsDown leaves sashimi off when it was off', () => {
    const display = createDisplay()
    display.setSashimiArcs('off')
    display.setReadConnectionsDown(true)
    expect(display.sashimiArcs).toBe('off')
  })
})
