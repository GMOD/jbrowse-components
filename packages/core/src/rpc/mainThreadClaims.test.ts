import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/index.ts'
import { BaseFeatureDataAdapter } from '../data_adapters/BaseAdapter/index.ts'
import {
  releaseAdapterSession,
  retainAdapterSession,
} from '../data_adapters/adapterSessionRefcount.ts'
import {
  cachedAdapterCount,
  clearAdapterCache,
  getAdapter,
} from '../data_adapters/dataAdapterCache.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType.ts'
import { fetchSeq } from '../util/fetchSeq.ts'
import { ObservableCreate } from '../util/rxjs.ts'
import { AuthNeededError } from '../util/types/index.ts'
import RpcManager from './RpcManager.ts'

import type { Feature } from '../util/simpleFeature.ts'
import type { AbstractSessionModel } from '../util/types/index.ts'

const touchMethod: string = 'Touch'

let built: string[] = []
let freed: string[] = []
let gate: Promise<void> | undefined
let executeGate: Promise<void> | undefined
let authFailures = 0

class TestAdapter extends BaseFeatureDataAdapter {
  constructor(...args: ConstructorParameters<typeof BaseFeatureDataAdapter>) {
    super(...args)
    built.push(this.getConf('path'))
  }
  async getRefNames() {
    return ['ctgA']
  }
  async getSequence() {
    return 'ACGT'
  }
  getFeatures() {
    return ObservableCreate<Feature>(o => {
      o.complete()
    })
  }
  freeResources() {
    freed.push(this.getConf('path'))
  }
}

const config = RpcManager.configSchema.create({
  defaultDriver: 'MainThreadRpcDriver',
})

