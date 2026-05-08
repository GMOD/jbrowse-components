import { SimpleFeature } from '@jbrowse/core/util'

import { buildBaseFeatureData } from './buildBaseFeatureData.ts'

describe('buildBaseFeatureData', () => {
  test('computes avgBaseQuality from NUMERIC_QUAL', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r1',
      refName: 'ctgA',
      start: 100,
      end: 110,
      strand: 1,
      name: 'read1',
      flags: 0,
      score: 60,
      NUMERIC_QUAL: new Uint8Array([30, 30, 30, 30, 30, 30, 30, 30, 30, 30]),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(30)
  })

  test('computes avgBaseQuality with mixed quality scores', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r2',
      refName: 'ctgA',
      start: 100,
      end: 105,
      strand: -1,
      name: 'read2',
      flags: 16,
      score: 40,
      NUMERIC_QUAL: new Uint8Array([10, 20, 30, 40, 50]),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(30)
  })

  test('defaults avgBaseQuality to 30 when NUMERIC_QUAL is undefined', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r3',
      refName: 'ctgA',
      start: 200,
      end: 300,
      strand: 1,
      name: 'read3',
      flags: 0,
      score: 60,
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(30)
  })

  test('defaults avgBaseQuality to 30 when NUMERIC_QUAL is empty', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r4',
      refName: 'ctgA',
      start: 200,
      end: 300,
      strand: 1,
      name: 'read4',
      flags: 0,
      score: 60,
      NUMERIC_QUAL: new Uint8Array(0),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(30)
  })

  test('handles high quality scores', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r5',
      refName: 'ctgA',
      start: 100,
      end: 104,
      strand: 1,
      name: 'read5',
      flags: 0,
      score: 60,
      NUMERIC_QUAL: new Uint8Array([40, 40, 40, 40]),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(40)
  })

  test('handles single-base read', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r6',
      refName: 'ctgA',
      start: 100,
      end: 101,
      strand: 1,
      name: 'read6',
      flags: 0,
      score: 60,
      NUMERIC_QUAL: new Uint8Array([15]),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(15)
  })

  test('rounds avgBaseQuality to nearest integer', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r7',
      refName: 'ctgA',
      start: 100,
      end: 103,
      strand: 1,
      name: 'read7',
      flags: 0,
      score: 60,
      NUMERIC_QUAL: new Uint8Array([10, 11, 12]),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(11)
  })

  test('works with number array instead of Uint8Array', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r8',
      refName: 'ctgA',
      start: 100,
      end: 103,
      strand: 1,
      name: 'read8',
      flags: 0,
      score: 60,
      NUMERIC_QUAL: [20, 30, 40],
    })
    const data = buildBaseFeatureData(feature)
    expect(data.avgBaseQuality).toBe(30)
  })

  test('mapq comes from feature score', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r-mapq',
      refName: 'ctgA',
      start: 0,
      end: 10,
      strand: 1,
      flags: 0,
      score: 37,
    })
    expect(buildBaseFeatureData(feature).mapq).toBe(37)
  })

  test('mapq defaults to 255 (SAM unavailable) when score is undefined', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r-mapq-missing',
      refName: 'ctgA',
      start: 0,
      end: 10,
      strand: 1,
      flags: 0,
    })
    expect(buildBaseFeatureData(feature).mapq).toBe(255)
  })

  test('mapq does not fall back to per-base qual field', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r-mapq-no-qual-fallback',
      refName: 'ctgA',
      start: 0,
      end: 10,
      strand: 1,
      flags: 0,
      qual: '30 30 30',
    })
    expect(buildBaseFeatureData(feature).mapq).toBe(255)
  })

  test('preserves all other FeatureData fields', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r9',
      refName: 'ctgA',
      start: 500,
      end: 600,
      strand: -1,
      name: 'myread',
      flags: 147,
      score: 42,
      template_length: 350,
      pair_orientation: 'FR',
      NUMERIC_QUAL: new Uint8Array([25, 25]),
    })
    const data = buildBaseFeatureData(feature)
    expect(data.id).toBe('r9')
    expect(data.name).toBe('myread')
    expect(data.start).toBe(500)
    expect(data.end).toBe(600)
    expect(data.flags).toBe(147)
    expect(data.mapq).toBe(42)
    expect(data.avgBaseQuality).toBe(25)
    expect(data.insertSize).toBe(350)
    expect(data.strand).toBe(-1)
  })
})
