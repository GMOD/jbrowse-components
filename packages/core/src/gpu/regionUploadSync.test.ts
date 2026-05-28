import { createRegionUploadSync } from './regionUploadSync.ts'

interface Data {
  v: number
}

function makeBackend() {
  const uploads: { idx: number; data: Data }[] = []
  const prunes: number[][] = []
  return {
    uploads,
    prunes,
    uploadRegion(idx: number, data: Data) {
      uploads.push({ idx, data })
    },
    pruneRegions(active: Iterable<number>) {
      prunes.push([...active].sort((a, b) => a - b))
    },
  }
}

test('first sync uploads every region and prunes to the active set', () => {
  const sync = createRegionUploadSync<Data, ReturnType<typeof makeBackend>>()
  const b = makeBackend()
  const a = { v: 1 }
  const c = { v: 2 }
  sync(
    b,
    new Map([
      [0, a],
      [1, c],
    ]),
  )
  expect(b.uploads.map(u => u.idx)).toEqual([0, 1])
  expect(b.prunes).toEqual([[0, 1]])
})

test('unchanged references are not re-uploaded when a new region arrives', () => {
  const sync = createRegionUploadSync<Data, ReturnType<typeof makeBackend>>()
  const b = makeBackend()
  const a = { v: 1 }
  sync(b, new Map([[0, a]]))
  expect(b.uploads).toHaveLength(1)

  // Region 0 keeps the same reference; region 1 is new.
  const c = { v: 2 }
  sync(
    b,
    new Map([
      [0, a],
      [1, c],
    ]),
  )
  // Only region 1 re-uploaded.
  expect(b.uploads).toHaveLength(2)
  expect(b.uploads[1]).toEqual({ idx: 1, data: c })
  expect(b.prunes[b.prunes.length - 1]).toEqual([0, 1])
})

test('a changed reference for an existing region re-uploads it', () => {
  const sync = createRegionUploadSync<Data, ReturnType<typeof makeBackend>>()
  const b = makeBackend()
  sync(b, new Map([[0, { v: 1 }]]))
  sync(b, new Map([[0, { v: 1 }]])) // same value, new object reference
  expect(b.uploads).toHaveLength(2)
})

test('a removed region is pruned and forgotten so a same-reference re-arrival re-uploads', () => {
  const sync = createRegionUploadSync<Data, ReturnType<typeof makeBackend>>()
  const b = makeBackend()
  const a = { v: 1 }
  sync(b, new Map([[0, a]]))
  sync(b, new Map()) // region 0 disappears
  expect(b.prunes[b.prunes.length - 1]).toEqual([])

  // Same object reference returns — must re-upload because the GPU buffer was
  // pruned when it disappeared.
  sync(b, new Map([[0, a]]))
  expect(b.uploads).toHaveLength(2)
  expect(b.uploads[1]).toEqual({ idx: 0, data: a })
})

test('emptying the map then refilling re-uploads everything (regionTooLarge toggle)', () => {
  const sync = createRegionUploadSync<Data, ReturnType<typeof makeBackend>>()
  const b = makeBackend()
  const a = { v: 1 }
  const c = { v: 2 }
  const full = new Map([
    [0, a],
    [1, c],
  ])
  sync(b, full)
  sync(b, new Map()) // banner on: laidOutDataMap goes empty -> prune all
  expect(b.prunes[b.prunes.length - 1]).toEqual([])
  sync(b, full) // banner off: same references return
  // All four uploads: 2 initial + 2 after refill.
  expect(b.uploads.map(u => u.idx)).toEqual([0, 1, 0, 1])
})

test('a backend swap re-uploads everything even when references are unchanged', () => {
  const sync = createRegionUploadSync<Data, ReturnType<typeof makeBackend>>()
  const a = makeBackend()
  const x = { v: 1 }
  const y = { v: 2 }
  const map = new Map([
    [0, x],
    [1, y],
  ])
  sync(a, map)
  expect(a.uploads).toHaveLength(2)

  // Context-loss recovery: a fresh backend with empty GPU buffers, same data.
  const b = makeBackend()
  sync(b, map)
  expect(b.uploads.map(u => u.idx)).toEqual([0, 1])
})
