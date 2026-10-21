import { packSyntenyFeatureData } from '../LinearSyntenyDisplay/testUtils.ts'
import { followReverseShare } from './followReverseShare.ts'

import type { FeatureBlock } from '../LinearSyntenyDisplay/testUtils.ts'

const WINDOW = { refName: 'chr1', start: 0, end: 200_000 }

const share = (blocks: FeatureBlock[]) =>
  followReverseShare({
    data: packSyntenyFeatureData(blocks),
    window: WINDOW,
    toMate: true,
    targetRefName: 'chr2',
  })

// ten short forward orthologs and one long reverse gene
function genes(named: boolean) {
  return [
    ...Array.from({ length: 10 }, (_, i) => ({
      name: named ? `fwd${i}` : undefined,
      start: i * 2000,
      end: i * 2000 + 1000,
      mateRefName: 'chr2',
      strand: 1,
    })),
    {
      name: named ? 'rev' : undefined,
      start: 50_000,
      end: 150_000,
      mateRefName: 'chr2',
      strand: -1,
    },
  ]
}

test('a gene table votes once per gene, so one long gene does not turn the row', () => {
  expect(share(genes(true))).toBeCloseTo(1 / 11)
})

test('a nameless alignment votes by the bp it covers', () => {
  expect(share(genes(false))).toBeCloseTo(100_000 / 110_000)
})

test('blocks to another contig do not vote', () => {
  expect(
    share([{ start: 0, end: 1000, mateRefName: 'chr3', strand: -1 }]),
  ).toBeUndefined()
})
