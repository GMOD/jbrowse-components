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

// Builds a real LinearAlignmentsDisplay so the floor is exercised through the
// actual setters the resize handles call, rather than a reimplementation.
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

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
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

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: {},
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
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

// The resize handles drag by calling `set*Height(current + dy)`, so the floor
// has to be expressed in terms of the current height, not a constant.
describe('resizable band height floor', () => {
  it('stops a drag from shrinking a default band below 20', () => {
    const display = createDisplay()
    expect(display.coverageHeight).toBe(45)
    display.setCoverageHeight(10)
    expect(display.coverageHeight).toBe(20)
  })

  it('leaves a band config declared below the floor where it is', () => {
    const display = createDisplay()
    display.configuration.setSlot('coverageHeight', 5)
    // the regression: this flooring at 20 made the first drag jump the band up
    // to 20 before it honored the +1
    display.setCoverageHeight(6)
    expect(display.coverageHeight).toBe(6)
  })

  it('still refuses to shrink a below-floor band further', () => {
    const display = createDisplay()
    display.configuration.setSlot('coverageHeight', 5)
    display.setCoverageHeight(3)
    expect(display.coverageHeight).toBe(5)
  })

  it('restores the 20 floor once a below-floor band is dragged past it', () => {
    const display = createDisplay()
    display.configuration.setSlot('coverageHeight', 5)
    display.setCoverageHeight(25)
    expect(display.coverageHeight).toBe(25)
    display.setCoverageHeight(10)
    expect(display.coverageHeight).toBe(20)
  })

  it('applies the same rule to the sashimi and read-connection bands', () => {
    const display = createDisplay()
    display.setSashimiArcsHeight(10)
    expect(display.sashimiArcsHeight).toBe(20)
    display.setReadConnectionsHeight(10)
    expect(display.readConnectionsHeight).toBe(20)

    display.configuration.setSlot('sashimiArcsHeight', 8)
    display.setSashimiArcsHeight(9)
    expect(display.sashimiArcsHeight).toBe(9)

    display.configuration.setSlot('readConnectionsHeight', 8)
    display.setReadConnectionsHeight(9)
    expect(display.readConnectionsHeight).toBe(9)
  })
})
