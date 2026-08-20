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

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => ({ value, marker: 0 }),
    render: () => true,
  })

  for (let key = 0; key < 5; key++) {
    runInAction(() => {
      data.set(key, key * 10)
    })
  }

  expect(uploads.map(u => u.key)).toEqual([0, 1, 2, 3, 4])
})

// The other half of the same contract: N arrivals cost N encodes, not N². The
// upload count alone cannot see a helper that re-encodes every loaded region on
// each arrival and then diffs the identical payloads away.
test('N sequential region arrivals trigger N encodes, not N²', () => {
  const model = TestModel.create()
  const { backend } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  let encodes = 0

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => {
      encodes++
      return { value, marker: 0 }
    },
    render: () => true,
  })

  for (let key = 0; key < 5; key++) {
    runInAction(() => {
      data.set(key, key * 10)
    })
  }

  expect(encodes).toBe(5)
})

test('a region arrival paints once when render does not read the data map', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  let renders = 0

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => ({ value, marker: 0 }),
    render: () => {
      renders++
      return true
    },
  })

  // one render at attach, before any data
  expect(renders).toBe(1)

  for (let key = 0; key < 4; key++) {
    runInAction(() => {
      data.set(key, key * 10)
    })
  }

  expect(uploads).toHaveLength(4)
  expect(renders).toBe(5)
})

// Retires ARCHITECTURAL_LIMITS "A region arrival draws twice wherever the render
// autorun observes the data": a render callback that reads the map now paints
// once per arrival, same as one that ignores it, and the paint it keeps is the
// post-upload one. The upload happens inside the upload autorun's own run, so
// there is no longer a pass where the map has the region and the backend does
// not. `uploadOrder.test.ts` pins the ordering this count is a consequence of.
test('a region arrival paints once even when the render callback reads the data map', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  let renders = 0

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => ({ value, marker: 0 }),
    render: () => {
      renders++
      return data.size > 0
    },
  })

  expect(renders).toBe(1)

  for (let key = 0; key < 4; key++) {
    runInAction(() => {
      data.set(key, key * 10)
    })
  }

  expect(uploads).toHaveLength(4)
  expect(renders).toBe(5)
})

test('a declared-input change re-encodes and re-uploads every region', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  const markerBox = observable.box(0)

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    inputs: () => ({ marker: markerBox.get() }),
    encode: (_data, props) => ({ value: 0, marker: props.marker }),
    render: () => true,
  })

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
  expect(uploads.slice(3).map(u => u.payload.marker)).toEqual([1, 1, 1])
})

// The trap the declared inputs exist to defuse. An observable read inside
// `encode` is still tracked — it runs in the upload autorun — so it re-runs the
// diff, and the diff finds nothing changed. Before, that read re-encoded every
// loaded region: a `renderState` read here rebuilt tens of MB of byte-identical
// buffer on every frame of a height drag. Now the cost of getting it wrong is
// an empty loop.
test('an observable read inside encode re-runs the diff and encodes nothing', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  const wideBox = observable.box(0)
  let encodes = 0

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => {
      encodes++
      return { value, marker: wideBox.get() }
    },
    render: () => true,
  })

  runInAction(() => {
    data.set(0, 10)
    data.set(1, 20)
  })
  expect(encodes).toBe(2)

  runInAction(() => {
    wideBox.set(1)
  })

  expect(encodes).toBe(2)
  expect(uploads).toHaveLength(2)
})

test('only the changed key re-uploads when its value mutates', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => ({ value, marker: 0 }),
    render: () => true,
  })

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

test('removing a key forgets it and prunes from the active set', () => {
  const model = TestModel.create()
  const { backend, uploads, prunes } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => ({ value, marker: 0 }),
    render: () => true,
  })

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
  // Re-adding key 1 re-encodes it: the helper forgot the reference it was last
  // encoded from, so a same-reference re-arrival still uploads.
  runInAction(() => {
    data.set(1, 999)
  })

  expect(uploads.length).toBe(baseline + 1)
  expect(uploads[uploads.length - 1]!).toMatchObject({ key: 1 })
})

test('backend swap (context-loss recovery) re-uploads without re-encoding', () => {
  const model = TestModel.create()
  const a = makeFakeRenderingBackend()
  const b = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })
  let encodes = 0

  installPerRegionLifecycle(model, a.backend, {
    data: () => data,
    encode: value => {
      encodes++
      return { value, marker: 0 }
    },
    render: () => true,
  })

  runInAction(() => {
    data.set(0, 1)
    data.set(1, 2)
  })

  expect(a.uploads.map(u => u.key)).toEqual([0, 1])
  expect(b.uploads).toHaveLength(0)
  expect(encodes).toBe(2)

  model.attachRenderingBackend<FakeRenderingBackend>(b.backend, () => ({
    upload: () => {},
    render: () => false,
  }))

  // Only the GPU buffers were lost, so the payloads are re-uploaded as they
  // stand.
  expect(b.uploads.map(u => u.key).sort()).toEqual([0, 1])
  expect(encodes).toBe(2)
})

test('a throw in encode/upload routes to renderError instead of escaping', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeFakeRenderingBackend()
  const data = observable.map<number, number>(undefined, { deep: false })

  const err = new Error('bad region encode')
  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: () => {
      throw err
    },
    render: () => false,
  })

  runInAction(() => {
    data.set(0, 10)
  })

  // The upload autorun's throw is caught and routed to renderError (the
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

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    encode: value => ({ value, marker: 0 }),
    render: (_b, encoded) => {
      lastEncoded = encoded
      return true
    },
  })

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

  installPerRegionLifecycle(model, backend, {
    data: () => data,
    inputs: () => ready.get(),
    encode: (value, isReady) => (isReady ? { value, marker: 0 } : undefined),
    render: (_b, encoded) => {
      lastEncoded = encoded
      return true
    },
  })

  runInAction(() => {
    data.set(0, 10)
  })
  expect(uploads).toHaveLength(1)
  expect(lastEncoded?.get(0)).toEqual({ value: 10, marker: 0 })

  // Toggle ready -> false; the upload autorun re-runs but encode returns
  // undefined. The existing cached value stays, and nothing new uploads.
  const baseline = uploads.length
  runInAction(() => {
    ready.set(false)
    data.set(0, 99)
  })
  expect(uploads.length).toBe(baseline)
  expect(lastEncoded?.get(0)).toEqual({ value: 10, marker: 0 })

  // …and the skipped region encodes as soon as the input says it can, which is
  // what makes returning undefined a deferral rather than a drop.
  runInAction(() => {
    ready.set(true)
  })
  expect(lastEncoded?.get(0)).toEqual({ value: 99, marker: 0 })
})
