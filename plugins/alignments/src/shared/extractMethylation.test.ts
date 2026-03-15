import { SimpleFeature } from '@jbrowse/core/util'

import { extractMethylation } from './processFeatureAlignments.ts'
import type { ModificationEntry } from './webglRpcTypes.ts'

// Sequence AACGATCGAA: C's at read positions 2 and 6
// CpG dinucleotides at read positions 2-3 (genomic 102-103) and 6-7 (genomic 106-107)
function makeMethFeature(tags: Record<string, unknown> = {}) {
  return new SimpleFeature({
    uniqueId: 'read1',
    refName: 'ctgA',
    start: 100,
    end: 110,
    strand: 1,
    CIGAR: '10M',
    seq: 'AACGATCGAA',
    tags: {
      // C+m,0,0; → methylation on 1st C (skip 0) and 2nd C (skip 0)
      MM: 'C+m,0,0;',
      // first C: 230/255≈0.90, second C: 50/255≈0.20
      ML: [230, 50],
      ...tags,
    },
  })
}

// Caller is responsible for lowercasing
function run(
  feature: ReturnType<typeof makeMethFeature>,
  refSeq: string,
  refStart: number,
  regionStart: number,
  regionEnd: number,
) {
  const mods: ModificationEntry[] = []
  extractMethylation(
    feature,
    'read1',
    feature.get('start'),
    feature.get('strand'),
    refSeq.toLowerCase(),
    refStart,
    regionStart,
    regionEnd,
    mods,
  )
  return mods
}

describe('extractMethylation', () => {
  test('detects CpG sites at correct reference positions', () => {
    const mods = run(makeMethFeature(), 'AACGATCGAA', 100, 100, 110)
    const methEntries = mods.filter(m => m.modType === 'm')
    expect(methEntries.length).toBe(2)
    expect(methEntries[0]!.position).toBe(102)
    expect(methEntries[1]!.position).toBe(106)
  })

  test('high probability CpG colored red, low probability colored blue', () => {
    const mods = run(makeMethFeature(), 'AACGATCGAA', 100, 100, 110)
    const methEntries = mods.filter(m => m.modType === 'm')

    // First CpG: prob≈0.90 → red
    expect(methEntries[0]!.r).toBe(255)
    expect(methEntries[0]!.g).toBe(0)
    expect(methEntries[0]!.b).toBe(0)

    // Second CpG: prob≈0.20 → blue
    expect(methEntries[1]!.r).toBe(0)
    expect(methEntries[1]!.g).toBe(0)
    expect(methEntries[1]!.b).toBe(255)
  })

  test('non-CpG reference positions are skipped', () => {
    const mods = run(makeMethFeature(), 'AAAAAAAAAA', 100, 100, 110)
    expect(mods.length).toBe(0)
  })

  test('CpG sites without modification data are skipped', () => {
    // Read has no MM/ML tags → getMethBins returns empty bins
    const feature = new SimpleFeature({
      uniqueId: 'nomod',
      refName: 'ctgA',
      start: 100,
      end: 110,
      strand: 1,
      CIGAR: '10M',
      seq: 'AACGATCGAA',
      tags: {},
    })
    const mods = run(feature, 'AACGATCGAA', 100, 100, 110)
    expect(mods.length).toBe(0)
  })

  test('only processes positions within region bounds', () => {
    const mods = run(makeMethFeature(), 'AACGATCGAA', 100, 100, 105)
    const methEntries = mods.filter(m => m.modType === 'm')
    expect(methEntries.length).toBe(1)
    expect(methEntries[0]!.position).toBe(102)
  })

  test('no hydroxymethylation entries when no hydroxy data present', () => {
    const mods = run(makeMethFeature(), 'AACGATCGAA', 100, 100, 110)
    const hydroxyEntries = mods.filter(m => m.modType === 'h')
    expect(hydroxyEntries.length).toBe(0)
  })

  test('hydroxymethylation entries at same C position as methylation', () => {
    const feature = makeMethFeature({
      MM: 'C+m,0,0;C+h,0,0;',
      ML: [230, 50, 200, 40],
    })
    const mods = run(feature, 'AACGATCGAA', 100, 100, 110)
    const hydroxyEntries = mods.filter(m => m.modType === 'h')
    expect(hydroxyEntries.length).toBe(2)
    expect(hydroxyEntries[0]!.position).toBe(102)
    expect(hydroxyEntries[1]!.position).toBe(106)
  })

  test('reference sequence offset correctly applied', () => {
    // Reference starts at 90, read at 100
    const refSeq = 'AAAAAAAAAAAACGATCGAA'
    const mods = run(makeMethFeature(), refSeq, 90, 100, 110)
    const methEntries = mods.filter(m => m.modType === 'm')
    expect(methEntries.length).toBe(2)
    expect(methEntries[0]!.position).toBe(102)
    expect(methEntries[1]!.position).toBe(106)
  })

  test('strand is set correctly for reverse strand reads', () => {
    const feature = new SimpleFeature({
      uniqueId: 'rev1',
      refName: 'ctgA',
      start: 100,
      end: 110,
      strand: -1,
      CIGAR: '10M',
      seq: 'AACGATCGAA',
      tags: { MM: 'C+m,0,0;', ML: [230, 50] },
    })
    const mods: ModificationEntry[] = []
    extractMethylation(
      feature,
      'rev1',
      100,
      -1,
      'aacgatcgaa',
      100,
      100,
      110,
      mods,
    )
    const methEntries = mods.filter(m => m.modType === 'm')
    for (const entry of methEntries) {
      expect(entry.strand).toBe(-1)
    }
  })

  test('no entries when feature has no CIGAR', () => {
    const feature = new SimpleFeature({
      uniqueId: 'nocigar',
      refName: 'ctgA',
      start: 100,
      end: 110,
      strand: 1,
      seq: 'AACGATCGAA',
      tags: { MM: 'C+m,0,0;', ML: [230, 50] },
    })
    const mods: ModificationEntry[] = []
    extractMethylation(
      feature,
      'nocigar',
      100,
      1,
      'aacgatcgaa',
      100,
      100,
      110,
      mods,
    )
    expect(mods.length).toBe(0)
  })
})
