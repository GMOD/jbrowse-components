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

test('uploads each region exactly once when data reference is stable', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [makeBlock(0)],
    getRenderState: () => 42,
    uploadOneRegion: (b, n, d) => b.uploads.push({ regionNumber: n, data: d }),
    pruneRegionsNotIn: (b, active) => b.prunes.push(active),
    renderAllBlocks: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  expect(backend.uploads).toEqual([{ regionNumber: 0, data: 'a' }])
  expect(backend.renders.length).toBe(1)

  // Force a re-run with the same data reference: no new upload.
  runInAction(() => {
    data.set(1, 'b')
  })
  expect(backend.uploads).toEqual([
    { regionNumber: 0, data: 'a' },
    { regionNumber: 1, data: 'b' },
  ])
  expect(backend.renders.length).toBe(2)

  handle.dispose()
})

test('re-uploads a region when its data reference changes', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [],
    getRenderState: () => 0,
    uploadOneRegion: (b, n, d) => b.uploads.push({ regionNumber: n, data: d }),
    pruneRegionsNotIn: (b, active) => b.prunes.push(active),
    renderAllBlocks: () => {},
  })

  runInAction(() => {
    data.set(0, 'a2')
  })

  expect(backend.uploads).toEqual([
    { regionNumber: 0, data: 'a' },
    { regionNumber: 0, data: 'a2' },
  ])

  handle.dispose()
})

test('prunes regions that are no longer active', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [],
    getRenderState: () => 0,
    uploadOneRegion: () => {},
    pruneRegionsNotIn: (b, active) => b.prunes.push([...active].sort()),
    renderAllBlocks: () => {},
  })

  runInAction(() => {
    data.delete(0)
  })

  expect(backend.prunes.at(-1)).toEqual([1])
  handle.dispose()
})

test('skips render when getRenderState returns undefined', () => {
  const backend = makeBackend()
  const stateHolder = observable.box<number | undefined>(undefined)

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(),
    getRenderBlocks: () => [],
    getRenderState: () => stateHolder.get(),
    uploadOneRegion: () => {},
    pruneRegionsNotIn: () => {},
    renderAllBlocks: (b, blocks, state) => b.renders.push({ blocks, state }),
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

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [makeBlock(0)],
    getRenderState: () => 99,
    uploadOneRegion: (b, n, d) => b.uploads.push({ regionNumber: n, data: d }),
    pruneRegionsNotIn: () => {},
    renderAllBlocks: (b, blocks, state) => b.renders.push({ blocks, state }),
  })

  const uploadsBefore = backend.uploads.length
  handle.renderNow()
  handle.renderNow()

  expect(backend.uploads.length).toBe(uploadsBefore)
  expect(backend.renders.length).toBe(3) // 1 autorun + 2 renderNow

  handle.dispose()
})

test('upload invalidation token clears the cache and forces re-upload', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')
  const tokenBox = observable.box(0)

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [],
    getRenderState: () => 0,
    uploadOneRegion: (b, n, d) => b.uploads.push({ regionNumber: n, data: d }),
    pruneRegionsNotIn: () => {},
    renderAllBlocks: () => {},
    getUploadInvalidationToken: () => tokenBox.get(),
  })

  expect(backend.uploads.length).toBe(2)

  // Bump token without changing data — all regions should re-upload.
  runInAction(() => {
    tokenBox.set(1)
  })
  expect(backend.uploads.length).toBe(4)

  handle.dispose()
})

