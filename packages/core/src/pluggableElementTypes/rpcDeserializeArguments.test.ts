import PluginManager from '../PluginManager.ts'
import { getBlobMap, setBlobMap } from '../util/tracks.ts'
import RpcMethodType from './RpcMethodType.ts'
import RpcMethodTypeWithFiltersAndRenameRegions from './RpcMethodTypeWithFiltersAndRenameRegions.ts'
import SerializableFilterChain from './renderers/util/serializableFilterChain.ts'

const pluginManager = new PluginManager()

class PlainMethod extends RpcMethodType {
  seen: unknown

  async execute(args: unknown) {
    this.seen = args
    return 'done'
  }
}

class FilteredMethod extends RpcMethodTypeWithFiltersAndRenameRegions {
  seen: unknown

  async execute(args: unknown) {
    this.seen = args
    return 'done'
  }
}

test('invoke installs the blob map before execute runs, without the method asking', async () => {
  setBlobMap({})
  const method = new PlainMethod(pluginManager)
  const file = new File(['x'], 'local.bam')

  await method.invoke(
    { sessionId: 's', blobMap: { 'blob-1': file } },
    'MainThreadRpcDriver',
  )

  expect(getBlobMap()['blob-1']).toBe(file)
})

test('execute sees the filter chain its arg type promises, not the wire string[]', async () => {
  const method = new FilteredMethod(pluginManager)

  await method.invoke(
    { sessionId: 's', filters: ['jexl:get(feature,"score") > 5'] },
    'MainThreadRpcDriver',
  )

  const { filters } = method.seen as { filters: SerializableFilterChain }
  expect(filters).toBeInstanceOf(SerializableFilterChain)
  expect(filters.toJSON().filters).toEqual(['jexl:get(feature,"score") > 5'])
})

// a plugin on the older contract calls this from its own execute, after invoke
// already has; rebuilding a chain from a chain would reach filters.map on one
test('deserializeArguments is idempotent, for plugins that still call it themselves', async () => {
  const method = new FilteredMethod(pluginManager)
  const once = await method.deserializeArguments(
    { sessionId: 's', filters: ['jexl:get(feature,"score") > 5'] },
    'MainThreadRpcDriver',
  )
  const twice = await method.deserializeArguments(once, 'MainThreadRpcDriver')

  const { filters } = twice as unknown as { filters: SerializableFilterChain }
  expect(filters).toBeInstanceOf(SerializableFilterChain)
  expect(filters.toJSON().filters).toEqual(['jexl:get(feature,"score") > 5'])
})
