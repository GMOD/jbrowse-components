import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter, { parseSmallFasta } from './UnindexedFastaAdapter.ts'
import configSchema from './configSchema.ts'

function makeAdapter(file: string) {
  return new Adapter(
    configSchema.create({
      fastaLocation: {
        localPath: require.resolve(`../../test_data/${file}`),
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

test('reads a plain fasta', async () => {
  const adapter = makeAdapter('volvox.fa')
  expect(await adapter.getRefNames()).toEqual(['ctgA', 'ctgB'])
  expect(await adapter.getRegions()).toEqual([
    { refName: 'ctgA', start: 0, end: 50001 },
    { refName: 'ctgB', start: 0, end: 6079 },
  ])
})

test('a > inside a description does not split the entry', async () => {
  const adapter = makeAdapter('tricky_deflines.fa')
  // splitting on every '>' rather than on a line-initial one used to invent a
  // "B" contig out of the tail of the description and leave ctgA empty
  expect(await adapter.getRefNames()).toEqual(['ctgA', 'ctgB'])
  expect(await adapter.getRegions()).toEqual([
    { refName: 'ctgA', start: 0, end: 20 },
    { refName: 'ctgB', start: 0, end: 8 },
  ])
})

test('; comment lines before the first record are skipped', async () => {
  const adapter = makeAdapter('leading_comments.fa')
  expect(await adapter.getRefNames()).toEqual(['ctgA', 'ctgB'])
  expect(await adapter.getRegions()).toEqual([
    { refName: 'ctgA', start: 0, end: 20 },
    { refName: 'ctgB', start: 0, end: 8 },
  ])
})

describe('parseSmallFasta leading comments', () => {
  const records = '>chr1 desc one\nACGTACGT\nAC\n>chr2\nTTTT\n'
  const expected = [
    ['chr1', { description: 'desc one', sequence: 'ACGTACGTAC' }],
    ['chr2', { description: '', sequence: 'TTTT' }],
  ]

  test('a comment ended by a lone \\r does not swallow the first record', () => {
    expect([...parseSmallFasta(`;c\r${records}`)]).toEqual(expected)
  })

  test('CRLF comment and blank lines', () => {
    const crlf = records.replaceAll('\n', '\r\n')
    expect([...parseSmallFasta(`;one\r\n\r\n;two\r\n${crlf}`)]).toEqual(
      expected,
    )
  })

  test('millions of leading lines do not overflow the stack', () => {
    const text = ';c\n'.repeat(1_500_000) + '\n'.repeat(1_500_000) + records
    expect([...parseSmallFasta(text)]).toEqual(expected)
  })
})

test('clamps a region running past the end of the contig', async () => {
  const adapter = makeAdapter('tricky_deflines.fa')
  const features = await firstValueFrom(
    adapter
      .getFeatures({ refName: 'ctgA', start: 0, end: 1000 })
      .pipe(toArray()),
  )
  expect(features.length).toBe(1)
  // the residues stop at the contig end, so the feature has to say so
  expect(features[0]!.get('end')).toBe(20)
  expect(features[0]!.get('seq')).toBe('ACGTACGTACGTACGTACGT')
})

test('emits nothing for a refName the file does not have', async () => {
  const adapter = makeAdapter('tricky_deflines.fa')
  const features = await firstValueFrom(
    adapter
      .getFeatures({ refName: 'nope', start: 0, end: 100 })
      .pipe(toArray()),
  )
  expect(features).toEqual([])
})
