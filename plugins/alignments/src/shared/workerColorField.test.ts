import { CIGAR_M } from '@jbrowse/cigar-utils'
import { SimpleFeature } from '@jbrowse/core/util'

import { COLOR_FIELD_DEFS, workerColorField } from './colorFieldDefs.ts'
import { extractFeatureArrays } from './extractFeatureArrays.ts'
import { splitFieldForTest } from './splitFieldForTest.ts'

import type { ColorFieldKind } from './types.ts'
import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'

const region: Region = {
  refName: 'ctgA',
  start: 100,
  end: 120,
  assemblyName: 'volvox',
}

// A read that would trigger EVERY extraction path if its field asked for one:
// MM/ML tags (modifications), a base-quality array, a sequence, a categorical
// tag, and a mate reference. So a field that extracts nothing here extracts
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

// Everything the worker's extraction produces that depends on the color
// field. The reference sequence is supplied so the bisulfite path can run.
function extracted(field: string | undefined) {
  const out = extractFeatureArrays([makeFeature()], buildFeatureData, {
    ...splitFieldForTest(field),
    showSoftClips: false,
    region,
    perBaseBinBp: 1,
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

// A field with no worker-side extraction must produce byte-identical output to
// no field at all — that is exactly the condition under which
// `workerColorField` may collapse it and skip the refetch.
const baseline = JSON.stringify(extracted(undefined))

const sample: Record<ColorFieldKind, string | undefined> = {
  normal: undefined,
  strand: 'strand',
  mapq: 'mapq',
  baseQuality: 'baseQuality',
  base: 'base',
  firstOfPairStrand: 'firstOfPairStrand',
  pairOrientation: 'pairOrientation',
  insertSizeAndOrientation: 'insertSizeAndOrientation',
  tag: 'tags.HP',
  mateRefName: 'mateRefName',
  modifications: 'modifications',
  bisulfite: 'bisulfite',
}

describe('workerColorField', () => {
  // The oracle for the `workerExtracts` registry flag: rather than re-spelling
  // the list, run the worker's extraction under every registered field and
  // compare it to running with no field. Declaring a field shader-only when
  // it does extract would render stale data on the switch into it; declaring an
  // extracting field shader-only would cost a refetch it doesn't need.
  test.each(Object.keys(COLOR_FIELD_DEFS) as ColorFieldKind[])(
    '%s: the workerExtracts flag matches what the worker extracts',
    type => {
      const differs = JSON.stringify(extracted(sample[type])) !== baseline
      expect(differs).toBe(!!COLOR_FIELD_DEFS[type].workerExtracts)
    },
  )

  test('shader-only fields collapse to one value, so switching them refetches nothing', () => {
    expect(workerColorField(undefined)).toBeUndefined()
    expect(workerColorField('strand')).toBeUndefined()
    expect(workerColorField('mapq')).toBeUndefined()
    expect(workerColorField('insertSizeAndOrientation')).toBeUndefined()
  })

  test('an extracting field passes through', () => {
    expect(workerColorField('tags.HP')).toBe('tags.HP')
    expect(workerColorField('score')).toBe('score')
    expect(workerColorField('mateRefName')).toBe('mateRefName')
  })
})
