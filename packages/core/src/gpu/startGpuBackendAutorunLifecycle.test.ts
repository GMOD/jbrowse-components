import { observable, runInAction } from 'mobx'

import { startGpuBackendAutorunLifecycle } from './startGpuBackendAutorunLifecycle.ts'

import type { RenderBlock } from './renderBlock.ts'

interface FakeBackend {
  uploads: { regionNumber: number; data: string }[]
  prunes: number[][]
  renders: { blocks: RenderBlock[]; state: number }[]
}

function makeBackend(): FakeBackend {
  return { uploads: [], prunes: [], renders: [] }
}

function makeBlock(regionNumber: number): RenderBlock {
  return {
    regionNumber,
    bpRangeX: [0, 100],
    screenStartPx: 0,
    screenEndPx: 100,
    reversed: false,
  }
}

test('uploads every region in the data map on first run', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: (b, n, d) =>
          b.uploads.push({ regionNumber: n, data: d as string }),
        prune: (b, active) => b.prunes.push(active),
      },
    ],
    renderBlocks: () => [makeBlock(0), makeBlock(1)],
    renderState: () => 42,
    render: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  expect(backend.uploads).toEqual([
    { regionNumber: 0, data: 'a' },
    { regionNumber: 1, data: 'b' },
  ])
  expect(backend.renders.length).toBe(1)

  handle.dispose()
})

test('re-uploads every region when one entry changes (no cache)', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: (b, n, d) =>
          b.uploads.push({ regionNumber: n, data: d as string }),
        prune: () => {},
      },
    ],
    renderBlocks: () => [],
    renderState: () => 0,
    render: () => {},
  })

  // Initial: 2 uploads (one per region).
  expect(backend.uploads.length).toBe(2)

  // Mutate one entry — autorun re-fires, uploads all regions again.
  runInAction(() => {
    data.set(0, 'a2')
  })
  expect(backend.uploads.length).toBe(4)

  handle.dispose()
})

test('re-uploads when an observable read inside upload changes', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  const colorBox = observable.box('red')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        // mobx tracks colorBox.get() inside upload — when it changes, the
        // autorun re-fires and re-uploads.
        upload: (b, n, d) => {
          const color = colorBox.get()
          b.uploads.push({ regionNumber: n, data: `${d as string}:${color}` })
        },
        prune: () => {},
      },
    ],
    renderBlocks: () => [],
    renderState: () => 0,
    render: () => {},
  })

  expect(backend.uploads).toEqual([{ regionNumber: 0, data: 'a:red' }])

  runInAction(() => {
    colorBox.set('blue')
  })
  expect(backend.uploads).toEqual([
    { regionNumber: 0, data: 'a:red' },
    { regionNumber: 0, data: 'a:blue' },
  ])

  handle.dispose()
})

test('prune is called with the current active key set', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: () => {},
        prune: (b, active) => b.prunes.push([...active].sort()),
      },
    ],
    renderBlocks: () => [],
    renderState: () => 0,
    render: () => {},
  })

  runInAction(() => {
    data.delete(0)
  })

  expect(backend.prunes.at(-1)).toEqual([1])
  handle.dispose()
})

test('skips render when renderState returns undefined', () => {
  const backend = makeBackend()
  const stateHolder = observable.box<number | undefined>(undefined)

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => new Map(),
        upload: () => {},
        prune: () => {},
      },
    ],
    renderBlocks: () => [],
    renderState: () => stateHolder.get(),
    render: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  expect(backend.renders.length).toBe(0)

  runInAction(() => {
    stateHolder.set(7)
  })
  expect(backend.renders.length).toBe(1)
  expect(backend.renders[0]!.state).toBe(7)

  handle.dispose()
})

test('renderNow re-issues the last render without re-uploading', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: (b, n, d) =>
          b.uploads.push({ regionNumber: n, data: d as string }),
        prune: () => {},
      },
    ],
    renderBlocks: () => [makeBlock(0)],
    renderState: () => 99,
    render: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  const uploadsBefore = backend.uploads.length
  handle.renderNow()
  handle.renderNow()

  expect(backend.uploads.length).toBe(uploadsBefore)
  expect(backend.renders.length).toBe(3) // 1 autorun + 2 renderNow

  handle.dispose()
})

test('multiple uploads have independent autoruns', () => {
  const backend = {
    uploadsA: [] as { n: number; d: string }[],
    uploadsB: [] as { n: number; d: string }[],
  }
  const mapA = observable.map<number, string>(undefined, { deep: false })
  const mapB = observable.map<number, string>(undefined, { deep: false })
  mapA.set(0, 'a0')
  mapB.set(0, 'b0')

  const handle = startGpuBackendAutorunLifecycle<typeof backend, number>({
    backend,
    uploads: [
      {
        getData: () => mapA,
        upload: (b, n, d) => b.uploadsA.push({ n, d: d as string }),
      },
      {
        getData: () => mapB,
        upload: (b, n, d) => b.uploadsB.push({ n, d: d as string }),
      },
    ],
    renderBlocks: () => [],
    renderState: () => 1,
    render: () => {},
  })

  expect(backend.uploadsA).toEqual([{ n: 0, d: 'a0' }])
  expect(backend.uploadsB).toEqual([{ n: 0, d: 'b0' }])

  // Change only upload B — only upload B's autorun re-fires.
  runInAction(() => {
    mapB.set(0, 'b1')
  })
  expect(backend.uploadsA.length).toBe(1)
  expect(backend.uploadsB).toEqual([
    { n: 0, d: 'b0' },
    { n: 0, d: 'b1' },
  ])

  handle.dispose()
})

test('render autorun re-fires on state change without re-running uploads', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  const stateBox = observable.box(1)
  let uploadCalls = 0

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: (b, n, d) => {
          uploadCalls++
          b.uploads.push({ regionNumber: n, data: d as string })
        },
        prune: () => {},
      },
    ],
    renderBlocks: () => [makeBlock(0)],
    renderState: () => stateBox.get(),
    render: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  expect(uploadCalls).toBe(1)
  expect(backend.renders.length).toBe(1)

  // Change only render state — render re-fires, upload does not.
  runInAction(() => {
    stateBox.set(2)
  })
  expect(uploadCalls).toBe(1)
  expect(backend.renders.length).toBe(2)
  expect(backend.renders.at(-1)!.state).toBe(2)

  handle.dispose()
})

test('deleteOne fires for each cached key removed from dataMap', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')
  const deleted: number[] = []

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: (b, n, d) =>
          b.uploads.push({ regionNumber: n, data: d as string }),
        deleteOne: (_b, n) => deleted.push(n),
      },
    ],
    renderBlocks: () => [],
    renderState: () => 1,
    render: () => {},
  })

  expect(deleted).toEqual([])

  runInAction(() => {
    data.delete(0)
  })
  expect(deleted).toEqual([0])

  runInAction(() => {
    data.delete(1)
  })
  expect(deleted).toEqual([0, 1])

  handle.dispose()
})

test('dispose stops the autorun and renderNow becomes a no-op', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, number>({
    backend,
    uploads: [
      {
        getData: () => data,
        upload: (b, n, d) =>
          b.uploads.push({ regionNumber: n, data: d as string }),
        prune: () => {},
      },
    ],
    renderBlocks: () => [],
    renderState: () => 1,
    render: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  const renderCountAtDispose = backend.renders.length
  handle.dispose()

  runInAction(() => {
    data.set(0, 'a')
  })
  handle.renderNow()

  expect(backend.uploads.length).toBe(0)
  expect(backend.renders.length).toBe(renderCountAtDispose)
})