function setup() {
  const pm = new PluginManager()
  pm.addAdapterType(
    () =>
      new AdapterType({
        name: 'Plain',
        configSchema: ConfigurationSchema(
          'Plain',
          { path: { type: 'string', defaultValue: '' } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(TestAdapter),
      }),
  )
  class Touch extends RpcMethodType {
    name = 'Touch'
    async serializeArguments(args: Record<string, unknown>) {
      if (authFailures > 0) {
        authFailures--
        throw new AuthNeededError('log in', 'https://example.org/a.bam')
      }
      if (gate) {
        await gate
      }
      if (args.nested) {
        // loadRefNameMap's CoreGetContigs, made during serialization
        await rpcManager.call(args.sessionId as string, touchMethod, {
          adapterConfig: args.nested,
        })
      }
      return args
    }
    async execute(args: Record<string, unknown>) {
      if (args.claimLate) {
        await executeGate
      }
      const { dataAdapter } = await getAdapter(
        pm,
        args.sessionId as string,
        args.adapterConfig as Record<string, unknown>,
      )
      return dataAdapter
    }
  }
  pm.addRpcMethod(() => new Touch(pm))
  pm.createPluggableElements()
  pm.configure()
  const rpcManager = new RpcManager(pm, config)
  return { pm, rpcManager }
}

const conf = { type: 'Plain', adapterId: 'adp-1', path: 'a.bam' }
const index = { type: 'Plain', adapterId: 'adp-1-index', path: 'a.bam.bai' }

function touch(rpcManager: RpcManager, extra: Record<string, unknown> = {}) {
  return rpcManager.call('adp-1', touchMethod, {
    adapterConfig: conf,
    ...extra,
  })
}

function tick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function hold() {
  let open = () => {}
  gate = new Promise<void>(resolve => {
    open = resolve
  })
  return open
}

beforeEach(() => {
  clearAdapterCache()
  built = []
  freed = []
  gate = undefined
  executeGate = undefined
  authFailures = 0
})

test('destroy frees what the driver claimed, before the tree releases', async () => {
  const { rpcManager } = setup()
  retainAdapterSession(rpcManager, 'adp-1')
  await touch(rpcManager)
  rpcManager.destroy()
  await tick()
  expect(freed).toEqual(['a.bam'])
  expect(cachedAdapterCount()).toBe(0)
  await releaseAdapterSession(rpcManager, 'adp-1')
  expect(cachedAdapterCount()).toBe(0)
})

test('a call held in serialization across destroy builds nothing', async () => {
  const { rpcManager } = setup()
  const open = hold()
  const pending = touch(rpcManager)
  rpcManager.destroy()
  open()
  await expect(pending).rejects.toThrow(/destroyed/)
  await tick()
  expect(built).toEqual([])
  expect(cachedAdapterCount()).toBe(0)
})

test('a nested call during serialization claims once, under the caller', async () => {
  const a = setup()
  const b = setup()
  retainAdapterSession(a.rpcManager, 'adp-1')
  retainAdapterSession(b.rpcManager, 'adp-1')
  await touch(a.rpcManager, { nested: index })
  await touch(b.rpcManager, { nested: index })
  expect(cachedAdapterCount()).toBe(2)
  await releaseAdapterSession(a.rpcManager, 'adp-1')
  expect(freed).toEqual([])
  await releaseAdapterSession(b.rpcManager, 'adp-1')
  expect(freed.sort()).toEqual(['a.bam', 'a.bam.bai'])
  expect(cachedAdapterCount()).toBe(0)
})

test('two RpcManagers sharing one config keep their claims apart', async () => {
  const a = setup()
  const b = setup()
  retainAdapterSession(a.rpcManager, 'adp-1')
  retainAdapterSession(b.rpcManager, 'adp-1')
  const first = await touch(a.rpcManager)
  expect(await touch(b.rpcManager)).toBe(first)
  await releaseAdapterSession(a.rpcManager, 'adp-1')
  expect(freed).toEqual([])
  expect(await touch(b.rpcManager)).toBe(first)
  a.rpcManager.destroy()
  await tick()
  expect(await touch(b.rpcManager)).toBe(first)
  expect(built).toEqual(['a.bam'])
})

test("fetchSeq's 'getSequence' claim goes with the engine", async () => {
  const { pm, rpcManager } = setup()
  const adapter = pm
    .getAdapterType('Plain')
    .configSchema.create(
      { type: 'Plain', adapterId: 'ref', path: 'ref.fa' },
      { pluginManager: pm },
    )
  const assembly = {
    configuration: { sequence: { adapter } },
    getCanonicalRefName2: (refName: string) => refName,
    getSeqAdapterRefName: (refName: string) => refName,
  }
  const session = {
    rpcManager,
    assemblyManager: { waitForAssembly: async () => assembly },
  } as unknown as AbstractSessionModel
  expect(
    await fetchSeq({
      start: 0,
      end: 4,
      refName: 'ctgA',
      assemblyName: 'volvox',
      session,
    }),
  ).toBe('ACGT')
  expect(cachedAdapterCount()).toBe(1)
  rpcManager.destroy()
  await tick()
  expect(freed).toEqual(['ref.fa'])
  expect(cachedAdapterCount()).toBe(0)
})

test('a destroy while an auth retry serializes builds nothing', async () => {
  const { pm, rpcManager } = setup()
  pm.setRootModel({
    findAppropriateInternetAccount: () => undefined,
    internetAccounts: [],
    createEphemeralInternetAccount: () => {},
  } as unknown as Parameters<typeof pm.setRootModel>[0])
  authFailures = 1
  const open = hold()
  const pending = touch(rpcManager)
  await tick()
  expect(authFailures).toBe(0)
  rpcManager.destroy()
  open()
  await expect(pending).rejects.toThrow(/destroyed/)
  await tick()
  expect(built).toEqual([])
  expect(cachedAdapterCount()).toBe(0)
})

test('a batch claim left for the next engine is found by it', async () => {
  const first = setup()
  retainAdapterSession(first.rpcManager, 'adp-1')
  await touch(first.rpcManager)
  // jb2export batch: destroy(model) only, so the claim outlives the record
  const second = setup()
  retainAdapterSession(second.rpcManager, 'adp-1')
  await touch(second.rpcManager)
  expect(built).toEqual(['a.bam'])
  expect(cachedAdapterCount()).toBe(1)
})

test('a call executing at destroy that claims its adapter after destroy is freed once it settles', async () => {
  const { rpcManager } = setup()
  let open = () => {}
  executeGate = new Promise<void>(resolve => {
    open = resolve
  })
  const pending = touch(rpcManager, { claimLate: true })
  await tick()
  rpcManager.destroy()
  open()
  await pending
  await tick()
  expect(built).toEqual(['a.bam'])
  expect(cachedAdapterCount()).toBe(0)
})

test("a call that never settles does not hold the engine's other sessions", async () => {
  const { rpcManager } = setup()
  await touch(rpcManager)
  executeGate = new Promise<void>(() => {})
  void rpcManager.call('stuck', touchMethod, {
    adapterConfig: index,
    claimLate: true,
  })
  await tick()
  rpcManager.destroy()
  await tick()
  expect(freed).toEqual(['a.bam'])
})
