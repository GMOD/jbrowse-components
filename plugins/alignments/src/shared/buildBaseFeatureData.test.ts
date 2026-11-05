import { SimpleFeature } from '@jbrowse/core/util'

import { buildBaseFeatureData } from './buildBaseFeatureData.ts'

describe('buildBaseFeatureData', () => {
  test('defaults insertSize to 0 (SAM unset) when template_length missing', () => {
    const feature = new SimpleFeature({
      uniqueId: 'r-tlen-missing',
      refName: 'ctgA',
      start: 0,
      end: 10,
      strand: 1,
      flags: 0,
    })
    expect(buildBaseFeatureData(feature, false).insertSize).toBe(0)
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
    expect(buildBaseFeatureData(feature, false).mapq).toBe(37)
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
    expect(buildBaseFeatureData(feature, false).mapq).toBe(255)
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
    expect(buildBaseFeatureData(feature, false).mapq).toBe(255)
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
    })
    const data = buildBaseFeatureData(feature, false)
    expect(data.id).toBe('r9')
    expect(data.start).toBe(500)
    expect(data.end).toBe(600)
    expect(data.flags).toBe(147)
    expect(data.mapq).toBe(42)
    expect(data.insertSize).toBe(350)
    expect(data.strand).toBe(-1)
  })

  // With numeric keys, `id` is the record id rather than the string — the whole
  // point of shipping keys. A feature with no `recordId` still yields its id
  // string, so a mixed set stays honest and `buildReadKeys` falls back.
  test('carries the record id as the key when keys are numeric', () => {
    const feature = new SimpleFeature({
      uniqueId: '4096',
      refName: 'ctgA',
      start: 0,
      end: 10,
      strand: 1,
      flags: 0,
    })
    Object.defineProperty(feature, 'recordId', { value: 4096 })
    expect(buildBaseFeatureData(feature, true).id).toBe(4096)
    expect(buildBaseFeatureData(feature, false).id).toBe('4096')
  })
})
