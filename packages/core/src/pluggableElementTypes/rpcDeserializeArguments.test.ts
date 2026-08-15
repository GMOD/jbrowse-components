import PluginManager from '../PluginManager.ts'
import { getBlobMap, setBlobMap } from '../util/tracks.ts'
import RpcMethodType from './RpcMethodType.ts'
import RpcMethodTypeWithFiltersAndRenameRegions from './RpcMethodTypeWithFiltersAndRenameRegions.ts'
import SerializableFilterChain from './renderers/util/serializableFilterChain.ts'

// `RpcMethodType.invoke` is what the two drivers call, and it deserializes the
// arguments before `execute` sees them. That used to be each subclass's job —
// one `await this.deserializeArguments(args, driver)` at the top of every
// `execute` — with a test that scanned the sources for the ones that had
// forgotten. Eleven methods across seven plugins had, every primary per-region
// fetch RPC among them, because the step is invisible twice over: the blob map
// is a worker module global, so a method that skips it reads whatever the last
// RPC left behind (the right answer, by accident, until a worker reboots with
// none); and the arg types describe the DESERIALIZED shape, so skipping it is
// not a type error but makes the signature false.
//
// These pin the behavior rather than the source text.

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

  // PlainMethod.execute never calls deserializeArguments; the base did it
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

// An external plugin written against the older contract opens its `execute`
// with a deserializeArguments call of its own, and by then invoke has already
// run one. Every override has to survive that; the filters one is the only
// in-tree override with state to rebuild, and rebuilding a chain from a chain
// would reach `filters.map` on a SerializableFilterChain and throw.
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
