import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchemaF.ts'
import stateModelF from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * A real LGVSyntenyDisplay on a two-assembly SyntenyTrack, in a real LGV. Both
 * menus this display builds read the track config (for the mate-assembly check)
 * and the containing view, and every promotable-slot row walks the cascade
 * through the session — so a mock `self` would just reimplement the thing under
 * test.
 */
export function createDisplay() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()
  const configSchema = configSchemaF(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'SyntenyTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'SyntenyTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'SyntenyTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LGVSyntenyDisplay',
        configSchema,
        stateModel: stateModelF(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfig = pluginManager.pluggableConfigSchemaType('track').create(
    {
      type: 'SyntenyTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox', 'volvox_random'],
    },
    { pluginManager },
  )

  // Promoted display-type defaults, held here rather than stubbed to undefined:
  // a pin's filled state is `getDisplayTypeDefault` reading back what its
  // `toggle` wrote, so a read-only shim can only ever show an outline pin.
  const promoted = new Map<string, unknown>()

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: {},
      theme: createJBrowseTheme(),
      // giving the view a displayed region wakes the assembly-readiness
      // reactions, which want an assemblyManager to ask
      assemblyManager: {
        get: (name: string) =>
          name === 'volvox' ? { initialized: true } : undefined,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // every promotable-slot read walks the cascade through this
      getDisplayTypeDefault(displayType: string, slot: string) {
        return promoted.get(`${displayType}\0${slot}`)
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        promoted.set(`${displayType}\0${slot}`, value)
      },
      notify() {},
    }))

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'SyntenyTrack',
          configuration: 'test_track',
          displays: [{ type: 'LGVSyntenyDisplay' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  // The launch item anchors its first panel on the view's own assembly, so the
  // view needs a region to name one.
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  ])
  return view.tracks[0]!.displays[0]!
}
