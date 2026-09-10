import { SimpleFeature } from '@jbrowse/core/util'

import { dedupeRibbons } from './dedupeRibbons.ts'

const hg38Side = {
  uniqueId: '28-t-hg38',
  assemblyName: 'hg38',
  refName: 'chrX',
  start: 10447550,
  end: 34924653,
  strand: -1,
  mate: {
    assemblyName: 'mm39',
    refName: 'chrX',
    start: 1000,
    end: 24000,
  },
}

// The same PIF row read from the other end: a different feature id, the two loci
// swapped, and the same ribbon.
const mm39Side = {
  uniqueId: '28-q-mm39',
  assemblyName: 'mm39',
  refName: 'chrX',
  start: 1000,
  end: 24000,
  strand: -1,
  mate: {
    assemblyName: 'hg38',
    refName: 'chrX',
    start: 10447550,
    end: 34924653,
  },
}

test('an alignment fetched from both genomes draws once', () => {
  const kept = dedupeRibbons([
    new SimpleFeature(hg38Side),
    new SimpleFeature(mm39Side),
  ])
  expect(kept.map(f => f.id())).toEqual(['28-t-hg38'])
})

// Two genomes on one circle can carry the same refName, so the key has to name
// the assembly too: these are different arcs.
test('the same span on two genomes is two ribbons', () => {
  const kept = dedupeRibbons([
    new SimpleFeature(hg38Side),
    new SimpleFeature({
      ...hg38Side,
      uniqueId: 'other',
      assemblyName: 'mm39',
    }),
  ])
  expect(kept).toHaveLength(2)
})

test('two alignments between the same pair of chromosomes both draw', () => {
  const kept = dedupeRibbons([
    new SimpleFeature(hg38Side),
    new SimpleFeature({
      ...hg38Side,
      uniqueId: '29-t-hg38',
      start: 40000000,
      end: 41000000,
    }),
  ])
  expect(kept).toHaveLength(2)
})

test('a feature with no mate is left alone', () => {
  const bare = new SimpleFeature({
    uniqueId: 'bare',
    assemblyName: 'hg38',
    refName: 'chr1',
    start: 0,
    end: 100,
  })
  expect(dedupeRibbons([bare]).map(f => f.id())).toEqual(['bare'])
})
