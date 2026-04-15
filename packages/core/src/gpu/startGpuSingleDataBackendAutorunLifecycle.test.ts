import { observable, runInAction } from 'mobx'

import { startGpuSingleDataBackendAutorunLifecycle } from './startGpuSingleDataBackendAutorunLifecycle.ts'

interface FakeBackend {
  uploads: { slot: string; v: number }[]
  renders: number[]
}

test('single-slot: uploads once and renders when data and state arrive', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number } | undefined>(undefined)
  const stateBox = observable.box<number | undefined>(undefined)

  const handle = startGpuSingleDataBackendAutorunLifecycle<FakeBackend, number>(
    {
      backend,
      uploadSlots: [
        {
          readData: () => dataBox.get(),
          commitUpload: (b, d) => {
            b.uploads.push({ slot: 'main', v: (d as { v: number }).v })
          },
        },
      ],
      getRenderState: () => stateBox.get(),
      renderWithState: (b, s) => b.renders.push(s),
    },
  )

  expect(backend.uploads).toEqual([])
  expect(backend.renders).toEqual([])

  runInAction(() => {
    dataBox.set({ v: 1 })
  })
  expect(backend.uploads).toEqual([{ slot: 'main', v: 1 }])
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

  const handle = startGpuSingleDataBackendAutorunLifecycle<FakeBackend, number>(
    {
      backend,
      uploadSlots: [
        {
          readData: () => data,
          commitUpload: (b, d) =>
            b.uploads.push({ slot: 'main', v: (d as { v: number }).v }),
        },
      ],
      getRenderState: () => stateBox.get(),
      renderWithState: (b, s) => b.renders.push(s),
    },
  )

  runInAction(() => {
    stateBox.set(1)
  })
  runInAction(() => {
    stateBox.set(2)
  })

  expect(backend.uploads).toEqual([{ slot: 'main', v: 1 }])
  expect(backend.renders).toEqual([0, 1, 2])

  handle.dispose()
})

test('multi-slot: each slot is identity-diffed independently', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number }>({ v: 1 })
  const rampBox = observable.box<{ c: string }>({ c: 'red' })

  const handle = startGpuSingleDataBackendAutorunLifecycle<FakeBackend, number>(
    {
      backend,
      uploadSlots: [
        {
          readData: () => dataBox.get(),
          commitUpload: (b, d) =>
            b.uploads.push({ slot: 'data', v: (d as { v: number }).v }),
        },
        {
          readData: () => rampBox.get(),
          commitUpload: b =>
            b.uploads.push({ slot: 'ramp', v: 0 }),
        },
      ],
      getRenderState: () => 0,
      renderWithState: (b, s) => b.renders.push(s),
    },
  )

  // Both uploaded initially.
  expect(backend.uploads).toEqual([
    { slot: 'data', v: 1 },
    { slot: 'ramp', v: 0 },
  ])

  // Change only the data — ramp should NOT re-upload.
  runInAction(() => {
    dataBox.set({ v: 2 })
  })
  expect(backend.uploads).toEqual([
    { slot: 'data', v: 1 },
    { slot: 'ramp', v: 0 },
    { slot: 'data', v: 2 },
  ])

  // Change only the ramp — data should NOT re-upload.
  runInAction(() => {
    rampBox.set({ c: 'blue' })
  })
  expect(backend.uploads).toEqual([
    { slot: 'data', v: 1 },
    { slot: 'ramp', v: 0 },
    { slot: 'data', v: 2 },
    { slot: 'ramp', v: 0 },
  ])

  handle.dispose()
})

test('skips render until every slot has data', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number } | undefined>({ v: 1 })
  const rampBox = observable.box<{ c: string } | undefined>(undefined)

  const handle = startGpuSingleDataBackendAutorunLifecycle<FakeBackend, number>(
    {
      backend,
      uploadSlots: [
        { readData: () => dataBox.get(), commitUpload: () => {} },
        { readData: () => rampBox.get(), commitUpload: () => {} },
      ],
      getRenderState: () => 42,
      renderWithState: (b, s) => b.renders.push(s),
    },
  )

  expect(backend.renders).toEqual([]) // ramp missing

  runInAction(() => {
    rampBox.set({ c: 'red' })
  })
  expect(backend.renders).toEqual([42])

  handle.dispose()
})

test('renderNow re-issues render without re-upload, only when all slots have data', () => {
  const backend: FakeBackend = { uploads: [], renders: [] }
  const dataBox = observable.box<{ v: number } | undefined>(undefined)

  const handle = startGpuSingleDataBackendAutorunLifecycle<FakeBackend, number>(
    {
      backend,
      uploadSlots: [
        { readData: () => dataBox.get(), commitUpload: () => {} },
      ],
      getRenderState: () => 99,
      renderWithState: (b, s) => b.renders.push(s),
    },
  )

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

  const handle = startGpuSingleDataBackendAutorunLifecycle<FakeBackend, number>(
    {
      backend,
      uploadSlots: [
        {
          readData: () => dataBox.get(),
          commitUpload: (b, d) =>
            b.uploads.push({ slot: 'main', v: (d as { v: number }).v }),
        },
      ],
      getRenderState: () => 0,
      renderWithState: () => {},
    },
  )

  handle.dispose()
  runInAction(() => {
    dataBox.set({ v: 1 })
  })
  expect(backend.uploads).toEqual([])
})
