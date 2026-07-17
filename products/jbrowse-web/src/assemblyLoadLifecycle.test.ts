import PluginManager from '@jbrowse/core/PluginManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import { types } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'

// Pins the Assembly.load() contract: failure is reported by rejecting, not by
// resolving and leaving the caller to inspect self.error. self.error mirrors it
// for reactive consumers (the UI renders it) but is racy to read after an await
// — a concurrent retry clears it — so the rejection is the real signal.
function setup() {
  const pluginManager = new PluginManager(corePlugins.map(P => new P()))
    .createPluggableElements()
    .configure()
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)

  const Root = types.model('Root', {
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

  // 'broken' has no usable sequence adapter, so loadPre throws
  return Root.create({
    jbrowse: { assemblies: [{ name: 'broken' }] },
    session: {},
    assemblyManager: {},
  })
}

beforeEach(() => {
  // load() logs the failure it rethrows
  console.error = jest.fn()
})

test('load() rejects when the assembly cannot load', async () => {
  const assembly = setup().assemblyManager.get('broken')!
  await expect(assembly.load()).rejects.toThrow()
})

test('load() mirrors the failure onto error for reactive consumers', async () => {
  const assembly = setup().assemblyManager.get('broken')!
  await expect(assembly.load()).rejects.toThrow()
  expect(assembly.error).toBeDefined()
  expect(assembly.initialized).toBe(false)
})

// concurrent callers share the one in-flight attempt, and each is told it failed
test('concurrent load() callers share an attempt and all reject', async () => {
  const assembly = setup().assemblyManager.get('broken')!
  const [a, b] = [assembly.load(), assembly.load()]
  await expect(a).rejects.toThrow()
  await expect(b).rejects.toThrow()
})

// the failed attempt is discarded, so a later call retries rather than
// resolving off the stale memoized promise
test('load() retries after a failure instead of resolving', async () => {
  const assembly = setup().assemblyManager.get('broken')!
  await expect(assembly.load()).rejects.toThrow()
  await expect(assembly.load()).rejects.toThrow()
})

test('waitForAssembly propagates the load failure', async () => {
  const { assemblyManager } = setup()
  await expect(assemblyManager.waitForAssembly('broken')).rejects.toThrow()
})
