import { RegionRegistry } from './regionRegistry.ts'

interface FakeBuf {
  id: number
  destroyed: boolean
}

function makeBuf(id: number): FakeBuf {
  return { id, destroyed: false }
}

function makeRegistry() {
  const destroyed: number[] = []
  const reg = new RegionRegistry<FakeBuf>(buf => {
    buf.destroyed = true
    destroyed.push(buf.id)
  })
  return { reg, destroyed }
}

test('set + get round-trip', () => {
  const { reg } = makeRegistry()
  const b = makeBuf(1)
  reg.set(0, 'pass', b)
  expect(reg.get(0, 'pass')).toBe(b)
  expect(reg.get(0, 'other')).toBeUndefined()
  expect(reg.get(1, 'pass')).toBeUndefined()
})

test('deleteBuffer destroys and removes a single entry', () => {
  const { reg, destroyed } = makeRegistry()
  const a = makeBuf(1)
  const b = makeBuf(2)
  reg.set(0, 'pass1', a)
  reg.set(0, 'pass2', b)

  reg.deleteBuffer(0, 'pass1')

  expect(a.destroyed).toBe(true)
  expect(b.destroyed).toBe(false)
  expect(destroyed).toEqual([1])
  expect(reg.get(0, 'pass1')).toBeUndefined()
  expect(reg.get(0, 'pass2')).toBe(b)
})

test('deleteBuffer is a no-op on missing keys', () => {
  const { reg, destroyed } = makeRegistry()
  // Both branches: missing region, and missing pass within an existing region.
  reg.deleteBuffer(99, 'nope')
  reg.set(0, 'pass', makeBuf(1))
  reg.deleteBuffer(0, 'other')
  expect(destroyed).toEqual([])
})

test('deleteRegion destroys every buffer in the region and removes it', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'a', makeBuf(1))
  reg.set(0, 'b', makeBuf(2))
  reg.set(1, 'a', makeBuf(3))

  reg.deleteRegion(0)

  expect(destroyed.sort()).toEqual([1, 2])
  expect(reg.get(0, 'a')).toBeUndefined()
  expect(reg.get(0, 'b')).toBeUndefined()
  expect(reg.get(1, 'a')?.id).toBe(3)
})

test('deleteAll destroys everything and clears the registry', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'a', makeBuf(1))
  reg.set(1, 'b', makeBuf(2))
  reg.set(2, 'c', makeBuf(3))

  reg.deleteAll()

  expect(destroyed.sort()).toEqual([1, 2, 3])
  // After deleteAll, set on a previously-deleted region must still work.
  reg.set(0, 'x', makeBuf(99))
  expect(reg.get(0, 'x')?.id).toBe(99)
})

test('prune deletes regions absent from the active set', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'a', makeBuf(1))
  reg.set(1, 'a', makeBuf(2))
  reg.set(2, 'a', makeBuf(3))

  reg.prune([0, 2])

  expect(destroyed).toEqual([2])
  expect(reg.get(0, 'a')?.id).toBe(1)
  expect(reg.get(1, 'a')).toBeUndefined()
  expect(reg.get(2, 'a')?.id).toBe(3)
})

test('prune with empty active set deletes everything', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'a', makeBuf(1))
  reg.set(1, 'b', makeBuf(2))

  reg.prune([])

  expect(destroyed.sort()).toEqual([1, 2])
})

test('forEachInPass visits only matching passId entries', () => {
  const { reg } = makeRegistry()
  reg.set(0, 'foo', makeBuf(10))
  reg.set(0, 'bar', makeBuf(11))
  reg.set(1, 'foo', makeBuf(20))
  reg.set(2, 'baz', makeBuf(30))

  const seen: { regionKey: number; id: number }[] = []
  reg.forEachInPass('foo', (buf, regionKey) => {
    seen.push({ regionKey, id: buf.id })
  })

  expect(seen.sort((a, b) => a.regionKey - b.regionKey)).toEqual([
    { regionKey: 0, id: 10 },
    { regionKey: 1, id: 20 },
  ])
})

test('replacing a buffer requires explicit deleteBuffer first (set does not destroy)', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'a', makeBuf(1))
  // set without prior delete overwrites the map entry but doesn't call destroy.
  reg.set(0, 'a', makeBuf(2))
  expect(destroyed).toEqual([])
  // The replace + delete pattern used by uploadBuffer:
  reg.deleteBuffer(0, 'a')
  expect(destroyed).toEqual([2])
})

test('endUpload destroys buffers not rewritten during the transaction', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'reads', makeBuf(1))
  reg.set(0, 'overlap', makeBuf(2))

  // Next sync: reads re-uploaded, overlap data went empty (not rewritten).
  reg.beginUpload()
  reg.set(0, 'reads', makeBuf(3))
  reg.endUpload()

  expect(destroyed).toEqual([2])
  expect(reg.get(0, 'reads')?.id).toBe(3)
  expect(reg.get(0, 'overlap')).toBeUndefined()
})

test('endUpload removes a region whose every pass went untouched', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'reads', makeBuf(1))
  reg.set(1, 'reads', makeBuf(2))

  // Region 1 no longer active this sync.
  reg.beginUpload()
  reg.set(0, 'reads', makeBuf(3))
  reg.endUpload()

  expect(destroyed).toEqual([2])
  expect(reg.get(1, 'reads')).toBeUndefined()
})

test('endUpload keeps buffers rewritten in either upload loop', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'reads', makeBuf(1))
  reg.set(0, 'arc', makeBuf(2))

  // Mirrors the renderer's two-loop sync: reads in the pileup loop, arc in the
  // arcs loop, both inside one begin/endUpload window.
  reg.beginUpload()
  reg.set(0, 'reads', makeBuf(3))
  reg.set(0, 'arc', makeBuf(4))
  reg.endUpload()

  expect(destroyed).toEqual([])
  expect(reg.get(0, 'reads')?.id).toBe(3)
  expect(reg.get(0, 'arc')?.id).toBe(4)
})

test('endUpload without beginUpload is a no-op', () => {
  const { reg, destroyed } = makeRegistry()
  reg.set(0, 'reads', makeBuf(1))
  reg.endUpload()
  expect(destroyed).toEqual([])
  expect(reg.get(0, 'reads')?.id).toBe(1)
})
