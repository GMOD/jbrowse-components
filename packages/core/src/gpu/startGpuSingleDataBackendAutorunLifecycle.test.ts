import { observable, runInAction } from 'mobx'

import { startGpuSingleDataBackendAutorunLifecycle } from './startGpuSingleDataBackendAutorunLifecycle.ts'

interface FakeBackend {
  uploads: number[]
  renders: number[]
}

test('uploads once and renders when data and state arrive', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number } | undefined>(undefined)
  const stateBox = observable.box<number | undefined>(undefined)

  const handle = startGpuSingleDataBackendAutorunLifecycle<
    FakeBackend,
    { v: number },
    number
  >({
    backend,
    getGlobalData: () => dataBox.get(),
    getRenderState: () => stateBox.get(),
    uploadGlobalData: (b, d) => b.uploads.push(d.v),
    renderWithState: (b, s) => b.renders.push(s),
  })

  expect(backend.uploads).toEqual([])
  expect(backend.renders).toEqual([])

  runInAction(() => {
    dataBox.set({ v: 1 })
  })
  expect(backend.uploads).toEqual([1])
  expect(backend.renders).toEqual([]) // no state yet

  runInAction(() => {
    stateBox.set(42)
  })
  expect(backend.renders).toEqual([42])

  handle.dispose()
})

test('does not re-upload when data reference is stable but state changes', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const data = { v: 1 }
  const stateBox = observable.box(0)

  const handle = startGpuSingleDataBackendAutorunLifecycle<
    FakeBackend,
    { v: number },
    number
  >({
    backend,
    getGlobalData: () => data,
    getRenderState: () => stateBox.get(),
    uploadGlobalData: (b, d) => b.uploads.push(d.v),
    renderWithState: (b, s) => b.renders.push(s),
  })

  runInAction(() => {
    stateBox.set(1)
  })
  runInAction(() => {
    stateBox.set(2)
  })

  expect(backend.uploads).toEqual([1])
  expect(backend.renders).toEqual([0, 1, 2])

  handle.dispose()
})

test('re-uploads when data reference changes', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number }>({ v: 1 })

  const handle = startGpuSingleDataBackendAutorunLifecycle<
    FakeBackend,
    { v: number },
    number
  >({
    backend,
    getGlobalData: () => dataBox.get(),
    getRenderState: () => 0,
    uploadGlobalData: (b, d) => b.uploads.push(d.v),
    renderWithState: () => {},
  })

  runInAction(() => {
    dataBox.set({ v: 2 })
  })
  runInAction(() => {
    dataBox.set({ v: 3 })
  })

  expect(backend.uploads).toEqual([1, 2, 3])

  handle.dispose()
})

test('renderNow re-issues render without re-upload, only when data exists', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number } | undefined>(undefined)

  const handle = startGpuSingleDataBackendAutorunLifecycle<
    FakeBackend,
    { v: number },
    number
  >({
    backend,
    getGlobalData: () => dataBox.get(),
    getRenderState: () => 99,
    uploadGlobalData: (b, d) => b.uploads.push(d.v),
    renderWithState: (b, s) => b.renders.push(s),
  })

  handle.renderNow() // no data yet
  expect(backend.renders).toEqual([])

  runInAction(() => {
    dataBox.set({ v: 1 })
  })
  const rendersBefore = backend.renders.length
  handle.renderNow()
  expect(backend.renders.length).toBe(rendersBefore + 1)

  handle.dispose()
})

test('dispose stops the autorun', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number } | undefined>(undefined)

  const handle = startGpuSingleDataBackendAutorunLifecycle<
    FakeBackend,
    { v: number },
    number
  >({
    backend,
    getGlobalData: () => dataBox.get(),
    getRenderState: () => 0,
    uploadGlobalData: (b, d) => b.uploads.push(d.v),
    renderWithState: (b, s) => b.renders.push(s),
  })

  handle.dispose()
  runInAction(() => {
    dataBox.set({ v: 1 })
  })
  expect(backend.uploads).toEqual([])
})
