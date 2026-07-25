import { createGlobalUploadSync } from './globalUploadSync.ts'

interface FakeBackend {
  name: string
}

function makeHarness() {
  const syncUpload = createGlobalUploadSync<FakeBackend>()
  const uploads: string[] = []
  // the shape the mixin's single upload autorun runs each tick: both slots
  // read unconditionally, each skipping on its own input
  function run(backend: FakeBackend, data: unknown, colorScheme: unknown) {
    syncUpload(backend, 'data', data, () => {
      uploads.push('data')
    })
    syncUpload(backend, 'colorRamp', colorScheme, () => {
      uploads.push('colorRamp')
    })
  }
  return { run, uploads }
}

const backendA: FakeBackend = { name: 'a' }
const backendB: FakeBackend = { name: 'b' }

test('uploads every slot on the first run', () => {
  const { run, uploads } = makeHarness()
  run(backendA, { rows: 1 }, 'viridis')
  expect(uploads).toEqual(['data', 'colorRamp'])
})

test('a slot whose input is unchanged is skipped', () => {
  const { run, uploads } = makeHarness()
  const data = { rows: 1 }
  run(backendA, data, 'viridis')
  uploads.length = 0
  run(backendA, data, 'viridis')
  expect(uploads).toEqual([])
})

// The regression this exists for: HiC's palette is a config slot and its matrix
// comes from the RPC, but both are read by the one upload autorun. Changing one
// must not re-push the other.
test('slots invalidate independently', () => {
  const { run, uploads } = makeHarness()
  const data = { rows: 1 }
  run(backendA, data, 'viridis')

  uploads.length = 0
  run(backendA, data, 'juicebox')
  expect(uploads).toEqual(['colorRamp'])

  uploads.length = 0
  run(backendA, { rows: 2 }, 'juicebox')
  expect(uploads).toEqual(['data'])
})

test('re-uploads a slot when its value returns by a fresh reference', () => {
  const { run, uploads } = makeHarness()
  run(backendA, { rows: 1 }, 'viridis')
  uploads.length = 0
  // structurally equal but a new object — the diff is by reference, matching
  // createRegionUploadSync
  run(backendA, { rows: 1 }, 'viridis')
  expect(uploads).toEqual(['data'])
})

test('a backend swap re-uploads every slot', () => {
  const { run, uploads } = makeHarness()
  const data = { rows: 1 }
  run(backendA, data, 'viridis')
  uploads.length = 0
  // context-loss recovery: the new backend has empty GPU buffers, so identical
  // inputs must still be pushed again
  run(backendB, data, 'viridis')
  expect(uploads).toEqual(['data', 'colorRamp'])
})

test('an undefined input uploads once, not on every run', () => {
  const { run, uploads } = makeHarness()
  run(backendA, undefined, 'viridis')
  expect(uploads).toEqual(['data', 'colorRamp'])
  uploads.length = 0
  run(backendA, undefined, 'viridis')
  expect(uploads).toEqual([])
})
