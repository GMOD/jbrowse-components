import { types } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { installUpload } from './installUpload.ts'

const TestModel = types
  .compose('TestModel', RenderLifecycleMixin(), types.model({}))
  .volatile(() => ({}))

interface Cell {
  value: number
}

interface Encoded {
  value: number
  marker: number
}

function makeBackend<T>() {
  const uploads: { key: number; payload: T }[] = []
  const releases: number[] = []
  const backend = {
    upload(key: number, payload: T) {
      uploads.push({ key, payload })
    },
    release(key: number) {
      releases.push(key)
    },
  }
  return { backend, uploads, releases }
}

function cellMap<T>() {
  return observable.map<number, T>(undefined, { deep: false })
}

beforeEach(() => {
  console.error = jest.fn()
})

test('N arrivals cost N uploads and N encodes, not N²', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeBackend<Encoded>()
  const cells = cellMap<Cell>()
  let encodes = 0
  installUpload(model, backend, {
    cells: () => cells,
    encode: ({ value }) => {
      encodes++
      return { value, marker: 0 }
    },
    render: () => true,
  })
  for (let i = 0; i < 5; i++) {
    runInAction(() => {
      cells.set(i, { value: i })
    })
  }
  expect(uploads.map(u => u.key)).toEqual([0, 1, 2, 3, 4])
  expect(encodes).toBe(5)
})

test('an inputs change re-encodes and re-uploads every cell; a stray read does not', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeBackend<Encoded>()
  const cells = cellMap<Cell>()
  const marker = observable.box(0)
  const stray = observable.box(0)
  let encodes = 0
  installUpload(model, backend, {
    cells: () => cells,
    inputs: () => ({ marker: marker.get() }),
    encode: ({ value }, { marker }) => {
      encodes++
      void stray.get()
      return { value, marker }
    },
    render: () => true,
  })
  runInAction(() => {
    cells.set(0, { value: 1 })
    cells.set(1, { value: 2 })
  })
  expect(encodes).toBe(2)
  runInAction(() => {
    stray.set(1)
  })
  expect(encodes).toBe(2)
  expect(uploads).toHaveLength(2)
  runInAction(() => {
    marker.set(7)
  })
  expect(encodes).toBe(4)
  expect(uploads).toHaveLength(4)
  expect(uploads[3]!.payload.marker).toBe(7)
})

test('a departed key is released by itself and forgotten', () => {
  const model = TestModel.create()
  const { backend, uploads, releases } = makeBackend<Cell>()
  const cells = cellMap<Cell>()
  installUpload(model, backend, {
    cells: () => cells,
    render: () => true,
  })
  const a = { value: 1 }
  runInAction(() => {
    cells.set(0, a)
    cells.set(1, { value: 2 })
  })
  runInAction(() => {
    cells.delete(0)
  })
  expect(releases).toEqual([0])
  runInAction(() => {
    cells.set(0, a)
  })
  expect(uploads.filter(u => u.key === 0)).toHaveLength(2)
})

test('a backend swap re-uploads every cell without re-encoding', () => {
  const model = TestModel.create()
  const first = makeBackend<Encoded>()
  const second = makeBackend<Encoded>()
  const cells = cellMap<Cell>()
  let encodes = 0
  installUpload(model, first.backend, {
    cells: () => cells,
    encode: ({ value }) => {
      encodes++
      return { value, marker: 0 }
    },
    render: () => true,
  })
  runInAction(() => {
    cells.set(0, { value: 1 })
    cells.set(1, { value: 2 })
  })
  expect(encodes).toBe(2)
  model.attachRenderingBackend(second.backend, () => ({
    upload: () => true,
    render: () => false,
  }))
  expect(second.uploads.map(u => u.key).sort()).toEqual([0, 1])
  expect(encodes).toBe(2)
})

test('render is handed the encoded map, and the identity path hands it the cells', () => {
  const model = TestModel.create()
  const encoding = makeBackend<Encoded>()
  const cells = cellMap<Cell>()
  let seen: ReadonlyMap<number, Encoded> | undefined
  installUpload(model, encoding.backend, {
    cells: () => cells,
    encode: ({ value }) => ({ value, marker: 9 }),
    render: (_b, encoded) => {
      seen = encoded
      return encoded.size > 0
    },
  })
  runInAction(() => {
    cells.set(3, { value: 1 })
  })
  expect(seen?.get(3)).toEqual({ value: 1, marker: 9 })

  const identityModel = TestModel.create()
  const identity = makeBackend<Cell>()
  const own = cellMap<Cell>()
  let handed: ReadonlyMap<number, Cell> | undefined
  installUpload(identityModel, identity.backend, {
    cells: () => own,
    render: (_b, encoded) => {
      handed = encoded
      return true
    },
  })
  runInAction(() => {
    own.set(0, { value: 5 })
  })
  expect(handed).toBe(own)
})

test('a throw in encode routes to renderError', () => {
  const model = TestModel.create()
  const { backend, uploads } = makeBackend<Encoded>()
  const cells = cellMap<Cell>()
  const err = new Error('bad encode')
  installUpload(model, backend, {
    cells: () => cells,
    encode: () => {
      throw err
    },
    render: () => false,
  })
  runInAction(() => {
    cells.set(0, { value: 1 })
  })
  expect(model.renderError).toBe(err)
  expect(uploads).toHaveLength(0)
})

test('a non-payload cell is reported once, in development', () => {
  const model = TestModel.create()
  const { backend } = makeBackend<Cell>()
  const cells = observable.map<number, Cell | undefined>(undefined, {
    deep: false,
  })
  installUpload(model, backend, {
    cells: () => cells as ReadonlyMap<number, Cell>,
    render: () => true,
  })
  runInAction(() => {
    cells.set(0, undefined)
  })
  runInAction(() => {
    cells.set(1, { value: 1 })
  })
  expect(console.error).toHaveBeenCalledTimes(1)
})

// Typecheck-only: an unused `@ts-expect-error` fails `pnpm typecheck`.
function aBackendTakingMoreThanTheDisplayHolds() {
  const backend = {
    upload(_key: number, _payload: Encoded) {},
    release(_key: number) {},
  }
  const cells = new Map<number, Cell>()
  // @ts-expect-error the backend reads `marker` off payloads carrying none
  installUpload(TestModel.create(), backend, {
    cells: () => cells,
    render: () => true,
  })
  return cells.size
}

function anEncodeNarrowerThanTheBackend() {
  const backend = {
    upload(_key: number, _payload: Encoded) {},
    release(_key: number) {},
  }
  const cells = new Map<number, Cell>()
  installUpload(TestModel.create(), backend, {
    cells: () => cells,
    // @ts-expect-error encode returns no `marker`
    encode: ({ value }) => ({ value }),
    render: () => true,
  })
  return cells.size
}

test('the payload the backend takes is checked in both shapes', () => {
  expect(aBackendTakingMoreThanTheDisplayHolds()).toBe(0)
  expect(anEncodeNarrowerThanTheBackend()).toBe(0)
})
