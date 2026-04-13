import { SimpleFeature } from '@jbrowse/core/util'

import { extractMethylation } from './processFeatureAlignments.ts'
import { parseCigar2 } from '../MismatchParser/index.ts'
import { getModPositions } from '../ModificationParser/getModPositions.ts'
import { getModProbabilities } from '../ModificationParser/getModProbabilities.ts'

import type { ParsedModData } from './processFeatureAlignments.ts'
import type { ModificationEntry } from './webglRpcTypes.ts'

// Sequence AACGATCGAA: Cs at read positions 2 and 6
// CpG dinucleotides at read positions 2-3 and 6-7 → genomic 102-103 and 106-107
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

function run(
  feature: ReturnType<typeof makeMethFeature>,
  regionStart: number,
  regionEnd: number,
) {
  const mods: ModificationEntry[] = []
  const cigar = feature.get('CIGAR') as string | undefined
  if (!cigar) {
    return mods
  }
  const seq = feature.get('seq') as string | undefined
  if (!seq) {
    return mods
  }
  const tags = feature.get('tags') as { MM?: string; Mm?: string } | undefined
  const mmTag = tags?.MM ?? tags?.Mm
  if (!mmTag) {
    return mods
  }
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const cigarOps = parseCigar2(cigar)
  const modifications = getModPositions(mmTag, seq, fstrand)
  const probabilities = getModProbabilities(feature)
  const modData: ParsedModData = {
    modifications,
    probabilities,
    cigarOps,
    seq,
    fstrand,
    flen: feature.get('end') - feature.get('start'),
  }
  extractMethylation(
    feature.id(),
    feature.get('start'),
    fstrand,
    regionStart,
    regionEnd,
    modData,
    mods,
  )
  return mods
}

describe('extractMethylation', () => {
  test('detects CpG sites at correct reference positions', () => {
    const mods = run(makeMethFeature(), 100, 110)
    const methEntries = mods.filter(m => m.modType === 'm')
    expect(methEntries.length).toBe(2)
    expect(methEntries[0]!.position).toBe(102)
    expect(methEntries[1]!.position).toBe(106)
  })

  test('high probability CpG colored red, low probability colored blue', () => {
    const mods = run(makeMethFeature(), 100, 110)
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

  test('non-CpG read positions are skipped', () => {
    // Cs at positions 2 and 6, but next bases are A and A — not CpG context
    const feature = new SimpleFeature({
      uniqueId: 'nocpg',
      refName: 'ctgA',
      start: 100,
      end: 110,
      strand: 1,
      CIGAR: '10M',
      seq: 'AACAATCAAA',
      tags: { MM: 'C+m,0,0;', ML: [230, 50] },
    })
    const mods = run(feature, 100, 110)
    expect(mods.length).toBe(0)
  })

  test('CpG sites without modification data are skipped', () => {
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
    const mods = run(feature, 100, 110)
    expect(mods.length).toBe(0)
  })

  test('only processes positions within region bounds', () => {
    const mods = run(makeMethFeature(), 100, 105)
    const methEntries = mods.filter(m => m.modType === 'm')
    expect(methEntries.length).toBe(1)
    expect(methEntries[0]!.position).toBe(102)
  })

  test('no hydroxymethylation entries when no hydroxy data present', () => {
    const mods = run(makeMethFeature(), 100, 110)
    expect(mods.filter(m => m.modType === 'h').length).toBe(0)
  })

  test('hydroxymethylation entries at same C position as methylation', () => {
    const feature = makeMethFeature({
      MM: 'C+m,0,0;C+h,0,0;',
      ML: [230, 50, 200, 40],
    })
    const mods = run(feature, 100, 110)
    const hydroxyEntries = mods.filter(m => m.modType === 'h')
    expect(hydroxyEntries.length).toBe(2)
    expect(hydroxyEntries[0]!.position).toBe(102)
    expect(hydroxyEntries[1]!.position).toBe(106)
  })

  test('reverse strand reads detect CpG at G position in reference', () => {
    // Reverse strand read covering ref 100-110.
    // Reference: AACGATCGAA — CpGs at 102-103 and 106-107.
    // Read seq (5'→3'): TTCGATCGTT (revcomp of reference segment).
    // getMethBins uses revcom(seq) = AACGATCGAA to find Cs, checks next base
    // for G. Stores methylation at G positions in ref coords (offsets 3 and 7)
    // → genomicPos 103 and 107.
    const feature = new SimpleFeature({
      uniqueId: 'rev1',
      refName: 'ctgA',
      start: 100,
      end: 110,
      strand: -1,
      CIGAR: '10M',
      seq: 'TTCGATCGTT',
      tags: { MM: 'C+m,0,0;', ML: [230, 50] },
    })
    const mods = run(feature, 100, 110)
    const methEntries = mods.filter(m => m.modType === 'm')
    expect(methEntries.length).toBe(2)
    expect(methEntries[0]!.position).toBe(103)
    expect(methEntries[1]!.position).toBe(107)
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
    const mods = run(feature, 100, 110)
    expect(mods.length).toBe(0)
  })
})
