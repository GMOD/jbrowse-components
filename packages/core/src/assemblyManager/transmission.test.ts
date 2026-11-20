import { transmissionEntriesFor } from './transmission.ts'

import type { TransmissionEntry } from './transmission.ts'

const aliases: Record<string, string> = {
  'NC_000023.11': 'chrX',
  X: 'chrX',
  'NC_000024.10': 'chrY',
  'NC_012920.1': 'chrM',
}
const assembly = {
  getCanonicalRefName2: (refName: string) => aliases[refName] ?? refName,
}

const hg38: TransmissionEntry[] = [
  { refName: 'chrX', sex: 'male', from: 'mother' },
  { refName: 'chrY', sex: 'male', from: 'father' },
  { refName: 'chrM', from: 'either' },
]

test('an entry holds for the refName it names', () => {
  expect(transmissionEntriesFor(hg38, 'chrY', assembly)).toEqual([
    { refName: 'chrY', sex: 'male', from: 'father' },
  ])
})

test('an autosome takes no entry', () => {
  expect(transmissionEntriesFor(hg38, 'chr1', assembly)).toEqual([])
})

test('a refName given by an alias finds the entry for its canonical name', () => {
  expect(transmissionEntriesFor(hg38, 'NC_000023.11', assembly)).toEqual([
    { refName: 'chrX', sex: 'male', from: 'mother' },
  ])
})

test('an entry written by an alias holds for the canonical name', () => {
  expect(
    transmissionEntriesFor(
      [{ refName: 'NC_012920.1', from: 'mother' }],
      'chrM',
      assembly,
    ),
  ).toEqual([{ refName: 'NC_012920.1', from: 'mother' }])
})

test('an entry naming no refName holds for every sequence, in the order written', () => {
  const haplodiploid: TransmissionEntry[] = [
    { refName: 'chrM', from: 'mother' },
    { sex: 'male', from: 'mother' },
  ]

  expect(transmissionEntriesFor(haplodiploid, 'chr1', assembly)).toEqual([
    { sex: 'male', from: 'mother' },
  ])
  expect(transmissionEntriesFor(haplodiploid, 'chrM', assembly)).toEqual(
    haplodiploid,
  )
})
