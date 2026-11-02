import { labelEdits } from './rowEdits.ts'

import type { RowSource } from './types.ts'

// The adapter says `a` is "Ay"; the config relabels `c` "Sea".
const adapter: RowSource[] = [
  { name: 'a', label: 'Ay' },
  { name: 'b' },
  { name: 'c' },
]
const shown: RowSource[] = [
  { name: 'a', label: 'Ay' },
  { name: 'b' },
  { name: 'c', label: 'Sea' },
]
function haplotypeParent(row: RowSource) {
  const match = / HP\d+$/.exec(row.name)
  return match
    ? { name: row.name.slice(0, match.index), labelSuffix: match[0] }
    : undefined
}

const live = {
  shown,
  adapter,
  labels: { c: 'Sea' },
  rowParent: () => undefined,
}

test('an unchanged submit writes the config back as it was', () => {
  expect(labelEdits({ ...live, rows: shown })).toEqual({ c: 'Sea' })
})

// A config entry that repeats the adapter's label is the config's, so a
// submit that leaves the row alone keeps it.
test('an entry equal to the adapter label stands while the row is unchanged', () => {
  expect(labelEdits({ ...live, labels: { a: 'Ay' }, rows: shown })).toEqual({
    a: 'Ay',
  })
})

test('a row the dialog never showed keeps its label', () => {
  expect(labelEdits({ ...live, rows: [shown[0]!, shown[1]!] })).toEqual({
    c: 'Sea',
  })
})

// A variant dialog opened before the first genotypes land shows sample rows.
test('a dialog row the current rows no longer hold writes nothing', () => {
  const haplotypes: RowSource[] = ['S0 HP1', 'S0 HP2'].map(name => ({
    name,
    label: 'Sample zero',
  }))
  expect(
    labelEdits({
      rows: [{ name: 'S0', label: 'Something else' }],
      shown: haplotypes,
      adapter: haplotypes,
      labels: {},
      rowParent: haplotypeParent,
    }),
  ).toEqual({})
})

test('a changed row is written as the reader left it', () => {
  expect(
    labelEdits({
      ...live,
      rows: [shown[0]!, { name: 'b', label: 'Bee' }, shown[2]!],
    }),
  ).toEqual({ c: 'Sea', b: 'Bee' })
})

test('a label changed back to the adapter one removes the entry', () => {
  expect(
    labelEdits({
      ...live,
      rows: [{ name: 'a', label: 'Ay' }, shown[1]!, { name: 'c' }],
    }),
  ).toEqual({})
})

// A haplotype row shows its sample's entry composed with its haplotype until
// it has one of its own, so a label changed back to that removes the row's
// own entry.
test("a row with a parent falls back to the parent's entry, composed", () => {
  expect(
    labelEdits({
      shown: [{ name: 'S1 HP1', label: 'Own' }],
      adapter: [{ name: 'S1 HP1' }],
      labels: { S1: 'Sample', 'S1 HP1': 'Own' },
      rowParent: haplotypeParent,
      rows: [{ name: 'S1 HP1', label: 'Sample HP1' }],
    }),
  ).toEqual({ S1: 'Sample' })
})

test("a row relabelled as its parent's bare label keeps its own entry", () => {
  expect(
    labelEdits({
      shown: [{ name: 'S1 HP1', label: 'Own' }],
      adapter: [{ name: 'S1 HP1' }],
      labels: { S1: 'Sample', 'S1 HP1': 'Own' },
      rowParent: haplotypeParent,
      rows: [{ name: 'S1 HP1', label: 'Sample' }],
    }),
  ).toEqual({ S1: 'Sample', 'S1 HP1': 'Sample' })
})
