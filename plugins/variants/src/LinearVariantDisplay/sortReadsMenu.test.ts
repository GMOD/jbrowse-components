import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { sortReadsAtVariant } from './sortReadsMenu.ts'

function variant(start: number, REF: string, ALT: string[]) {
  return new SimpleFeature({
    uniqueId: 'v',
    // the VCF's own spelling of the contig, which the view may not share
    refName: 'contigA',
    start,
    end: start + REF.length,
    REF,
    ALT,
  })
}

function viewWithReads() {
  const sorts: unknown[] = []
  const pileup = {
    setSort(sort: unknown) {
      sorts.push(sort)
    },
    sortAtCenterLine() {},
  }
  return {
    sorts,
    view: {
      displayedRegions: [{ refName: 'ctgB' }, { refName: 'ctgA' }],
      tracks: [
        { displays: [{ type: 'LinearVariantDisplay' }] },
        { displays: [pileup] },
        { displays: [pileup] },
      ],
    },
  }
}

test('sorts every pileup at the variant, under the view’s refName', () => {
  const { view, sorts } = viewWithReads()
  expect(sortReadsAtVariant(view, variant(100, 'ACGT', ['A']), 1)).toBe(true)
  const sort = { type: 'basePair', pos: 101, refName: 'ctgA' }
  expect(sorts).toEqual([sort, sort])
})

test('an insertion sorts on the insertion column', () => {
  const { view, sorts } = viewWithReads()
  sortReadsAtVariant(view, variant(100, 'A', ['ACC']), 1)
  expect(sorts[0]).toEqual({ type: 'insertion', pos: 101, refName: 'ctgA' })
})

test('a symbolic allele sorts nothing and says so', () => {
  const { view, sorts } = viewWithReads()
  expect(sortReadsAtVariant(view, variant(100, 'N', ['<DEL>']), 1)).toBe(false)
  expect(sorts).toEqual([])
})
