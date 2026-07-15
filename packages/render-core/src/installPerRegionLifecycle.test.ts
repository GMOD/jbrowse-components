import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { installPerRegionLifecycle } from './installPerRegionLifecycle.ts'

const TestModel = types
  .compose('TestModel', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({}))

interface FakeEncoded {
  value: number
  marker: number
}

interface UploadCall {
  key: number
  payload: FakeEncoded
}

interface FakeRenderingBackend {
  uploadRegion(key: number, payload: FakeEncoded): void
  pruneRegions(active: Iterable<number>): void
}

function makeFakeRenderingBackend() {
  const uploads: UploadCall[] = []
  const prunes: number[][] = []
  const backend: FakeRenderingBackend = {
    uploadRegion(key, payload) {
      uploads.push({ key, payload })
    },
    pruneRegions(active) {
      prunes.push([...active])
    },
  }
  return { backend, uploads, prunes }
}

beforeEach(() => {
  console.warn = jest.fn()
  console.error = jest.fn()
})

test('N sequential region arrivals trigger N uploads, not N²', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionLifecycle(
    model,
    data,
    backend,
    value => ({ value, marker: 0 }),
    () => true,
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
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  const markerBox = observable.box(0)

  installPerRegionLifecycle(
    model,
    data,
    backend,
    () => ({ value: 0, marker: markerBox.get() }),
    () => true,
  )

  runInAction(() => {
    data.set(0, 'a')
    data.set(1, 'b')
    data.set(2, 'c')
  })

  expect(uploads).toHaveLength(3)

  runInAction(() => {
    markerBox.set(1)
  })

  expect(uploads).toHaveLength(6)
  expect(
    uploads
      .slice(3)
      .map(u => u.key)
      .sort(),
  ).toEqual([0, 1, 2])
})

test('only the changed key re-uploads when its value mutates', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionLifecycle(
    model,
    data,
    backend,
    value => ({ value, marker: 0 }),
    () => true,
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

test('removing a key disposes its autorun and prunes from active set', () => {
  const model = TestModel.create()
  const { backend, uploads, prunes } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionLifecycle(
    model,
    data,
    backend,
    value => ({ value, marker: 0 }),
    () => true,
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
  const a = makeFakeRenderingBackend()
  const b = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionLifecycle(
    model,
    data,
    a.backend,
    value => ({ value, marker: 0 }),
    () => true,
  )

  runInAction(() => {
    data.set(0, 1)
    data.set(1, 2)
  })

  expect(a.uploads.map(u => u.key)).toEqual([0, 1])
  expect(b.uploads).toHaveLength(0)

  model.attachRenderingBackend<FakeRenderingBackend>(b.backend, {
    upload: () => {},
    render: () => false,
  })

  expect(b.uploads.map(u => u.key).sort()).toEqual([0, 1])
})

test('a throw in encode/upload routes to renderError instead of escaping', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  const err = new Error('bad region encode')
  installPerRegionLifecycle(
    model,
    data,
    backend,
    () => {
      throw err
    },
    () => false,
  )

  runInAction(() => {
    data.set(0, 10)
  })

  // The per-key autorun's throw is caught and routed to renderError (the
  // 'renderError' terminal phase) rather than escaping as an uncaught reaction
  // error that would strand the display on 'loading'; nothing was uploaded.
  expect(model.renderError).toBe(err)
  expect(uploads).toHaveLength(0)
})

test('render callback receives the cached encoded map', () => {
  const model = TestModel.create()
  const { backend } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  let lastEncoded: ReadonlyMap<number, FakeEncoded> | undefined

  installPerRegionLifecycle(
    model,
    data,
    backend,
    value => ({ value, marker: 0 }),
    (_b, encoded) => {
      lastEncoded = encoded
      return true
    },
  )

  runInAction(() => {
    data.set(0, 100)
    data.set(1, 200)
  })

  expect(lastEncoded?.get(0)).toEqual({ value: 100, marker: 0 })
  expect(lastEncoded?.get(1)).toEqual({ value: 200, marker: 0 })

  runInAction(() => {
    data.delete(0)
  })

  expect(lastEncoded?.has(0)).toBe(false)
  expect(lastEncoded?.has(1)).toBe(true)
})

test('encode returning undefined leaves the cached encoded entry untouched', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  const ready = observable.box(true)
  let lastEncoded: ReadonlyMap<number, FakeEncoded> | undefined

  installPerRegionLifecycle(
    model,
    data,
    backend,
    value => (ready.get() ? { value, marker: 0 } : undefined),
    (_b, encoded) => {
      lastEncoded = encoded
      return true
    },
  )

  runInAction(() => {
    data.set(0, 10)
  })
  expect(uploads).toHaveLength(1)
  expect(lastEncoded?.get(0)).toEqual({ value: 10, marker: 0 })

  // Toggle ready -> false; the autorun re-runs but encode returns undefined.
  // Existing cached value stays, no new upload.
  const baseline = uploads.length
  runInAction(() => {
    ready.set(false)
    data.set(0, 99)
  })
  expect(uploads.length).toBe(baseline)
  expect(lastEncoded?.get(0)).toEqual({ value: 10, marker: 0 })
})
