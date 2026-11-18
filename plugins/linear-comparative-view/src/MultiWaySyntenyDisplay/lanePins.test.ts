import { pinsInForceOf } from './lanePins.ts'

// two spellings of one assembly can both be rows, and each keeps its own pin
test('a pin goes to the row spelled as the pin is, before an alias of it', () => {
  const keyOf = (name: string) => (name === 'hg38_alias' ? 'hg38' : name)
  const lanes = ['hg38', 'hg38_alias']
  expect(
    pinsInForceOf(
      [
        { lane: 'hg38_alias', refName: 'chr2' },
        { lane: 'hg38', refName: 'chr1' },
      ],
      lanes,
      'mm10',
      keyOf,
    ),
  ).toEqual([
    { lane: 'hg38_alias', refName: 'chr2' },
    { lane: 'hg38', refName: 'chr1' },
  ])
  expect(
    pinsInForceOf([{ lane: 'GRCh38', refName: 'chr1' }], ['hg38'], 'mm10', n =>
      n === 'GRCh38' ? 'hg38' : n,
    ),
  ).toEqual([{ lane: 'hg38', refName: 'chr1' }])
})
