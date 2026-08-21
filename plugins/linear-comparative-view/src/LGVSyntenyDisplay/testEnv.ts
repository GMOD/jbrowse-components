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
 */
export function createDisplay({
  neighbourAssembly,
}: { neighbourAssembly?: string } = {}) {
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
        // Answers for any name: the two panels sit on different assemblies, and
        // the readiness reactions a displayed region wakes only need something
        // to ask.
        assemblyManager: {
          get: () => testAssembly(),
          // knows no aliases, so every assembly comparison degrades to the raw
          // name — which is what these fixtures spell on both sides
          getCanonicalAssemblyName: () => undefined,
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
  return panels[0]!.tracks[0]!.displays[0]!
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
export function createPanelStack() {
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
