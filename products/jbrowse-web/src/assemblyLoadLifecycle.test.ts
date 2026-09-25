import PluginManager from '@jbrowse/core/PluginManager'
import assemblyManagerFactory, {
  assemblyConfigSchemaFactory,
} from '@jbrowse/core/assemblyManager'
import { applySnapshot, types } from '@jbrowse/mobx-state-tree'

import corePlugins from './corePlugins.ts'

// Pins the Assembly.load() contract: failure is reported by rejecting, not by
// resolving and leaving the caller to inspect self.error. self.error mirrors it
// for reactive consumers (the UI renders it) but is racy to read after an await
// — a concurrent retry clears it — so the rejection is the real signal.
function setup(
  assemblies: Record<string, unknown>[] = [],
  sessionAssemblies: Record<string, unknown>[] = [],
) {
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
    jbrowse: { assemblies: [{ name: 'broken' }, ...assemblies] },
    session: { sessionAssemblies },
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

test('an assembly with no sequence says so', async () => {
  const assembly = setup().assemblyManager.get('broken')!
  await expect(assembly.load()).rejects.toThrow(/give the assembly a "uri"/)
})

function featuresOn(refName: string) {
  return {
    type: 'FromConfigSequenceAdapter',
    features: [{ refName, uniqueId: refName, start: 0, end: 4, seq: 'acgt' }],
  }
}

// the assembly editor writes into the live config
test('editing the sequence adapter loads the assembly again', async () => {
  const root = setup([
    { name: 'editable', sequence: { adapter: featuresOn('ctgA') } },
  ])
  const assembly = (await root.assemblyManager.waitForAssembly('editable'))!
  expect(assembly.refNames).toEqual(['ctgA'])

  applySnapshot(
    root.jbrowse.assemblies[1]!.sequence.adapter,
    featuresOn('ctgB'),
  )
  await assembly.load()
  expect(assembly.refNames).toEqual(['ctgB'])
})

test('an alias never shadows another assembly by array order', () => {
  const sequence = { adapter: featuresOn('ctgA') }
  const root = setup(
    [{ name: 'GRCh38', sequence }],
    [{ name: 'hg38', aliases: ['GRCh38'], sequence }],
  )

  expect(root.assemblyManager.get('GRCh38')?.name).toBe('GRCh38')
  expect(root.assemblyManager.get('hg38')?.name).toBe('hg38')
})
