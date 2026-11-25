import { createTestSession } from '@jbrowse/web/testUtils'
import { observable, runInAction, when } from 'mobx'

import type { BreakpointViewModel } from './model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const CTG_LEN = 10_000_000

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'volvox-ctgA',
          start: 0,
          end: CTG_LEN,
          seq: 'a'.repeat(1000),
        },
      ],
    },
  },
}

const variantTrack = {
  trackId: 'tk1',
  type: 'VariantTrack',
  name: 'tk1',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      { uniqueId: 'f1', refName: 'ctgA', start: 100, end: 200, name: 'f1' },
    ],
  },
}

const geneTrack = {
  trackId: 'genes',
  type: 'FeatureTrack',
  name: 'genes',
  assemblyNames: ['volvox'],
  adapter: {
    type: 'FromConfigAdapter',
    features: [
      { uniqueId: 'g1', refName: 'ctgA', start: 100, end: 200, name: 'g1' },
    ],
  },
}

type OverlayRpc = 'pass' | 'fail' | 'hold'

function deferred() {
  let release = () => {}
  const promise = new Promise<void>(resolve => {
    release = resolve
  })
  return { promise, release }
}

async function setup(trackIds: string[], { tooDense = false } = {}) {
  const session = createTestSession()
  session.addAssemblyConf(assembly)
  session.addTrackConf(variantTrack)
  session.addTrackConf(geneTrack)

  const state = { mode: 'pass' as OverlayRpc, held: deferred() }
  const calls = observable.box(0)
  const rpc = session.rpcManager
  const call = rpc.call.bind(rpc)
  rpc.call = (async (
    sessionId: string,
    method: string,
    args: { regions?: unknown[] },
  ) => {
    if (tooDense && method === 'MultiSampleVariantGetCellData') {
      return {
        regionTooLarge: true,
        featureCount: 5000,
        recordCounts: (args.regions ?? []).map(() => 5000),
      }
    }
    if (method === 'BreakpointGetFeatures') {
      runInAction(() => {
        calls.set(calls.get() + 1)
      })
      if (state.mode === 'fail') {
        throw new Error('overlay fetch failed')
      }
      if (state.mode === 'hold') {
        await state.held.promise
      }
    }
    return call(sessionId, method as never, args as never)
  }) as typeof rpc.call

  const loc = tooDense ? 'ctgA:1-100000' : 'ctgA:1-10000'
  const view = (await session.launchView('BreakpointSplitView', {
    views: [
      { assembly: 'volvox', loc },
      { assembly: 'volvox', loc },
    ],
  })) as BreakpointViewModel
  view.setWidth(800)
  await when(() => view.initialized, { timeout: 20000 })
  for (const trackId of trackIds) {
    for (const v of view.views) {
      await v.launchTrack(trackId)
    }
  }
  await when(() => view.overlaySvgReady, { timeout: 20000 })
  return { session, view, state, calls }
}

function panToNewBlocks(view: BreakpointViewModel) {
  const row = view.views[0]!
  row.scrollTo(row.offsetPx + 5000)
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test('the overlay is not ready between a pan and its commit, and is after', async () => {
  const { view } = await setup(['tk1'])
  expect(view.overlayLoadedKey).toEqual(view.overlayFetchKey)

  panToNewBlocks(view)
  expect(view.overlaySvgReady).toBe(false)

  await when(() => view.overlaySvgReady, { timeout: 20000 })
  expect(view.overlayLoadedKey).toEqual(view.overlayFetchKey)
  expect(view.overlayLoadedKey!.regionsPerView[0]![0]!.start).toBeGreaterThan(0)
}, 60000)

test('the export waits for the overlay fetch a pan started', async () => {
  const { view, state, calls } = await setup(['tk1'])
  state.mode = 'hold'
  const before = calls.get()
  panToNewBlocks(view)
  const exported = view.exportSvg({ save: false })
  await when(() => calls.get() > before, { timeout: 20000 })

  const first = await Promise.race([
    exported.then(() => 'export'),
    sleep(3000).then(() => 'wait'),
  ])
  expect(first).toBe('wait')

  state.held.release()
  await exported
  expect(view.overlaySvgReady).toBe(true)
  expect(view.overlayLoadedKey).toEqual(view.overlayFetchKey)
}, 60000)

function silenceNotifiedErrors() {
  return jest.spyOn(console, 'error').mockImplementation(() => {})
}

test('an overlay fetch failure fails the export', async () => {
  const consoleError = silenceNotifiedErrors()
  const { view, state } = await setup(['tk1'])
  state.mode = 'fail'
  panToNewBlocks(view)

  await expect(view.exportSvg({ save: false })).rejects.toThrow(
    /overlay fetch failed/,
  )
  expect(view.overlaySvgReady).toBe(true)
  expect(`${consoleError.mock.calls[0]?.[0]}`).toMatch(/overlay fetch failed/)
}, 60000)

test('a track resize does not refetch the overlay', async () => {
  const { view, calls } = await setup(['tk1'])
  const before = calls.get()
  view.views[0]!.tracks[0]!.displays[0]!.resizeHeight(50)

  expect(view.overlaySvgReady).toBe(true)
  await sleep(1500)
  expect(calls.get()).toBe(before)
}, 60000)

test('a reload is not ready until its refetch commits', async () => {
  const { view, calls } = await setup(['tk1'])
  const before = calls.get()
  view.reload()
  expect(view.overlaySvgReady).toBe(false)

  await when(() => view.overlaySvgReady, { timeout: 20000 })
  expect(calls.get()).toBeGreaterThan(before)
  expect(view.overlayLoadedKey).toEqual(view.overlayFetchKey)
}, 60000)

test('a reload whose refetch fails is terminal', async () => {
  const consoleError = silenceNotifiedErrors()
  const { view, state } = await setup(['tk1'])
  state.mode = 'fail'
  view.reload()

  await when(() => view.overlaySvgReady, { timeout: 20000 })
  expect(`${view.overlayError}`).toMatch(/overlay fetch failed/)
  expect(`${consoleError.mock.calls[0]?.[0]}`).toMatch(/overlay fetch failed/)
}, 60000)

describe('resting states that never fetch are terminal', () => {
  test('no variant track', async () => {
    const { view } = await setup(['genes'])
    expect(view.fetchInert).toBe(true)
    expect(view.overlaySvgReady).toBe(true)
  }, 60000)

  test('zero panels', async () => {
    const session = createTestSession()
    const view = (await session.launchView(
      'BreakpointSplitView',
      {},
    )) as BreakpointViewModel
    expect(view.views.length).toBe(0)
    expect(view.overlaySvgReady).toBe(true)
  })

  test('every variant track over its limit', async () => {
    const { view, calls } = await setup(['tk1'], { tooDense: true })
    await when(
      () => view.fetchedTracks.every(t => t.displays[0]!.regionTooLarge),
      { timeout: 20000 },
    )
    view.reload()
    expect(view.overlaySvgReady).toBe(true)
    const before = calls.get()
    panToNewBlocks(view)
    expect(view.overlaySvgReady).toBe(true)
    await sleep(1500)
    expect(calls.get()).toBe(before)
  }, 60000)
})
