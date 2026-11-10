import { createMapUploadSync } from './mapUploadSync.ts'

function makeBackend(calls: string[]) {
  return {
    upload(key: number, data: string | undefined) {
      calls.push(`up:${key}:${String(data)}`)
    },
    release(key: number) {
      calls.push(`rm:${key}`)
    },
  }
}

function harness() {
  const calls: string[] = []
  const backend = makeBackend(calls)
  const sync = createMapUploadSync<number, string | undefined, typeof backend>()
  return { backend, calls, sync }
}

test('reports whether anything reached the backend', () => {
  const { backend, calls, sync } = harness()
  const a = 'a'
  expect(sync(backend, new Map([[0, a]]))).toBe(true)
  expect(sync(backend, new Map([[0, a]]))).toBe(false)
  expect(sync(backend, new Map([[0, 'b']]))).toBe(true)
  expect(sync(backend, new Map())).toBe(true)
  expect(sync(backend, new Map())).toBe(false)
  expect(calls).toEqual(['up:0:a', 'up:0:b', 'rm:0'])
})

test('an entry whose data is undefined uploads once, not on every run', () => {
  const { backend, calls, sync } = harness()
  sync(backend, new Map([[3, undefined]]))
  expect(sync(backend, new Map([[3, undefined]]))).toBe(false)
  expect(calls.filter(c => c.startsWith('up:'))).toEqual(['up:3:undefined'])
})

test('a backend swap forgets the memo and re-uploads everything', () => {
  const { backend, calls, sync } = harness()
  const entries = new Map([[1, 'x']])
  sync(backend, entries)
  expect(sync(makeBackend(calls), entries)).toBe(true)
  expect(calls.filter(c => c.startsWith('up:'))).toEqual(['up:1:x', 'up:1:x'])
})
