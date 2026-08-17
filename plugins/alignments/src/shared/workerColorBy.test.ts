import { CIGAR_M } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { COLOR_SCHEMES, workerColorBy } from './colorSchemes.ts'
import { extractFeatureArrays } from './extractFeatureArrays.ts'

import type { ColorBy, ColorSchemeType } from './types.ts'
import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'

const region: Region = {
  refName: 'ctgA',
  start: 100,
  end: 120,
  assemblyName: 'volvox',
}

// A read that would trigger EVERY extraction path if its scheme asked for one:
// MM/ML tags (modifications), a base-quality array, a sequence, a categorical
// tag, and a mate reference. So a scheme that extracts nothing here extracts
// nothing at all.
function makeFeature() {
  return new SimpleFeature({
    uniqueId: 'r1',
    refName: 'ctgA',
    start: 100,
    end: 104,
    strand: 1,
    CIGAR: '4M',
    // the numeric forms the per-base extractors walk (packed len<<4 | opcode)
    NUMERIC_CIGAR: [(4 << 4) | CIGAR_M],
    NUMERIC_QUAL: Uint8Array.of(20, 30, 40, 10),
    seq: 'CGAG',
    next_ref: 'ctgB',
    next_pos: 500,
    tags: { MM: 'C+m,0;A+a,0;', ML: [230, 50], HP: '1' },
  })
}

const buildFeatureData = (f: Feature): FeatureData => ({
  id: f.id(),
  start: f.get('start'),
  end: f.get('end'),
  flags: 0,
  mapq: 0,
  insertSize: 0,
  pairOrientation: 0,
  strand: f.get('strand') ?? 0,
})

// Everything the worker's extraction produces that depends on colorBy. The
// reference sequence is supplied so the bisulfite path can run.
function extracted(colorBy: ColorBy | undefined) {
  const out = extractFeatureArrays([makeFeature()], buildFeatureData, {
    colorBy,
    showSoftClipping: false,
    region,
    // lowercased: extractBisulfite compares read bases against a lowercase ref
    regionSequence: 'cgagcgagcgagcgagcgag',
    regionSequenceStart: 100,
  })
  return {
    modifications: out.modifications,
    perBaseQualities: out.perBaseQualities,
    perBaseLetters: out.perBaseLetters,
    tagColorValues: out.tagColorValues,
  }
}

// A scheme with no worker-side extraction must produce byte-identical output to
// no scheme at all — that is exactly the condition under which `workerColorBy`
// may collapse it and skip the refetch.
const baseline = JSON.stringify(extracted(undefined))

const sample: Record<ColorSchemeType, ColorBy> = {
  normal: { type: 'normal' },
  strand: { type: 'strand' },
  mappingQuality: { type: 'mappingQuality' },
  perBaseQuality: { type: 'perBaseQuality' },
  perBaseLetter: { type: 'perBaseLetter' },
  insertSize: { type: 'insertSize' },
  firstOfPairStrand: { type: 'firstOfPairStrand' },
  pairOrientation: { type: 'pairOrientation' },
  insertSizeAndOrientation: { type: 'insertSizeAndOrientation' },
  tag: { type: 'tag', tag: 'HP' },
  mateRefName: { type: 'mateRefName' },
  modifications: { type: 'modifications' },
  bisulfite: { type: 'bisulfite' },
}

describe('workerColorBy', () => {
  // The oracle for the `workerExtracts` registry flag: rather than re-spelling
  // the list, run the worker's extraction under every registered scheme and
  // compare it to running with no scheme. Declaring a scheme shader-only when
  // it does extract would render stale data on the switch into it; declaring an
  // extracting scheme shader-only would cost a refetch it doesn't need.
  test.each(Object.keys(COLOR_SCHEMES) as ColorSchemeType[])(
    '%s: the workerExtracts flag matches what the worker extracts',
    type => {
      const differs = JSON.stringify(extracted(sample[type])) !== baseline
      expect(differs).toBe(!!COLOR_SCHEMES[type].workerExtracts)
    },
  )

  test('shader-only schemes collapse to one value, so switching them refetches nothing', () => {
    expect(workerColorBy({ type: 'strand' })).toBeUndefined()
    expect(workerColorBy({ type: 'mappingQuality' })).toBeUndefined()
    expect(workerColorBy({ type: 'insertSizeAndOrientation' })).toBeUndefined()
  })

  test('an extracting scheme passes through whole, config and all', () => {
    const colorBy: ColorBy = {
      type: 'modifications',
      modifications: { threshold: 42, cytosineContext: 'CHG' },
    }
    expect(workerColorBy(colorBy)).toBe(colorBy)
    expect(workerColorBy({ type: 'tag', tag: 'HP' })).toEqual({
      type: 'tag',
      tag: 'HP',
    })
  })
})
