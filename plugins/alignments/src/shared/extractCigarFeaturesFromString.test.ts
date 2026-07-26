import { SimpleFeature } from '@jbrowse/core/util'

import { extractCigarFeaturesFromString } from './extractCigarFeatures.ts'

import type { CigarEmitOutput } from './extractCigarFeatures.ts'

function emptyOutput(): CigarEmitOutput {
  return {
    gaps: [],
    mismatches: [],
    insertions: [],
    softclips: [],
    hardclips: [],
  }
}

// A synteny/PAF feature carries its alignment as a CIGAR string and has no
// forEachMismatch, so before this it contributed no indels at all and a whole
// assembly alignment drew as one plain block.
function run(cigar: string, start = 1000, windowed = false) {
  const output = emptyOutput()
  const feature = new SimpleFeature({
    uniqueId: 'f1',
    refName: 'chr1',
    start,
    end: start + 100,
    strand: 1,
    CIGAR: cigar,
  })
  extractCigarFeaturesFromString(
    feature,
    cigar,
    0,
    start,
    1,
    output,
    false,
    windowed ? start + 40 : undefined,
    windowed ? start + 60 : undefined,
  )
  return output
}

test('an insertion in a CIGAR string lands at its reference position', () => {
  const { insertions, gaps } = run('10M5I10M')
  expect(insertions).toHaveLength(1)
  expect(insertions[0]!.position).toBe(1010)
  expect(insertions[0]!.length).toBe(5)
  expect(gaps).toHaveLength(0)
})

test('a deletion becomes a gap spanning the reference it skips', () => {
  const { gaps } = run('10M20D10M')
  expect(gaps).toHaveLength(1)
  expect(gaps[0]!.type).toBe('deletion')
  expect(gaps[0]!.start).toBe(1010)
  expect(gaps[0]!.end).toBe(1030)
})

test('an N op is a skip, not a deletion', () => {
  const { gaps } = run('10M20N10M')
  expect(gaps[0]!.type).toBe('skip')
})

// A CIGAR alone states no bases, so there is nothing to compare against the
// reference — the no-sequence walk emits structure only.
test('states no mismatches, since a CIGAR carries no bases', () => {
  const { mismatches } = run('10M5I10M20D10M')
  expect(mismatches).toHaveLength(0)
})

test('an insertion 100 kb long keeps its length', () => {
  const { insertions } = run('10M113174I10M')
  expect(insertions[0]!.length).toBe(113174)
})

// Whole-chromosome contig alignments are the reason the window exists: only the
// visible slice of the CIGAR is walked. Insertions consume no reference, so the
// two here sit at roffset 10 and 50 — the window is 40..60.
test('ops outside the window are skipped', () => {
  const { insertions } = run('10M5I40M7I20M', 1000, true)
  expect(insertions.map(i => i.length)).toEqual([7])
})

test('an empty CIGAR (a PIF coarse-tier feature) emits nothing', () => {
  const output = run('')
  expect(output.insertions).toHaveLength(0)
  expect(output.gaps).toHaveLength(0)
})
