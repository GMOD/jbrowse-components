import { GpuBackendLifecycleSlotMixin } from '@jbrowse/core/gpu/GpuBackendLifecycleSlotMixin'
import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { installPerRegionWiggleLifecycle } from './installPerRegionWiggleLifecycle.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'

const TestModel = types
  .compose('TestModel', GpuBackendLifecycleSlotMixin(), types.model({}))
  .volatile(() => ({
    renderState: undefined as WiggleGPURenderState | undefined,
    renderBlocks: [] as WiggleRenderBlock[],
  }))

interface UploadCall {
  key: number
  payload: SourceRenderData[]
}

function makeFakeBackend() {
  const uploads: UploadCall[] = []
  const prunes: number[][] = []
  const backend: WiggleBackend = {
    uploadRegion(key, payload) {
      uploads.push({ key, payload })
    },
    pruneRegions(active) {
      prunes.push([...active])
    },
    renderBlocks() {},
    dispose() {},
  }
  return { backend, uploads, prunes }
}

function makeSourceRenderData(rowIndex: number): SourceRenderData[] {
  return [
    {
      featurePositions: new Uint32Array(0),
      featureScores: new Float32Array(0),
      numFeatures: 0,
      color: [0, 0, 0],
      rowIndex,
    },
  ]
}

beforeEach(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
})

test('N sequential region arrivals trigger N uploads, not N²', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionWiggleLifecycle(model, data, backend, value =>
    makeSourceRenderData(value),
  )

  for (let key = 0; key < 5; key++) {
    runInAction(() => {
      data.set(key, key * 10)
    })
  }

  expect(uploads.map(u => u.key)).toEqual([0, 1, 2, 3, 4])
})

test('encode-tracked observable change re-fires every per-key autorun', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  const colorBox = observable.box(0)

  installPerRegionWiggleLifecycle(model, data, backend, () => [
    {
      featurePositions: new Uint32Array(0),
      featureScores: new Float32Array(0),
      numFeatures: 0,
      color: [colorBox.get(), 0, 0],
      rowIndex: 0,
    },
  ])

  runInAction(() => {
    data.set(0, 'a')
    data.set(1, 'b')
    data.set(2, 'c')
  })

  expect(uploads).toHaveLength(3)

  runInAction(() => {
    colorBox.set(1)
  })

  // All three per-key autoruns re-fire on the encoder dep change.
  expect(uploads).toHaveLength(6)
  expect(uploads.slice(3).map(u => u.key).sort()).toEqual([0, 1, 2])
})

test('only the changed key re-uploads when its value mutates', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionWiggleLifecycle(model, data, backend, value =>
    makeSourceRenderData(value),
  )

  runInAction(() => {
    data.set(0, 10)
    data.set(1, 20)
    data.set(2, 30)
  })

  const baseline = uploads.length
  runInAction(() => {
    data.set(1, 99)
  })

  expect(uploads.length).toBe(baseline + 1)
  expect(uploads[uploads.length - 1]!.key).toBe(1)
})

test('removing a key disposes its autorun and prune lists active set', () => {
  const model = TestModel.create()
  const { backend, uploads, prunes } = makeFakeBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionWiggleLifecycle(model, data, backend, value =>
    makeSourceRenderData(value),
  )

  runInAction(() => {
    data.set(0, 1)
    data.set(1, 2)
    data.set(2, 3)
  })

  runInAction(() => {
    data.delete(1)
  })

  const lastPrune = prunes[prunes.length - 1]!
  expect([...lastPrune].sort()).toEqual([0, 2])

  const baseline = uploads.length
  // Re-adding key 1 spawns a new autorun (the prior one was disposed).
  runInAction(() => {
    data.set(1, 999)
  })

  expect(uploads.length).toBe(baseline + 1)
  expect(uploads[uploads.length - 1]!).toMatchObject({ key: 1 })
})

test('backend swap (context-loss recovery) routes uploads to new backend', () => {
  const model = TestModel.create()
  const a = makeFakeBackend()
  const b = makeFakeBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionWiggleLifecycle(model, data, a.backend, value =>
    makeSourceRenderData(value),
  )

  runInAction(() => {
    data.set(0, 1)
    data.set(1, 2)
  })

  expect(a.uploads.map(u => u.key)).toEqual([0, 1])
  expect(b.uploads).toHaveLength(0)

  // Swap backend — same as context-loss recovery path.
  model.installGpuDisplay<WiggleBackend>(b.backend, {
    upload: () => {},
    render: () => false,
  })

  // Per-key autoruns track currentGpuBackend; both fire and push to b.
  expect(b.uploads.map(u => u.key).sort()).toEqual([0, 1])
})
