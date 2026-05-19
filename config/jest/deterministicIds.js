// Makes nanoid() return deterministic values in tests by replacing
// crypto.getRandomValues with a counter-based PRNG. Reset before each test
// so IDs are stable across re-runs.
let counter = 0

crypto.getRandomValues = arr => {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = (counter++ * 37 + 97) & 0xff
  }
  return arr
}

beforeEach(() => {
  counter = 0
})

// Stable BaseAdapter.id in tests so adapter-derived feature uniqueIds stay
// snapshot-safe. Keeps the test detection out of the production class.
jest.mock('@jbrowse/core/data_adapters/BaseAdapter/getAdapterId', () => ({
  getAdapterId: () => 'test',
}))
