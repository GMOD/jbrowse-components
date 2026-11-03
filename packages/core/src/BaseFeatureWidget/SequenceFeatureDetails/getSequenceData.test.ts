import {
  filterSuccessiveElementsWithSameStartAndEndCoord,
  getSequenceData,
} from './getSequenceData.ts'

import type { SimpleFeatureSerializedNoId } from '../../util/index.ts'
import type { Feat } from './types.ts'

const row = (type: string, start: number, end: number) => ({
  type,
  start,
  end,
  refName: 'NC_045512.2',
})
const product = (start: number, end: number) =>
  row('mature_protein_region_of_CDS', start, end)

function polyprotein(subfeatures: SimpleFeatureSerializedNoId[]) {
  return getSequenceData({
    feature: {
      uniqueId: 'pp',
      refName: 'NC_045512.2',
      type: 'CDS',
      start: 100,
      end: 160,
      strand: 1,
      subfeatures,
    },
    sequence: { seq: 'A'.repeat(60) },
    revcomp: false,
  }).cds.map(c => [c.start, c.end])
}

describe('getSequenceData for a polyprotein CDS', () => {
  it('stitches the cleavage products of a single-frame polyprotein', () => {
    expect(polyprotein([product(100, 130), product(130, 157)])).toEqual([
      [0, 30],
      [30, 57],
    ])
  })

  // @gmod/gff-nostream folds SARS-CoV-2 ORF1ab into one CDS carrying a CDS row per
  // reading frame, overlapping by the slipped base, beside its products.
  it('stitches the reading frames of a frameshift polyprotein, not its products', () => {
    expect(
      polyprotein([
        row('CDS', 100, 130),
        row('CDS', 129, 160),
        product(100, 130),
        product(129, 157),
      ]),
    ).toEqual([
      [0, 30],
      [29, 60],
    ])
  })
})

describe('filterSuccessiveElementsWithSameStartAndEndCoord', () => {
  test('removes immediately successive duplicates', () => {
    const input: Feat[] = [
      { start: 10, end: 20 },
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ]
    expect(
      filterSuccessiveElementsWithSameStartAndEndCoord(input),
    ).toStrictEqual([
      { start: 10, end: 20 },
      { start: 30, end: 40 },
    ])
  })

  test('keeps non-successive duplicates', () => {
    const input: Feat[] = [
      { start: 10, end: 20 },
      { start: 30, end: 40 },
      { start: 10, end: 20 },
    ]
    expect(
      filterSuccessiveElementsWithSameStartAndEndCoord(input),
    ).toHaveLength(3)
  })

  test('empty list returns empty list', () => {
    expect(filterSuccessiveElementsWithSameStartAndEndCoord([])).toStrictEqual(
      [],
    )
  })
})
