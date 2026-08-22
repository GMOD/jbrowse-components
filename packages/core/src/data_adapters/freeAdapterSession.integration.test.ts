/**
 * End-to-end proof that closing the last track holding an adapter config
 * actually evicts the adapter.
 *
 * The refcount unit tests stub `rpcManager.call`, so on their own they show
 * only that the *decision* to free is right. This drives a real RpcManager over
 * MainThreadRpcDriver, which resolves and executes the real CoreFreeResources
 * against the real module-level dataAdapterCache — the path a worker takes,
 * minus the postMessage. Without it, a CoreFreeResources that failed to
 * resolve would be swallowed by releaseAdapterSession's catch and the whole
 * mechanism would silently do nothing.
 */
import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import RpcManager from '../rpc/RpcManager.ts'
import { BaseAdapter } from './BaseAdapter/index.ts'
import {
  releaseAdapterSession,
  retainAdapterSession,
} from './adapterSessionRefcount.ts'
import { clearAdapterCache, getAdapter } from './dataAdapterCache.ts'

class TestAdapter extends BaseAdapter {}

function setup() {
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestAdapter',
        configSchema: ConfigurationSchema(
          'TestAdapter',
          { path: { type: 'string', defaultValue: '' } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(TestAdapter),
      }),
  )
  pluginManager.createPluggableElements()
  pluginManager.configure()

  const rpcManager = new RpcManager(
    pluginManager,
    RpcManager.configSchema.create({ defaultDriver: 'MainThreadRpcDriver' }),
  )
  return { pluginManager, rpcManager }
}

beforeEach(() => {
  clearAdapterCache()
})

test('the last track closing evicts the adapter for real', async () => {
  const { pluginManager, rpcManager } = setup()
  const conf = { type: 'TestAdapter', adapterId: 'adapterA', path: 'a.bam' }

  retainAdapterSession(rpcManager, 'adapterA')
  const first = await getAdapter(pluginManager, 'adapterA', conf)
  // same config while the track is open: the cache hands back one instance
  expect((await getAdapter(pluginManager, 'adapterA', conf)).dataAdapter).toBe(
    first.dataAdapter,
  )

  await releaseAdapterSession(rpcManager, 'adapterA')

  // evicted: a fresh instance, which is only possible if the cache key is gone
  expect(
    (await getAdapter(pluginManager, 'adapterA', conf)).dataAdapter,
  ).not.toBe(first.dataAdapter)
})

test('the same track in two views survives one of them closing', async () => {
  const { pluginManager, rpcManager } = setup()
  const conf = { type: 'TestAdapter', adapterId: 'adapterA', path: 'a.bam' }

  retainAdapterSession(rpcManager, 'adapterA')
  retainAdapterSession(rpcManager, 'adapterA')
  const first = await getAdapter(pluginManager, 'adapterA', conf)

  await releaseAdapterSession(rpcManager, 'adapterA')
  expect((await getAdapter(pluginManager, 'adapterA', conf)).dataAdapter).toBe(
    first.dataAdapter,
  )

  await releaseAdapterSession(rpcManager, 'adapterA')
  expect(
    (await getAdapter(pluginManager, 'adapterA', conf)).dataAdapter,
  ).not.toBe(first.dataAdapter)
})

test('closing one track does not evict an unrelated one', async () => {
  const { pluginManager, rpcManager } = setup()
  const confA = { type: 'TestAdapter', adapterId: 'adapterA', path: 'a.bam' }
  const confB = { type: 'TestAdapter', adapterId: 'adapterB', path: 'b.bam' }

  retainAdapterSession(rpcManager, 'adapterA')
  retainAdapterSession(rpcManager, 'adapterB')
  const a = await getAdapter(pluginManager, 'adapterA', confA)
  const b = await getAdapter(pluginManager, 'adapterB', confB)

  await releaseAdapterSession(rpcManager, 'adapterA')

  expect((await getAdapter(pluginManager, 'adapterB', confB)).dataAdapter).toBe(
    b.dataAdapter,
  )
  expect(
    (await getAdapter(pluginManager, 'adapterA', confA)).dataAdapter,
  ).not.toBe(a.dataAdapter)
})

// a sub-adapter carries its parent's sessionId, so two tracks sharing a
// sequence adapter must both close before it goes
test('a sub-adapter shared by two tracks outlives the first close', async () => {
  const { pluginManager, rpcManager } = setup()
  const shared = { type: 'TestAdapter', adapterId: 'sharedSeq', path: 's.fa' }

  retainAdapterSession(rpcManager, 'trackA')
  retainAdapterSession(rpcManager, 'trackB')
  // both parents pull the same sub-adapter, each under its own sessionId
  const sub = await getAdapter(pluginManager, 'trackA', shared)
  await getAdapter(pluginManager, 'trackB', shared)

  await releaseAdapterSession(rpcManager, 'trackA')
  expect((await getAdapter(pluginManager, 'trackB', shared)).dataAdapter).toBe(
    sub.dataAdapter,
  )

  await releaseAdapterSession(rpcManager, 'trackB')
  expect(
    (await getAdapter(pluginManager, 'trackB', shared)).dataAdapter,
  ).not.toBe(sub.dataAdapter)
})

/**
 * The teardown ordering ADR-069 prescribes, end to end: `detach()` destroys the
 * RpcManager, and the tree is destroyed a task later — which is what runs every
 * track's disposer, and therefore what fires every adapter free. So a free after
 * `destroy()` is the ordinary case in a session switch rather than a misuse, and
 * neither it nor a call arriving in the same gap may rebuild what the destroy
 * tore down. ADR-086.
 */
test('a free after the manager is destroyed boots nothing', async () => {
  const { pluginManager } = setup()
  let workersMade = 0
  const rpcManager = new RpcManager(
    pluginManager,
    RpcManager.configSchema.create({ defaultDriver: 'WebWorkerRpcDriver' }),
    {
      makeWorkerInstance: () => {
        workersMade++
        throw new Error('the pool must not boot a worker here')
      },
    },
  )

  retainAdapterSession(rpcManager, 'adapterA')
  rpcManager.destroy()

  // the disposer's own `void releaseAdapterSession(...)`: it must not reject
  // into the teardown path either
  await expect(
    releaseAdapterSession(rpcManager, 'adapterA'),
  ).resolves.toBeUndefined()
  expect(workersMade).toBe(0)

  // the other half of the gap: a fetch autorun that has not been disposed yet
  // fires between `detach()` and the deferred `destroy(tree)`. It has to report,
  // rather than build the second pool the destroy would never reach.
  await expect(
    rpcManager.call('adapterA', 'CoreGetRegions', { adapterConfig: {} }),
  ).rejects.toThrow(/destroyed/)
  expect(workersMade).toBe(0)
})
