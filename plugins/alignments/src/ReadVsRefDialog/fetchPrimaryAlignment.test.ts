import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import {
  resolvePrimaryAlignment,
  supplementaryLoci,
} from './fetchPrimaryAlignment.ts'

import type { AlignmentLocus } from './fetchPrimaryAlignment.ts'
import type { Feature } from '@jbrowse/core/util'

const READ1 = SAM_FLAG_PAIRED | SAM_FLAG_FIRST_IN_PAIR
const READ2 = SAM_FLAG_PAIRED | SAM_FLAG_SECOND_IN_PAIR

function read(
  uniqueId: string,
  data: {
    refName: string
    start: number
    end: number
    flags: number
    SA?: string
  },
) {
  const { SA, ...rest } = data
  return new SimpleFeature({
    uniqueId,
    name: 'frag1',
    ...rest,
    tags: SA ? { SA } : {},
  })
}

function fetcherOver(feats: Feature[]) {
  const calls: AlignmentLocus[][] = []
  const fetchAt = async (loci: AlignmentLocus[]) => {
    calls.push(loci)
    return feats.filter(f =>
      loci.some(
        l =>
          l.refName === f.get('refName') &&
          l.start < f.get('end') &&
          l.start + 1 > f.get('start'),
      ),
    )
  }
  return { calls, fetchAt }
}

test('a non-supplementary record is its own primary and fetches nothing', async () => {
  const primary = read('p', {
    refName: 'chr1',
    start: 1000,
    end: 1100,
    flags: READ1,
  })
  const { calls, fetchAt } = fetcherOver([])
  expect(await resolvePrimaryAlignment(primary, fetchAt)).toBe(primary)
  expect(calls).toEqual([])
})

test('an overlapping mate sorted ahead of the primary is not taken for it', async () => {
  const primary = read('r1', {
    refName: 'chr1',
    start: 1000,
    end: 1100,
    flags: READ1,
    SA: 'chr5,20001,+,60S40M,60,0;',
  })
  // read2 of a 150 bp fragment: starts before read1 and covers its first base
  const mate = read('r2', {
    refName: 'chr1',
    start: 950,
    end: 1050,
    flags: READ2,
  })
  const supp = read('r1-supp', {
    refName: 'chr5',
    start: 20000,
    end: 20040,
    flags: READ1 | SAM_FLAG_SUPPLEMENTARY,
    SA: 'chr1,1001,+,40S60M,60,0;',
  })
  const { calls, fetchAt } = fetcherOver([mate, primary, supp])
  expect(await resolvePrimaryAlignment(supp, fetchAt)).toBe(primary)
  expect(calls).toEqual([[{ refName: 'chr1', start: 1000 }]])
})

test('finds the primary when the SA tag does not file it first', async () => {
  const primary = read('p', {
    refName: 'chr1',
    start: 1000,
    end: 1100,
    flags: 0,
    SA: 'chr5,20001,+,60S40M,60,0;chr9,500,-,80S20M,60,0;',
  })
  const other = read('s2', {
    refName: 'chr9',
    start: 499,
    end: 519,
    flags: SAM_FLAG_SUPPLEMENTARY,
  })
  const supp = read('s1', {
    refName: 'chr5',
    start: 20000,
    end: 20040,
    flags: SAM_FLAG_SUPPLEMENTARY,
    SA: 'chr9,500,-,80S20M,60,0;chr1,1001,+,40S60M,60,0;',
  })
  const { calls, fetchAt } = fetcherOver([primary, other, supp])
  expect(await resolvePrimaryAlignment(supp, fetchAt)).toBe(primary)
  expect(calls).toEqual([
    [{ refName: 'chr9', start: 499 }],
    [{ refName: 'chr1', start: 1000 }],
  ])
})

test('a supplementary with no SA tag says so rather than searching', async () => {
  const supp = read('s', {
    refName: 'chr5',
    start: 20000,
    end: 20040,
    flags: SAM_FLAG_SUPPLEMENTARY,
  })
  const { calls, fetchAt } = fetcherOver([])
  await expect(resolvePrimaryAlignment(supp, fetchAt)).rejects.toThrow(
    /no SA tag/,
  )
  expect(calls).toEqual([])
})

test('supplementaryLoci drops records without a numeric position', () => {
  const supp = read('s', {
    refName: 'chr5',
    start: 20000,
    end: 20040,
    flags: SAM_FLAG_SUPPLEMENTARY,
    SA: 'chr1,1001,+,40S60M,60,0;chr2,,+,*,0,0;chr3,abc,+,*,0,0;',
  })
  expect(supplementaryLoci(supp)).toEqual([{ refName: 'chr1', start: 1000 }])
})
