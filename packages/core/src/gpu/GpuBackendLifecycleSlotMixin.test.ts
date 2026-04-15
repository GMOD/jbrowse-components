import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { GpuBackendLifecycleSlotMixin } from './GpuBackendLifecycleSlotMixin.ts'

import type { RenderBlock } from './renderBlock.ts'

const TestModel = types.compose(
  'TestModel',
  GpuBackendLifecycleSlotMixin(),
  types.model({}),
)

interface FakeBackend {
  uploads: number[]
  renders: number
}

const block: RenderBlock = {
  regionNumber: 0,
  bpRangeX: [0, 100],
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

test('startMultiRegionGpuLifecycle marks canvas drawn on commits with data', () => {
  const model = TestModel.create()
  const data = observable.map<number, string>(undefined, { deep: false })
  const backend: FakeBackend = { uploads: [], renders: 0 }

  expect(model.canvasDrawn).toBe(false)

  model.startMultiRegionGpuLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [block],
    getRenderState: () => 1,
    uploadOneRegion: (b, n) => b.uploads.push(n),
    pruneRegionsNotIn: () => {},
    renderAllBlocks: b => {
      b.renders++
    },
  })

  // No data yet — canvas not drawn.
  expect(model.canvasDrawn).toBe(false)

  runInAction(() => {
    data.set(0, 'a')
  })
  expect(model.canvasDrawn).toBe(true)
  expect(backend.uploads).toEqual([0])

  // Idempotent: re-firing autorun does not retoggle.
  const before = model.canvasDrawn
  runInAction(() => {
    data.set(1, 'b')
  })
  expect(model.canvasDrawn).toBe(before)

  model.stopGpuBackendLifecycle()
})

test('explicit onAfterCommit suppresses default markCanvasDrawn wiring', () => {
  const model = TestModel.create()
  const data = observable.map<number, string>(undefined, { deep: false })
  const backend: FakeBackend = { uploads: [], renders: 0 }
  let userCalls = 0

  model.startMultiRegionGpuLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [],
    getRenderState: () => 1,
    uploadOneRegion: () => {},
    pruneRegionsNotIn: () => {},
    renderAllBlocks: () => {},
    // Plugin opts out of default mark; gates manually.
    onAfterCommit: () => {
      userCalls++
    },
  })

  runInAction(() => {
    data.set(0, 'a')
  })
  expect(userCalls).toBeGreaterThan(0)
  expect(model.canvasDrawn).toBe(false)

  model.stopGpuBackendLifecycle()
})

test('startSingleDataGpuLifecycle marks canvas drawn once every slot has data', () => {
  const model = TestModel.create()
  const a = observable.box<string | undefined>(undefined)
  const b = observable.box<string | undefined>(undefined)
  const backend = { uploads: [] as string[] }

  model.startSingleDataGpuLifecycle<typeof backend, number>({
    backend,
    uploadSlots: [
      { readData: () => a.get(), commitUpload: (bk, d) => bk.uploads.push(`a:${d}`) },
      { readData: () => b.get(), commitUpload: (bk, d) => bk.uploads.push(`b:${d}`) },
    ],
    getRenderState: () => 1,
    renderWithState: () => {},
  })

  expect(model.canvasDrawn).toBe(false)

  runInAction(() => {
    a.set('1')
  })
  expect(model.canvasDrawn).toBe(false)

  runInAction(() => {
    b.set('2')
  })
  expect(model.canvasDrawn).toBe(true)

  model.stopGpuBackendLifecycle()
})
