import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  displayTestSessionModel,
  testAssembly,
} from '@jbrowse/display-test-utils'
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
 *
 * `neighbourAssembly` puts that LGV in a two-panel STACK, with the second panel
 * open on the named assembly — the shape "Move other panel to the matching
 * region" exists for, and the one the standalone default cannot reach.
 *
 * `trackAssemblyNames` is what the track declares (two names by default, so a
 * three-name all-vs-all track is opt-in), `loadedAssemblies` what the session
 * can open a view on, and `getCanonicalAssemblyName` is the alias table, which
 * knows nothing by default so every comparison degrades to the raw name.
 */
export function createSyntenyEnv({
  neighbourAssembly,
  trackAssemblyNames = ['volvox', 'volvox_random'],
  loadedAssemblies = ['volvox', 'volvox_random'],
  getCanonicalAssemblyName = () => undefined,
  extend,
}: {
  neighbourAssembly?: string
  trackAssemblyNames?: string[]
  loadedAssemblies?: string[]
  getCanonicalAssemblyName?: (name: string) => string | undefined
  // Menu-item installers from other plugins, run before the elements are
  // created so their `Core-extendPluggableElement` hooks reach this display.
  extend?: (pluginManager: PluginManager) => void
} = {}) {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()
  extend?.(pluginManager)
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
      assemblyNames: trackAssemblyNames,
    },
    { pluginManager },
  )

  // width/setWidth are what isViewModel keys on, and the whole point of the
  // stack being a VIEW rather than any node with a `views` array
  const Stack = types
    .model('TestPanelStack', {
      id: types.optional(types.identifier, 'stack1'),
      type: types.literal('TestPanelStack'),
      views: types.array(LinearGenomeModel),
    })
    .volatile(() => ({ width: 800 }))
    .actions(self => ({
      setWidth(n: number) {
        self.width = n
      },
    }))

  const Session = types
    .compose(
      'SyntenyTestSession',
      displayTestSessionModel({
        viewModel: LinearGenomeModel,
        // Never settles, the same default `createDisplayTestEnvironment` uses:
        // setting a displayed region wakes the display's fetch, and an
        // rpcManager without a `call` fails it into a logged TypeError.
        rpcManager: { call: () => new Promise(() => {}) },
        // Answers for any name: the two panels sit on different assemblies, and
        // the readiness reactions a displayed region wakes only need something
        // to ask.
        assemblyManager: {
          // `hasName` is what the fetch autorun asks when a track's declared
          // name is not the region's spelling, which is the alias case above
          get: () => ({
            ...testAssembly(),
            hasName: (name: string) =>
              (getCanonicalAssemblyName(name) ?? name) === 'volvox',
          }),
          getCanonicalAssemblyName,
          has: (name: string) => loadedAssemblies.includes(name),
        },
        getTrackById: (id: string) =>
          id === 'test_track' ? trackConfig : undefined,
      }),
      types.model({ stack: types.maybe(Stack) }),
    )
    .actions(self => ({
      setStack(stack: Instance<typeof Stack>) {
        self.stack = stack
        return stack
      },
    }))

  const trackSnapshot = {
    type: 'SyntenyTrack',
    configuration: 'test_track',
    displays: [{ type: 'LGVSyntenyDisplay' }],
  }
  const session = Session.create({ configuration: {} }, { pluginManager })
  const panels =
    neighbourAssembly === undefined
      ? [
          session.setView(
            LinearGenomeModel.create({
              type: 'LinearGenomeView',
              tracks: [trackSnapshot],
            }),
          ),
        ]
      : [
          ...session.setStack(
            Stack.create({
              type: 'TestPanelStack',
              views: [
                { type: 'LinearGenomeView', tracks: [trackSnapshot] },
                { type: 'LinearGenomeView' },
              ],
            }),
          ).views,
        ]
  // The launch item anchors its first panel on the view's own assembly, and the
  // move item names the neighbour by its own, so both panels need a region.
  const assemblies = ['volvox', neighbourAssembly]
  for (const [i, panel] of panels.entries()) {
    panel.setWidth(800)
    panel.setDisplayedRegions([
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: assemblies[i]! },
    ])
  }
  return { session, display: panels[0]!.tracks[0]!.displays[0]! }
}

/**
 * The display alone, which is all most callers here want. `createSyntenyEnv`
 * is the form for a test that also has to reach the session — the promotable
 * pins raise a snackbar whose one action is the promotion, and that is only
 * assertable through `session.notifications`.
 */
export function createDisplay(
  opts: Parameters<typeof createSyntenyEnv>[0] = {},
) {
  return createSyntenyEnv(opts).display
}

/**
 * A session holding one multi-panel view (two bare LGVs as its `views`) and one
 * standalone LGV — the two shapes `containingPanelStack` has to tell apart.
 *
 * The session's own `views` array is the trap the walk exists to avoid, so it
 * is here rather than stubbed away: a walk that only checked membership would
 * report the session as the standalone view's stack, and offer to move whatever
 * unrelated views the user has open.
 */
export function createPanelStack({
  levelTracks = [],
}: {
  // the band tracks between the two panels, as the bare `configuration`
  // objects a launch reads off them
  levelTracks?: { configuration: unknown }[]
} = {}) {
  const pluginManager = new PluginManager()
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  // width/setWidth are what isViewModel keys on, and the whole point of the
  // stack being a VIEW rather than any node with a `views` array
  const Stack = types
    .model('TestPanelStack', {
      id: types.optional(types.identifier, 'stack1'),
      type: types.literal('TestPanelStack'),
      views: types.array(LinearGenomeModel),
      levels: types.array(
        types.model({ tracks: types.array(types.frozen<unknown>()) }),
      ),
    })
    .volatile(() => ({ width: 800 }))
    .actions(self => ({
      setWidth(n: number) {
        self.width = n
      },
    }))
  const Session = types
    .model({
      name: 'testSession',
      views: types.array(types.union(Stack, LinearGenomeModel)),
    })
    .volatile(() => ({
      rpcManager: {},
      theme: createJBrowseTheme(),
      assemblyManager: {
        get: () => undefined,
        getCanonicalAssemblyName: () => undefined,
      },
    }))

  const session = Session.create(
    {
      views: [
        {
          type: 'TestPanelStack',
          views: [{ type: 'LinearGenomeView' }, { type: 'LinearGenomeView' }],
          levels: [{ tracks: levelTracks }],
        },
        { type: 'LinearGenomeView' },
      ],
    },
    { pluginManager },
  )
  const stack = session.views[0] as Instance<typeof Stack>
  const standalone = session.views[1] as Instance<typeof LinearGenomeModel>
  return { session, stack, panels: [...stack.views], standalone }
}
