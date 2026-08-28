import PluginManager from '@jbrowse/core/PluginManager'
import { assemblyConfigSchemaFactory } from '@jbrowse/core/assemblyManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  AdapterType,
  TrackType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { BaseRootModelFactory } from './RootModel/BaseRootModel.ts'
import { BaseSessionModel } from './Session/BaseSession.ts'

import type { BaseRootModelType } from './RootModel/BaseRootModel.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

// The whole chain, because the failure this pins is invisible to any one link
// of it. `pruneUnbuildableNodes` holds a node under `heldForMissingPlugins` and
// its own unit tests pass; MST then **silently drops an undeclared snapshot
// key**, so without the property on BaseSessionModel the held node vanishes the
// moment `setSession` builds the tree and the round trip is dead with no error
// anywhere. Only a test that goes snapshot → session → snapshot sees it.
//
// The session model composes BaseSessionModel rather than declaring props
// inline (which is what BaseRootModel.test.ts does) precisely because the
// property under test lives there and every product reaches it by composition.

function makeRootType(viewTypes: string[]) {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'RefNameAliasAdapter',
        configSchema: ConfigurationSchema(
          'RefNameAliasAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => {
          throw new Error('no adapter is instantiated in this test')
        },
      }),
  )
  pluginManager.addTrackType(
    () =>
      new TrackType({
        name: 'ReferenceSequenceTrack',
        configSchema: ConfigurationSchema(
          'ReferenceSequenceTrack',
          {},
          { explicitlyTyped: true },
        ),
        stateModel: types.model('ReferenceSequenceTrack', {}),
      }),
  )
  for (const name of viewTypes) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name,
          stateModel: types.model(name, {
            id: types.identifier,
            type: types.literal(name),
          }),
          ReactComponent: () => null,
        }),
    )
  }
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  return BaseRootModelFactory({
    pluginManager,
    jbrowseModelType: types.model('TestConfig', {
      configuration: ConfigurationSchema('Root', {
        rpc: RpcManager.configSchema,
      }),
      assemblies: types.array(assemblyConfigSchema),
    }),
    sessionModelType: types
      .compose(
        'TestSession',
        BaseSessionModel<BaseRootModelType, AnyConfigurationSchemaType>(
          pluginManager,
        ),
        types.model({
          views: types.array(
            pluginManager.pluggableMstType('view', 'stateModel'),
          ),
        }),
      )
      .volatile(() => ({
        notifications: [] as string[],
      }))
      .actions(self => ({
        notify(message: string) {
          self.notifications.push(message)
        },
      })),
    assemblyConfigSchema,
  })
}

function makeRoot(viewTypes: string[]) {
  return makeRootType(viewTypes).create({
    jbrowse: { configuration: {}, assemblies: [] },
    session: { name: 'empty', views: [] },
  })
}

const shared = {
  name: 'from a colleague',
  views: [
    { id: 'v1', type: 'LinearGenomeView' },
    { id: 'v2', type: 'LinearMafView' },
  ],
}

test('a session opened without the plugin keeps the node in its own snapshot', () => {
  const root = makeRoot(['LinearGenomeView'])
  root.setSession(shared)

  expect(root.session.views.map((v: { id: string }) => v.id)).toEqual(['v1'])
  expect(root.session.notifications).toEqual([
    'Removed session items that need plugins this JBrowse does not have: LinearMafView',
  ])

  // the half MST would have thrown away: what the autosave writes back, and
  // what a reshare carries
  const snap = getSnapshot(root.session) as Record<string, unknown>
  expect(snap.heldForMissingPlugins).toEqual([
    {
      group: 'view',
      parent: undefined,
      index: 1,
      snapshot: { id: 'v2', type: 'LinearMafView' },
    },
  ])
})

test('the build that has the plugin gets the view back, in its own place', () => {
  const without = makeRoot(['LinearGenomeView'])
  without.setSession(shared)
  const reshared = getSnapshot(without.session) as Record<string, unknown>

  const withPlugin = makeRoot(['LinearGenomeView', 'LinearMafView'])
  withPlugin.setSession(reshared)

  expect(withPlugin.session.views.map((v: { id: string }) => v.id)).toEqual([
    'v1',
    'v2',
  ])
  expect(withPlugin.session.notifications).toEqual([])
  const snap = getSnapshot(withPlugin.session) as Record<string, unknown>
  expect(snap.heldForMissingPlugins).toBeUndefined()
})

// The reason the property is worth its line: without it this is what happens,
// and nothing anywhere reports it.
test('an undeclared key would not have survived — MST drops one silently', () => {
  const M = types.model('M', { id: types.string })
  expect(
    getSnapshot(M.create({ id: 'a', heldForMissingPlugins: [{}] } as never)),
  ).toEqual({ id: 'a' })
})
