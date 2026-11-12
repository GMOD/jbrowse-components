import path from 'node:path'
import { pathToFileURL } from 'node:url'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'
import { registerComparativeAdapters } from '@jbrowse/plugin-comparative-adapters/tables'
import { when } from 'mobx'

import {
  executeMultiWayFeatures,
  liftAlignmentOps,
  multiWayFeaturesOf,
} from './MultiWayGetFeatures.ts'
import { createDisplayWithSession } from './testEnv.ts'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { RegionLike, RpcArgs } from '@jbrowse/core/rpc/RpcRegistry'

function adapterEngine() {
  class Adapters extends Plugin {
    name = 'Adapters'
    install(pluginManager: PluginManager) {
      registerComparativeAdapters(pluginManager)
    }
  }
  const pluginManager = new PluginManager([new Adapters()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return pluginManager
}

function isMultiWayArgs(
  args: Record<string, unknown>,
): args is Record<string, unknown> & RpcArgs<'MultiWayGetFeatures'> {
  return Array.isArray(args.regions)
}

// polled, not `when`: a recorded RPC call is not an observable
async function until(condition: () => boolean) {
  for (let i = 0; i < 400 && !condition(); i++) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  expect(condition()).toBe(true)
}

function ribbonCount(display: MultiWaySyntenyDisplayModel) {
  const cell = display.ribbonGeometry.cells.get('ribbons:0')
  return cell?.kind === 'ribbons' ? cell.data.instanceCount : 0
}

test('a track naming the view genome by an alias draws its lanes, the adapter answering the anchor under that alias', async () => {
  const engine = adapterEngine()
  const asked: RegionLike[] = []
  const { display } = createDisplayWithSession({
    syntenyAdapter: {
      type: 'PAFAdapter',
      pafLocation: {
        uri: pathToFileURL(path.resolve('test_data/volvox/volvox_ins.paf'))
          .href,
        locationType: 'UriLocation',
      },
      assemblyNames: ['volvox_ins', 'vvx'],
    },
    trackAssemblyNames: ['vvx', 'volvox_ins'],
    geneTracks: [],
    assemblyAliases: { vvx: 'volvox' },
    rpc: async (name, args) => {
      if (name === 'MultiWayGetFeatures' && isMultiWayArgs(args)) {
        asked.push(...args.regions)
        return multiWayFeaturesOf(
          liftAlignmentOps(
            await executeMultiWayFeatures({
              ...args,
              pluginManager: engine,
              sessionId: 'test',
            }),
          ),
        )
      }
      return []
    },
  })
  await when(
    () => display.features !== undefined || display.error !== undefined,
    { timeout: 10_000 },
  )
  expect(display.error).toBeUndefined()
  expect(display.features?.length).toBeGreaterThan(0)
  expect(asked.map(r => r.assemblyName)).toEqual(['vvx'])
  expect(display.anchorAssemblyName).toBe('volvox')
  expect(display.rowAssemblies).toEqual(['volvox_ins'])
  await when(() => ribbonCount(display) > 0, { timeout: 10_000 })
})

describe('the lane-pair fetches of a track naming the view genome by an alias', () => {
  const decisionOn = (refName: string, pivotLaneBp: number) => ({
    refName,
    flipped: false,
    rung: 1,
    pivotAnchor: { refName: 'ctgA', coord: 200 },
    pivotLaneBp,
    pivotInHoleBp: 0,
    fitMin: pivotLaneBp - 100,
    fitMax: pivotLaneBp + 100,
    alsoOn: [],
    alsoOnMore: 0,
    alsoAt: [],
    pinned: false,
    orientationPinned: false,
  })
  const mateRecord = (id: string, assemblyName: string, refName: string) =>
    new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: 100,
      end: 300,
      strand: 1,
      mate: { assemblyName, refName, start: 100, end: 300 },
    })

  const isPairCall = (call: RpcArgs<'MultiWayGetFeatures'>) =>
    call.opts?.mateShape !== 'grouped'

  async function adapterCalls(
    syntenyAdapter: Record<string, unknown>,
    trackAssemblyNames = ['vvx', 'volvox_random', 'volvox_ins'],
  ) {
    const calls: RpcArgs<'MultiWayGetFeatures'>[] = []
    const { display } = createDisplayWithSession({
      syntenyAdapter,
      trackAssemblyNames,
      geneTracks: [],
      assemblyAliases: { vvx: 'volvox', vr: 'volvox_random' },
      rpc: async (name, args) => {
        if (name === 'MultiWayGetFeatures' && isMultiWayArgs(args)) {
          calls.push(args)
        }
        return name === 'CoreGetInfo' ? { hasCoarseTier: false, lanes: [] } : []
      },
    })
    await when(() => display.features !== undefined, { timeout: 5000 })
    display.setFeatures([
      mateRecord('r1', 'volvox_random', 'ctgB'),
      mateRecord('r2', 'volvox_ins', 'ctgC'),
    ])
    display.setLaneFrames(
      0,
      new Map([
        ['volvox_random', decisionOn('ctgB', 200)],
        ['volvox_ins', decisionOn('ctgC', 1200)],
      ]),
    )
    await until(() => calls.some(isPairCall))
    return calls
  }

  async function pairCalls(adapterType: string) {
    const calls = await adapterCalls({ type: adapterType })
    return calls.filter(isPairCall)
  }

  const assemblies = (calls: RpcArgs<'MultiWayGetFeatures'>[]) =>
    calls.flatMap(call => call.regions.map(r => r.assemblyName))

  test('a pair read on the anchor asks for the anchor window under the alias', async () => {
    const calls = await pairCalls('GbzBaseSyntenyAdapter')
    expect(assemblies(calls)).toEqual(['vvx'])
    expect(calls[0]!.opts).toMatchObject({
      queryAssemblyName: 'volvox_random',
      targetAssemblyName: 'volvox_ins',
    })
  })

  test('a batch of pairs read on the anchor asks for the anchor window under the alias', async () => {
    const calls = await pairCalls('BatchingGraphAdapter')
    expect(assemblies(calls)).toEqual(['vvx'])
    expect(calls[0]!.opts?.lanePairs).toEqual([
      { queryAssemblyName: 'volvox_random', targetAssemblyName: 'volvox_ins' },
    ])
  })

  test('a track and an adapter spelling a mate lane differently ask for every window as the adapter spells it', async () => {
    const calls = await adapterCalls(
      {
        type: 'MCScanBlocksAdapter',
        blockAssemblies: ['volvox', 'volvox_random', 'volvox_ins'],
      },
      ['vvx', 'vr', 'volvox_ins'],
    )
    expect(assemblies(calls.slice(0, 1))).toEqual(['volvox'])
    expect(assemblies(calls.filter(isPairCall))).toEqual(['volvox_random'])
  })
})
