import { applyClusterRun, clusteredCladeLayout } from './applyClusterRun.ts'

const row = (name: string) => ({ name })

test('lands the layout from the row lists the run started with', async () => {
  const a = row('a')
  const b = row('b')
  const c = row('c')
  const model = {
    editableSources: [a, b, c],
    rowSort: [] as string[],
    setRowOrder: jest.fn(),
  }
  await applyClusterRun({
    model,
    rows: [a, b],
    provenance: { regions: [], settings: [] },
    matrix: async () => {
      model.editableSources = [a, b]
      return { order: [1, 0], tree: '(b,a);' }
    },
  })
  expect(model.setRowOrder).toHaveBeenCalledWith([b, a, c], {
    tree: '(b,a);',
    provenance: { regions: [], settings: [] },
  })
})

// A run on a domain-seeded track composes with the seed instead of overwriting
// it: the dendrogram turns towards the declared order and the layout follows
// its leaves, so both the tree and the seed survive the run.
test('rotates the run towards the config domain', async () => {
  const a = row('a')
  const b = row('b')
  const c = row('c')
  const model = {
    editableSources: [a, b, c],
    rowSort: ['c'],
    setRowOrder: jest.fn(),
  }
  await applyClusterRun({
    model,
    rows: [a, b, c],
    provenance: { regions: [], settings: [] },
    matrix: async () => ({
      order: [0, 1, 2],
      tree: '((a:1,b:1):1,c:2);',
    }),
  })
  const [rows, run] = model.setRowOrder.mock.calls[0]!
  expect(rows).toEqual([c, a, b])
  expect(run.tree).toBe('(c:2,(a:1,b:1):1);')
})

test('clusteredCladeLayout reorders the rows it indexes', () => {
  const base = [
    { name: 'A', color: 'red' },
    { name: 'B', color: 'green' },
    { name: 'C', color: 'blue' },
  ]
  const result = clusteredCladeLayout({
    rows: base,
    editableSources: base,
    order: [2, 0, 1],
  })
  expect(result.map(r => r.name)).toEqual(['C', 'A', 'B'])
  expect(result[0]).toBe(base[2])
})

// The four displays' one commit path. A run under a focus clusters the clade, so
// the order covers only those rows -- the rest are the user's record of where
// they sit and what they were named, and dropping them would erase that the
// moment the focus cleared.
test('clusteredCladeLayout re-appends the rows the filter is hiding', () => {
  const editableSources = [
    { name: 'A' },
    { name: 'B', color: 'yellow' },
    { name: 'C' },
    { name: 'D' },
  ]
  const result = clusteredCladeLayout({
    rows: [{ name: 'A' }, { name: 'C' }],
    editableSources,
    order: [1, 0],
  })

  expect(result.map(r => r.name)).toEqual(['C', 'A', 'B', 'D'])
  expect(result[2]).toEqual({ name: 'B', color: 'yellow' })
})

test('clusteredCladeLayout rejects an order that misses a clustered row', () => {
  expect(() =>
    clusteredCladeLayout({
      rows: abc,
      editableSources: abc,
      order: [0, 1],
    }),
  ).toThrow(/expected 3 entries/)
})

const abc = [{ name: 'A' }, { name: 'B' }, { name: 'C' }]

function layoutAbc(order: number[], matrixRowNames?: string[]) {
  clusteredCladeLayout({
    rows: abc,
    editableSources: abc,
    order,
    matrixRowNames,
  })
}

test('clusteredCladeLayout accepts a full permutation', () => {
  expect(() => {
    layoutAbc([2, 0, 1])
  }).not.toThrow()
})

// The message is the only feedback on a long paste, so it names the position in
// the paste AND the offending value. "entry 2" used to be the value, printed
// where a position reads.
test('clusteredCladeLayout rejects out-of-range, duplicate, and wrong-length', () => {
  expect(() => {
    layoutAbc([0, 3])
  }).toThrow('entry 2 is 4, outside the range 1-3')
  expect(() => {
    layoutAbc([0, 1, 1])
  }).toThrow('entry 3 repeats row 2')
  expect(() => {
    layoutAbc([0, 1])
  }).toThrow(/expected 3 entries/)
})

// `parseClusterOrder` is a bare `+`, so a stray word in the paste reaches here
// as NaN. It used to print as "entry NaN is out of range 1-3", naming neither
// the position nor the value.
test('clusteredCladeLayout names a non-numeric paste line by position', () => {
  expect(() => {
    layoutAbc([0, Number.NaN, 2])
  }).toThrow('entry 2 is not a whole number')
})

test('clusteredCladeLayout accepts an order over the rows the matrix held', () => {
  expect(() => {
    layoutAbc([2, 0, 1], ['A', 'B', 'C'])
  }).not.toThrow()
})

// The one a cardinality check cannot see: the row set moved while the user was
// in R, keeping its count, so every rank lands on a row that never entered the
// matrix and the dendrogram still draws.
test('clusteredCladeLayout rejects an order whose rows were swapped out', () => {
  expect(() => {
    layoutAbc([2, 0, 1], ['A', 'D', 'C'])
  }).toThrow('row 2 was "D" and is now "B"')
})

test('clusteredCladeLayout reports a row count that moved before the entries', () => {
  // the count check would have said "expected 3 entries, got 2", which names
  // the paste rather than the rows that changed under it
  expect(() => {
    layoutAbc([1, 0], ['A', 'B'])
  }).toThrow('the matrix had 2 rows and there are now 3')
})
