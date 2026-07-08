import { pickSamplesResult } from './fetchMafData.ts'

import type { Sample } from '../types.ts'

function sample(id: string): Sample {
  return { id, label: id }
}

function result(...ids: string[]) {
  return { result: { samples: ids.map(sample), treeNewick: undefined } }
}

describe('pickSamplesResult', () => {
  test('prefers a region that discovered samples over an earlier empty one', () => {
    // A sample-discovery track over a viewport whose first buffered region is a
    // MAF gap (no blocks → no samples) but a later region has alignments.
    const picked = pickSamplesResult([result(), result('hg38', 'mm10')])
    expect(picked?.samples.map(s => s.id)).toEqual(['hg38', 'mm10'])
  })

  test('returns the first result when it already has samples', () => {
    // Configured-samples tracks return the same non-empty set for every region.
    const picked = pickSamplesResult([result('hg38'), result('hg38')])
    expect(picked?.samples.map(s => s.id)).toEqual(['hg38'])
  })

  test('falls back to the first result when every region is empty', () => {
    // All-gap viewport: an empty sample set is the correct outcome (blank rows).
    const picked = pickSamplesResult([result(), result()])
    expect(picked?.samples).toEqual([])
  })

  test('returns undefined when there are no results', () => {
    expect(pickSamplesResult([])).toBeUndefined()
  })
})
