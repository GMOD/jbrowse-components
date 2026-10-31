import { getContainingView } from '@jbrowse/core/util'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { SORT_READS_MENU_LABEL } from './labels.ts'
import { sortReadsAtVariant, sortReadsMenuItems } from './sortReadsMenu.ts'

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getContainingView: jest.fn(),
  getSession: () => ({ notify: jest.fn() }),
}))

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
  const sort = { field: 'base', pos: 101, refName: 'ctgA' }
  expect(sorts).toEqual([sort, sort])
})

test('an insertion sorts on the insertion column', () => {
  const { view, sorts } = viewWithReads()
  sortReadsAtVariant(view, variant(100, 'A', ['ACC']), 1)
  expect(sorts[0]).toEqual({ field: 'insertion', pos: 101, refName: 'ctgA' })
})

test('a symbolic allele sorts nothing and says so', () => {
  const { view, sorts } = viewWithReads()
  expect(sortReadsAtVariant(view, variant(100, 'N', ['<DEL>']), 1)).toBe(false)
  expect(sorts).toEqual([])
})

// The right-clicked record carries REF and ALT off the cell payload, so the
// row sorts it as it stands, with no fetch.
test('the menu row sorts the right-clicked record', () => {
  const { view, sorts } = viewWithReads()
  jest.mocked(getContainingView).mockReturnValue(view as never)
  const [item] = sortReadsMenuItems({}, variant(100, 'ACGT', ['A']), 1)
  expect(item).toMatchObject({ label: SORT_READS_MENU_LABEL })
  if (item && 'onClick' in item) {
    item.onClick()
  }
  expect(sorts).toEqual(
    [{ field: 'base', pos: 101, refName: 'ctgA' }].flatMap(s => [s, s]),
  )
})

test('no row on a breakend, whose mate is what a sort would want', () => {
  const { view } = viewWithReads()
  jest.mocked(getContainingView).mockReturnValue(view as never)
  const breakend = new SimpleFeature({
    uniqueId: 'b',
    refName: 'ctgA',
    start: 100,
    end: 101,
    type: 'breakend',
  })
  expect(sortReadsMenuItems({}, breakend, 1)).toEqual([])
})
