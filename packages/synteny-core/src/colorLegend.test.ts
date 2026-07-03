import { getColorBySwatch } from './colorLegend.ts'

test('continuous modes get a gradient ramp with bounded domain labels', () => {
  const identity = getColorBySwatch('identity')
  expect(identity?.kind).toBe('ramp')
  if (identity?.kind === 'ramp') {
    expect(identity.minLabel).toBe('0%')
    expect(identity.maxLabel).toBe('100%')
    expect(identity.background).toMatch(/^linear-gradient/)
  }

  const mapq = getColorBySwatch('mappingQuality')
  const meanMapq = getColorBySwatch('meanQueryMappingQuality')
  const diverging = getColorBySwatch('identityDiverging')
  if (mapq?.kind === 'ramp') {
    expect(mapq.maxLabel).toBe('60')
  }
  if (meanMapq?.kind === 'ramp') {
    expect(meanMapq.minLabel).toBe('weak')
  }
  if (diverging?.kind === 'ramp') {
    expect(diverging.minLabel).toBe('divergent')
  }
})

test('default/strand modes show labeled chips including CIGAR ops', () => {
  const def = getColorBySwatch('default')
  expect(def?.kind).toBe('chips')
  if (def?.kind === 'chips') {
    expect(def.chips.map(c => c.label)).toEqual([
      'match',
      'insertion',
      'deletion',
      'skip',
    ])
  }
  const strand = getColorBySwatch('strand')
  if (strand?.kind === 'chips') {
    expect(strand.chips.map(c => c.label)).toEqual([
      'forward',
      'reverse',
      'insertion',
      'del/skip',
    ])
  }
})

test('per-name categorical modes have no fixed legend', () => {
  expect(getColorBySwatch('query')).toBeUndefined()
  expect(getColorBySwatch('target')).toBeUndefined()
})
