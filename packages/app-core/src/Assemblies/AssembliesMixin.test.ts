import PluginManager from '@jbrowse/core/PluginManager'
import { types } from '@jbrowse/mobx-state-tree'

import { AssembliesMixin } from './AssembliesMixin.ts'

import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

// the mixin reads an assembly's name and nothing else
const assemblySchema = types.model('Assembly', {
  name: types.identifier,
}) as unknown as BaseAssemblyConfigSchema

function makeSession(adminMode: boolean) {
  const pluginManager = new PluginManager()
  const removeAssemblyConf = jest.fn()
  const jbrowse = { assemblies: [], removeAssemblyConf }
  const session = types
    .compose(
      types.model({}).views(() => ({
        get adminMode() {
          return adminMode
        },
        get jbrowse() {
          return jbrowse
        },
      })),
      AssembliesMixin(pluginManager, assemblySchema),
    )
    .create()
  session.addSessionAssembly({ name: 'fromSpec' })
  return { session, removeAssemblyConf }
}

test.each([true, false])(
  'a session assembly is deleted from the session (adminMode %s)',
  adminMode => {
    const { session, removeAssemblyConf } = makeSession(adminMode)
    session.removeAssembly('fromSpec')
    expect(session.sessionAssemblies).toHaveLength(0)
    expect(removeAssemblyConf).not.toHaveBeenCalled()
  },
)

test('an admin deleting a config assembly edits the config', () => {
  const { session, removeAssemblyConf } = makeSession(true)
  session.removeAssembly('volvox')
  expect(removeAssemblyConf).toHaveBeenCalledWith('volvox')
})

test('a non-admin cannot delete a config assembly', () => {
  const { session, removeAssemblyConf } = makeSession(false)
  session.removeAssembly('volvox')
  expect(removeAssemblyConf).not.toHaveBeenCalled()
})
