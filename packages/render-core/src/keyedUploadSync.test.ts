import { sharedBackendKey } from './installKeyedLifecycle.ts'
import { createKeyedUploadSync } from './keyedUploadSync.ts'

interface Data {
  v: number
}

function makeRenderingBackend() {
  const uploads: { key: number; data: Data }[] = []
  const deletes: number[] = []
  return {
    uploads,
    deletes,
    uploadGeometry(key: number, data: Data) {
      uploads.push({ key, data })
    },
    deleteGeometry(key: number) {
      deletes.push(key)
    },
  }
}

type Backend = ReturnType<typeof makeRenderingBackend>

test('first sync uploads every key', () => {
  const sync = createKeyedUploadSync<Data, Backend>()
  const b = makeRenderingBackend()
  sync(
    b,
    new Map([
      [0, { v: 1 }],
      [1, { v: 2 }],
    ]),
  )
  expect(b.uploads.map(u => u.key)).toEqual([0, 1])
  expect(b.deletes).toEqual([])
})

test("one display's new geometry does not re-upload its siblings", () => {
  const sync = createKeyedUploadSync<Data, Backend>()
  const b = makeRenderingBackend()
  const stable = { v: 1 }
  sync(
    b,
    new Map([
      [0, stable],
      [1, { v: 2 }],
    ]),
  )
  expect(b.uploads).toHaveLength(2)

  // display 1 commits fresh geometry; display 0's reference is unchanged
  const fresh = { v: 3 }
  sync(
    b,
    new Map([
      [0, stable],
      [1, fresh],
    ]),
  )
  expect(b.uploads).toHaveLength(3)
  expect(b.uploads[2]).toEqual({ key: 1, data: fresh })
})

test('a departed key is deleted individually, leaving siblings alone', () => {
  const sync = createKeyedUploadSync<Data, Backend>()
  const b = makeRenderingBackend()
  const stable = { v: 1 }
  const gone = { v: 2 }
  sync(
    b,
    new Map([
      [0, stable],
      [1, gone],
    ]),
  )
  sync(b, new Map([[0, stable]]))
  expect(b.deletes).toEqual([1])
  // sibling 0 was neither re-uploaded nor deleted
  expect(b.uploads).toHaveLength(2)
})

test('a departed key is forgotten, so a same-reference re-arrival re-uploads', () => {
  const sync = createKeyedUploadSync<Data, Backend>()
  const b = makeRenderingBackend()
  const a = { v: 1 }
  sync(b, new Map([[0, a]]))
  sync(b, new Map())
  expect(b.deletes).toEqual([0])
  sync(b, new Map([[0, a]]))
  expect(b.uploads).toHaveLength(2)
})

test('a backend swap re-uploads every key even when references are unchanged', () => {
  const sync = createKeyedUploadSync<Data, Backend>()
  const a = makeRenderingBackend()
  const map = new Map([
    [0, { v: 1 }],
    [1, { v: 2 }],
  ])
  sync(a, map)
  expect(a.uploads).toHaveLength(2)

  // context-loss recovery: fresh backend, empty GPU buffers, same data
  const b = makeRenderingBackend()
  sync(b, map)
  expect(b.uploads.map(u => u.key)).toEqual([0, 1])
  // and no spurious deletes fired against the fresh backend
  expect(b.deletes).toEqual([])
})

test('sharedBackendKey is stable per id and distinct across ids', () => {
  expect(sharedBackendKey('display-1')).toBe(sharedBackendKey('display-1'))
  expect(sharedBackendKey('display-1')).not.toBe(sharedBackendKey('display-2'))
})

test('sharedBackendKey stays a uint32', () => {
  for (const id of ['a', 'display-1', 'x'.repeat(200), '']) {
    const key = sharedBackendKey(id)
    expect(Number.isInteger(key)).toBe(true)
    expect(key).toBeGreaterThanOrEqual(0)
    expect(key).toBeLessThanOrEqual(0xffffffff)
  }
})
