import PluginManager from '@jbrowse/core/PluginManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import { types } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'

// Regression test for the afterAttach cleanup autorun: when several adjacent
// assemblies lose their (safeReference) configuration in the same tick, the
// loop must remove all of them. Iterating the live array while splicing skips
// the element after each removal, so it iterates a copy.
function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)

  const Root = types
    .model('Root', {
      jbrowse: types.model('JBrowse', {
        assemblies: types.array(assemblyConfigSchema),
      }),
      session: types.model('Session', {
        sessionAssemblies: types.array(assemblyConfigSchema),
        temporaryAssemblies: types.array(assemblyConfigSchema),
      }),
      assemblyManager: assemblyManagerFactory(
        assemblyConfigSchema,
        pluginManager,
      ),
    })
    .actions(self => ({
      removeAssemblies(names: string[]) {
        self.jbrowse.assemblies.replace(
          self.jbrowse.assemblies.filter(a => !names.includes(a.name)),
        )
      },
    }))

  return Root.create({
    jbrowse: {
      assemblies: ['a1', 'a2', 'a3', 'a4'].map(name => ({ name })),
    },
    session: {},
    assemblyManager: {},
  })
}

test('cleanup autorun removes adjacent dangling assemblies without skipping', () => {
  const root = setup()
  expect(root.assemblyManager.assemblyNamesList).toEqual([
    'a1',
    'a2',
    'a3',
    'a4',
  ])

  // remove two adjacent configs in one transaction: their safeReferences both
  // go null, so the cleanup loop must drop both assembly instances
  root.removeAssemblies(['a2', 'a3'])

  expect(root.assemblyManager.assemblies.map(a => a.name)).toEqual(['a1', 'a4'])
  expect(root.assemblyManager.assemblies.every(a => !!a.configuration)).toBe(
    true,
  )
})
