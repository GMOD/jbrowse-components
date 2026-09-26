import { parseFeatureLazy } from 'gff-nostream'

import { groupDiscontinuous } from './groupDiscontinuous.ts'

function line(type: string, start: number, end: number, attrs: string) {
  return {
    feature: parseFeatureLazy(
      `ctgA\tRefSeq\t${type}\t${start}\t${end}\t.\t+\t.\t${attrs}`,
    ),
  }
}

describe('groupDiscontinuous', () => {
  it('folds the lines of one ID into the first, spanning them all', () => {
    const items = groupDiscontinuous([
      line('cDNA_match', 1000, 1200, 'ID=aln1;Target=NM_1 1 201 +'),
      line('cDNA_match', 2000, 2300, 'ID=aln1;Target=NM_1 202 502 +'),
      line('cDNA_match', 4500, 5000, 'ID=aln1;Target=NM_1 503 1003 +'),
    ])
    expect(items).toHaveLength(1)
    const { feature } = items[0]!
    expect([feature.start, feature.end]).toEqual([999, 5000])
    expect(feature.type).toBe('cDNA_match')
    expect(feature.subfeatures.map(f => [f.start, f.end])).toEqual([
      [999, 1200],
      [1999, 2300],
      [4499, 5000],
    ])
    expect(feature.subfeatures.every(f => f.type === 'cDNA_match')).toBe(true)
    expect(feature.subfeatures.every(f => f.subfeatures.length === 0)).toBe(
      true,
    )
  })

  it('leaves a single-line feature without a child of itself', () => {
    const items = groupDiscontinuous([
      line('match', 7000, 7500, 'ID=aln2;Target=NG_1 1 501 +'),
      line('match', 8000, 8500, 'ID=aln3;Target=NG_2 1 501 +'),
    ])
    expect(items).toHaveLength(2)
    expect(items.map(i => i.feature.subfeatures.length)).toEqual([0, 0])
  })

  it('keeps children already attached to the first line', () => {
    const first = line('match', 1000, 1200, 'ID=m1')
    first.feature.subfeatures.push(
      line('match_part', 1000, 1100, 'Parent=m1').feature,
    )
    const [item] = groupDiscontinuous([
      first,
      line('match', 2000, 2200, 'ID=m1'),
    ])
    expect(item!.feature.subfeatures.map(f => f.type)).toEqual([
      'match_part',
      'match',
      'match',
    ])
  })

  it('passes a line with no ID through untouched', () => {
    const items = groupDiscontinuous([
      line('region', 1, 100, 'Name=a'),
      line('region', 1, 100, 'Name=b'),
    ])
    expect(items).toHaveLength(2)
  })
})
