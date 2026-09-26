import { partnerShares } from './partnerShares.ts'

test('each partner covers its share of the chromosome, most first', () => {
  expect(
    partnerShares(
      [
        { partner: 'chr5', start: 0, end: 100 },
        { partner: 'chr17', start: 100, end: 700 },
        { partner: 'chr2', start: 700, end: 800 },
        { partner: 'chr5', start: 800, end: 890 },
      ],
      { start: 0, end: 1000 },
    ),
  ).toEqual([
    { partner: 'chr17', fraction: 0.6 },
    { partner: 'chr5', fraction: 0.19 },
    { partner: 'chr2', fraction: 0.1 },
  ])
})

test('overlapping alignments to one partner count their bases once', () => {
  expect(
    partnerShares(
      [
        { partner: 'chr1', start: 0, end: 500 },
        { partner: 'chr1', start: 250, end: 750 },
        { partner: 'chr1', start: 300, end: 400 },
      ],
      { start: 0, end: 1000 },
    ),
  ).toEqual([{ partner: 'chr1', fraction: 0.75 }])
})

test('bases past the region count none', () => {
  expect(
    partnerShares([{ partner: 'chr1', start: 500, end: 5000 }], {
      start: 0,
      end: 1000,
    }),
  ).toEqual([{ partner: 'chr1', fraction: 0.5 }])
})
