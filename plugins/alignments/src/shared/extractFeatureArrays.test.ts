import { SimpleFeature } from '@jbrowse/core/util'

import { extractFeatureArrays } from './extractFeatureArrays.ts'

import type { ColorBy } from './types.ts'
import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'

const region: Region = {
  refName: 'ctgA',
  start: 0,
  end: 50000,
  assemblyName: 'volvox',
}

// Shaped after the SyntenyFeature the PAF/PIF adapters emit (see
// comparative-adapters' util.ts): a `mate` naming this block's position in the
// other assembly, a CIGAR string, and no forEachMismatch.
function syntenyFeature(refName: string, mateRefName: string) {
  return new SimpleFeature({
    uniqueId: `${refName}-${mateRefName}`,
    refName,
    start: 100,
    end: 200,
    strand: 1,
    type: 'match',
    CIGAR: '100M',
    mate: {
      refName: mateRefName,
      start: 300,
      end: 400,
      assemblyName: 'volvox_random',
    },
  })
}

function bamRead(nextRef: string) {
  return new SimpleFeature({
    uniqueId: `read-${nextRef}`,
    refName: 'ctgA',
    start: 100,
    end: 200,
    strand: 1,
    next_ref: nextRef,
  })
}

const buildFeatureData = (f: Feature): FeatureData => ({
  id: f.id(),
  name: '',
  start: f.get('start'),
  end: f.get('end'),
  flags: 0,
  mapq: 0,
  insertSize: 0,
  pairOrientation: 0,
  strand: f.get('strand') ?? 0,
})

function extract(features: Feature[], colorBy: ColorBy) {
  return extractFeatureArrays(features, buildFeatureData, {
    colorBy,
    showSoftClipping: false,
    region,
  })
}

describe('mateRefName extraction', () => {
  test('a synteny block reports the refName it aligns to in the other assembly', () => {
    expect(
      extract(
        [syntenyFeature('ctgA', 'ctgB'), syntenyFeature('ctgA', 'ctgC')],
        { type: 'mateRefName' },
      ).tagColorValues,
    ).toEqual(['ctgB', 'ctgC'])
  })

  test('a BAM read falls back to its mate reference', () => {
    expect(
      extract([bamRead('ctgB')], { type: 'mateRefName' }).tagColorValues,
    ).toEqual(['ctgB'])
  })

  test('a feature with neither mate nor next_ref reports no name', () => {
    expect(
      extract([bamRead('')], { type: 'mateRefName' }).tagColorValues,
    ).toEqual([''])
  })

  // The channel is shared with tag coloring, so it must stay empty for every
  // other scheme — a stray value would bake a color over the shader's own.
  test('the channel is empty under other color schemes', () => {
    expect(
      extract([syntenyFeature('ctgA', 'ctgB')], { type: 'strand' })
        .tagColorValues,
    ).toEqual([])
  })
})