test('multiple uploadStreams are identity-diffed independently', () => {
  const backend = {
    uploadsA: [] as { n: number; d: string }[],
    uploadsB: [] as { n: number; d: string }[],
    prunes: [] as number[][],
  }
  const mapA = observable.map<number, string>(undefined, { deep: false })
  const mapB = observable.map<number, string>(undefined, { deep: false })
  mapA.set(0, 'a0')
  mapB.set(0, 'b0')

  const handle = startGpuBackendAutorunLifecycle<
    typeof backend,
    string,
    number
  >({
    backend,
    uploadStreams: [
      {
        getDataByRegionNumber: () => new Map(mapA),
        uploadOneRegion: (b, n, d) => b.uploadsA.push({ n, d }),
        pruneRegionsNotIn: (b, active) => b.prunes.push([...active]),
      },
      {
        getDataByRegionNumber: () => new Map(mapB),
        uploadOneRegion: (b, n, d) => b.uploadsB.push({ n, d }),
      },
    ],
    getRenderBlocks: () => [],
    getRenderState: () => 1,
    renderAllBlocks: () => {},
  })

  expect(backend.uploadsA).toEqual([{ n: 0, d: 'a0' }])
  expect(backend.uploadsB).toEqual([{ n: 0, d: 'b0' }])

  // Change only stream B — stream A should not re-upload.
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

test('identityOf lets non-reference keys drive the identity diff', () => {
  const backend = makeBackend()
  const data = observable.box<Record<number, { inputKey: string }>>({
    0: { inputKey: 'v1' },
  })

  const handle = startGpuBackendAutorunLifecycle<
    FakeBackend,
    { inputKey: string },
    number
  >({
    backend,
    getDataByRegionNumber: () => {
      const obj = data.get()
      const map = new Map<number, { inputKey: string }>()
      for (const [k, v] of Object.entries(obj)) {
        map.set(Number(k), v)
      }
      return map
    },
    identityOf: d => d.inputKey,
    uploadOneRegion: (b, n, d) =>
      b.uploads.push({ regionNumber: n, data: d.inputKey }),
    pruneRegionsNotIn: () => {},
    getRenderBlocks: () => [],
    getRenderState: () => 0,
    renderAllBlocks: () => {},
  })

  expect(backend.uploads).toEqual([{ regionNumber: 0, data: 'v1' }])

  // Replace the wrapper object but keep the same inputKey — no re-upload.
  runInAction(() => {
    data.set({ 0: { inputKey: 'v1' } })
  })
  expect(backend.uploads.length).toBe(1)

  // Change the inputKey — re-upload.
  runInAction(() => {
    data.set({ 0: { inputKey: 'v2' } })
  })
  expect(backend.uploads).toEqual([
    { regionNumber: 0, data: 'v1' },
    { regionNumber: 0, data: 'v2' },
  ])

  handle.dispose()
})

test('render autorun re-fires on state change without re-running uploads', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  const stateBox = observable.box(1)
  let uploadCalls = 0

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    uploadOneRegion: (b, n, d) => {
      uploadCalls++
      b.uploads.push({ regionNumber: n, data: d })
    },
    pruneRegionsNotIn: () => {},
    getRenderBlocks: () => [makeBlock(0)],
    getRenderState: () => stateBox.get(),
    renderAllBlocks: (b, blocks, state) => b.renders.push({ blocks, state }),
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

test('deleteOneRegion fires for each cached key removed from dataMap', () => {
  const backend = makeBackend()
  const data = observable.map<number, string>(undefined, { deep: false })
  data.set(0, 'a')
  data.set(1, 'b')
  const deleted: number[] = []

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [],
    getRenderState: () => 1,
    uploadOneRegion: (b, n, d) => b.uploads.push({ regionNumber: n, data: d }),
    deleteOneRegion: (_b, n) => deleted.push(n),
    renderAllBlocks: () => {},
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

  const handle = startGpuBackendAutorunLifecycle<FakeBackend, string, number>({
    backend,
    getDataByRegionNumber: () => new Map(data),
    getRenderBlocks: () => [],
    getRenderState: () => 1,
    uploadOneRegion: (b, n, d) => b.uploads.push({ regionNumber: n, data: d }),
    pruneRegionsNotIn: () => {},
    renderAllBlocks: (b, blocks, state) => b.renders.push({ blocks, state }),
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
