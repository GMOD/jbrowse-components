import { setConf } from '@jbrowse/core/configuration'
import { SimpleFeature } from '@jbrowse/core/util'
import { reaction, when } from 'mobx'

import { laneFetchAwaits } from './laneFetch.ts'
import { LANE_TEMPLATE_MAX_BP } from './laneLayers.ts'
import { createDisplayWithSession } from './testEnv.ts'

import type { RpcCall } from './testEnv.ts'

const MATE = 'volvox_random'

const orthologs = [0, 1, 2, 3].map(
  i =>
    new SimpleFeature({
      uniqueId: `g${i}`,
      name: `g${i}`,
      refName: 'ctgA',
      start: 50 + 100 * i,
      end: 110 + 100 * i,
      strand: 1,
      mate: {
        assemblyName: MATE,
        refName: 'ctgA',
        start: 1600 + 100 * i,
        end: 1660 + 100 * i,
      },
    }),
)

async function templateDisplay(rpc: RpcCall) {
  const { display } = createDisplayWithSession({
    trackAssemblyNames: ['volvox', MATE],
    rpc,
  })
  setConf(display, 'laneLayers', [
    {
      name: 'GC',
      adapter: { type: 'TestSequenceScoreAdapter' },
      tracks: [],
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    },
  ])
  await when(() => display.features !== undefined, { timeout: 5000 })
  display.setFeatures(orthologs)
  await when(() => display.rowFrames.get(MATE) !== undefined, {
    timeout: 5000,
  })
  return display
}

const pastDebounce = () => new Promise(r => setTimeout(r, 800))

async function until(done: () => boolean) {
  const deadline = Date.now() + 5000
  while (!done() && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10))
  }
  expect(done()).toBe(true)
}

async function stalledDisplay() {
  const signals: AbortSignal[] = []
  const pending: (() => void)[] = []
  const display = await templateDisplay(async (name, { signal }) => {
    if (name === 'CoreGetEncodedLayers') {
      if (signal instanceof AbortSignal) {
        signals.push(signal)
      }
      await new Promise<void>(resolve => {
        pending.push(resolve)
      })
      return { layers: [] }
    }
    return orthologs
  })
  await pastDebounce()
  const live = signals.filter(signal => !signal.aborted)
  expect(live).toHaveLength(display.laneLayersFetchSpecs.length)
  return { display, signals, live, pending }
}

test('a lane fetch in flight survives its specs being rebuilt unchanged, and lands', async () => {
  const { display, signals, live, pending } = await stalledDisplay()
  const issued = signals.length
  const keys = display.laneLayersFetchSpecs.map(spec => spec.key)
  let rebuilt = 0
  const stop = reaction(
    () => display.laneLayersFetchSpecs,
    () => {
      rebuilt += 1
    },
  )
  display.lgv.zoomTo(display.lgv.bpPerPx * 0.99)
  stop()
  expect(rebuilt).toBe(1)
  expect(display.laneLayersFetchSpecs.map(spec => spec.key)).toEqual(keys)
  await pastDebounce()
  expect(signals).toHaveLength(issued)
  expect(live.some(signal => signal.aborted)).toBe(false)
  for (const resolve of pending) {
    resolve()
  }
  await when(() => display.laneLayerData.held.size === keys.length, {
    timeout: 5000,
  })
})

test('a lane fetch in flight is superseded once a lane asks for something else', async () => {
  const { display, signals, live } = await stalledDisplay()
  const issued = signals.length
  const keys = display.laneLayersFetchSpecs.map(spec => spec.key)
  display.lgv.zoomTo(display.lgv.bpPerPx / 4)
  expect(display.laneLayersFetchSpecs.map(spec => spec.key)).not.toEqual(keys)
  await until(() => signals.length > issued)
  expect(live.every(signal => signal.aborted)).toBe(true)
})

test('a retry re-issues a lane fetch still in flight', async () => {
  let issued = 0
  const display = await templateDisplay(async name => {
    if (name === 'CoreGetEncodedLayers') {
      issued += 1
      await new Promise(() => {})
    }
    return orthologs
  })
  await pastDebounce()
  const before = issued
  display.reload()
  await until(() => issued > before)
})

test('zooming a template layer past its cap stops drawing the bars it held', async () => {
  const display = await templateDisplay(async name =>
    name === 'CoreGetEncodedLayers' ? { layers: [] } : orthologs,
  )
  await when(() => display.laneLayerData.held.size > 0, { timeout: 5000 })
  const { landedFor } = display.laneLayerData
  display.lgv.setDisplayedRegions([
    {
      refName: 'ctgA',
      start: 0,
      end: 2 * LANE_TEMPLATE_MAX_BP,
      assemblyName: 'volvox',
    },
  ])
  display.lgv.showAllRegions()
  expect(display.laneLayersFetchSpecs).toEqual([])
  await when(() => display.laneLayerData.held.size === 0, { timeout: 3000 })
  expect(display.laneLayerData).toMatchObject({ landed: true, landedFor })
  expect(
    laneFetchAwaits(
      display.laneLayerData,
      [],
      display.anchorAssemblyName,
      false,
    ),
  ).toBe(false)
})
