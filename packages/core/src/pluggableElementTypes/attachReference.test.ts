import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import RpcMethodType from './RpcMethodType.ts'
import RpcMethodTypeWithRenameRegion from './RpcMethodTypeWithRenameRegion.ts'
import RpcMethodTypeWithRenameRegions from './RpcMethodTypeWithRenameRegions.ts'

import type { AbstractRootModel } from '../util/types/index.ts'

// An assembly config with the one path the derivation reads,
// `sequence.adapter`, and nothing else the real schema carries
const AssemblySchema = ConfigurationSchema('Asm', {
  sequence: ConfigurationSchema('Seq', {
    adapter: ConfigurationSchema('FakeSequenceAdapter', {
      label: { type: 'string', defaultValue: '' },
    }),
  }),
})

function assemblyConf(label: string) {
  return AssemblySchema.create({
    sequence: { adapter: { type: 'FakeSequenceAdapter', label } },
  })
}

const pluginManager = new PluginManager()
pluginManager.rootModel = {
  session: {
    assemblyManager: {
      assemblyNameMap: {},
      confByName: new Map([
        ['volvox', assemblyConf('volvox')],
        ['vvx', assemblyConf('volvox')],
        ['peach', assemblyConf('peach')],
      ]),
      // the real one resolves regions through a loaded assembly; here every
      // name is already the adapter's, so renaming is a no-op with a map
      requireAssembly: async () => ({
        getRefNameMapForAdapter: async () => ({}),
        getSeqAdapterRefName: (r: string) => r,
      }),
    },
  },
} as unknown as AbstractRootModel

class Plain extends RpcMethodType {
  name = 'Plain'
  async execute() {}
}
class Plural extends RpcMethodTypeWithRenameRegions {
  name = 'Plural'
  async execute() {}
}
class Singular extends RpcMethodTypeWithRenameRegion {
  name = 'Singular'
  async execute() {}
}

const adapterConfig = { type: 'SomeAdapter' }
const region = (assemblyName: string) => ({
  assemblyName,
  refName: 'ctgA',
  start: 0,
  end: 10,
})

async function reference(serialized: Promise<Record<string, unknown>>) {
  const { sequenceAdapter } = await serialized
  return (sequenceAdapter as { label?: string } | undefined)?.label
}

test("a call naming its genome carries that genome's sequence adapter", async () => {
  await expect(
    reference(
      new Plain(pluginManager).serializeArguments({
        sessionId: 's',
        adapterConfig,
        assemblyName: 'peach',
      }),
    ),
  ).resolves.toBe('peach')
})

test("a renaming call carries its regions' genome, and an alias spells the same one", async () => {
  await expect(
    reference(
      new Plural(pluginManager).serializeArguments({
        sessionId: 's',
        adapterConfig,
        regions: [region('vvx')],
      }),
    ),
  ).resolves.toBe('volvox')
  await expect(
    reference(
      new Singular(pluginManager).serializeArguments({
        sessionId: 's',
        adapterConfig,
        region: region('peach'),
      }),
    ),
  ).resolves.toBe('peach')
})

test('regions on two genomes name none', async () => {
  await expect(
    reference(
      new Plural(pluginManager).serializeArguments({
        sessionId: 's',
        adapterConfig,
        regions: [region('volvox'), region('peach')],
      }),
    ),
  ).resolves.toBeUndefined()
})

test('a call naming no genome, or one the session lacks, carries nothing', async () => {
  const plain = new Plain(pluginManager)
  await expect(
    reference(plain.serializeArguments({ sessionId: 's', adapterConfig })),
  ).resolves.toBeUndefined()
  await expect(
    reference(
      plain.serializeArguments({
        sessionId: 's',
        adapterConfig,
        assemblyName: 'nope',
      }),
    ),
  ).resolves.toBeUndefined()
})
