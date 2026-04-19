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

  model.startMultiRegionGpuLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => new Map(data),
        upload: (b, n) => b.uploads.push(n),
        prune: () => {},
      },
    ],
    renderBlocks: () => [block],
    renderState: () => 1,
    render: b => {
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

test('plugins suppress markCanvasDrawn by gating renderState to undefined', () => {
  const model = TestModel.create()
  const data = observable.map<number, string>(undefined, { deep: false })
  const ready = observable.box(false)
  const backend: FakeBackend = { uploads: [], renders: 0 }

  model.startMultiRegionGpuLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => new Map(data),
        upload: (b, n) => b.uploads.push(n),
        prune: () => {},
      },
    ],
    renderBlocks: () => [block],
    renderState: () => (ready.get() ? 1 : undefined),
    render: b => {
      b.renders++
    },
  })

  runInAction(() => {
    data.set(0, 'a')
  })
  // Upload happened, but renderState is undefined → render skipped → not drawn.
  expect(backend.uploads).toEqual([0])
  expect(backend.renders).toBe(0)
  expect(model.canvasDrawn).toBe(false)

  runInAction(() => {
    ready.set(true)
  })
  expect(backend.renders).toBe(1)
  expect(model.canvasDrawn).toBe(true)

  model.stopGpuBackendLifecycle()
})

test('startSingleDataGpuLifecycle marks canvas drawn once every upload has data', () => {
  const model = TestModel.create()
  const a = observable.box<string | undefined>(undefined)
  const b = observable.box<string | undefined>(undefined)
  const backend = { uploads: [] as string[] }

  model.startSingleDataGpuLifecycle<typeof backend, number>({
    backend,
    uploads: [
      {
        getData: () => a.get(),
        upload: (bk, d) => bk.uploads.push(`a:${d}`),
      },
      {
        getData: () => b.get(),
        upload: (bk, d) => bk.uploads.push(`b:${d}`),
      },
    ],
    renderState: () => 1,
    render: () => {},
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
