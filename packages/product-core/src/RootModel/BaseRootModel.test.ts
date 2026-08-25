import PluginManager from '@jbrowse/core/PluginManager'
import { assemblyConfigSchemaFactory } from '@jbrowse/core/assemblyManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  AdapterType,
  TrackType,
  ViewType,
} from '@jbrowse/core/pluggableElementTypes'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { isAlive, types } from '@jbrowse/mobx-state-tree'

import { BaseRootModelFactory } from './BaseRootModel.ts'

// A build with exactly one registered view type, so a snapshot naming it gets
// past pruneUnbuildableNodes and is refused by MST instead — the malformed
// snapshot of a type this build *does* have.
function makeRootType() {
  const pluginManager = new PluginManager()
  // named by assemblyConfigSchema's own refNameAliases default, and unlike
  // CytobandAdapter it is not one of CorePlugin's
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
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'TestView',
        stateModel: types.model('TestView', {
          id: types.identifier,
          type: types.literal('TestView'),
          bpPerPx: types.number,
        }),
        ReactComponent: () => null,
      }),
  )
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
      .model('TestSession', {
        name: types.string,
        views: types.array(
          pluginManager.pluggableMstType('view', 'stateModel'),
        ),
      })
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

function makeRoot() {
  return makeRootType().create({
    jbrowse: { configuration: {}, assemblies: [] },
    session: { name: 'old session', views: [] },
  })
}

const goodView = { id: 'v1', type: 'TestView', bpPerPx: 1 }
// registered view type, numeric prop given a string: pruneUnbuildableNodes keeps
// it, MST refuses it
const badView = { id: 'v1', type: 'TestView', bpPerPx: 'not a number' }

test('swaps in a new session', () => {
  const root = makeRoot()
  const oldSession = root.session
  root.setSession({ name: 'new session', views: [goodView] })
  expect(root.session.name).toBe('new session')
  expect(root.session).not.toBe(oldSession)
})

// The old session is detached before the assignment (ADR-069), so an assignment
// that throws must put it back: otherwise the root is left with no session at
// all and the old tree stays detached-and-alive, autoruns running and
// `beforeDestroy` never fired.
test('keeps the old session when the new snapshot fails to build', () => {
  const root = makeRoot()
  const oldSession = root.session
  expect(() => {
    root.setSession({ name: 'new session', views: [badView] })
  }).toThrow(/not assignable to type/)
  expect(root.session).toBe(oldSession)
  expect(root.session.name).toBe('old session')
  expect(isAlive(oldSession)).toBe(true)
})

test('does not destroy the restored session after the reaction flush', async () => {
  const root = makeRoot()
  const oldSession = root.session
  expect(() => {
    root.setSession({ name: 'new session', views: [badView] })
  }).toThrow()
  await new Promise(resolve => {
    setTimeout(resolve, 0)
  })
  expect(isAlive(oldSession)).toBe(true)
  expect(root.session).toBe(oldSession)
})
