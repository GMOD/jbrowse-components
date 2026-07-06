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
  if (mapq?.kind === 'ramp') {
    expect(mapq.maxLabel).toBe('60')
  }
})

// Default (no cigarOps) is the static menu preview: match + the two indel ops
// a typical alignment carries. The rare N (skip) op is opt-in.
test('default/strand modes show labeled chips including CIGAR indels', () => {
  const def = getColorBySwatch('default')
  expect(def?.kind).toBe('chips')
  if (def?.kind === 'chips') {
    expect(def.chips.map(c => c.label)).toEqual([
      'match',
      'insertion',
      'deletion',
    ])
  }
  const strand = getColorBySwatch('strand')
  if (strand?.kind === 'chips') {
    expect(strand.chips.map(c => c.label)).toEqual([
      'forward',
      'reverse',
      'insertion',
      'deletion',
    ])
  }
})

// The data-driven ribbon legend lists an indel chip only for ops actually
// painted on screen: no indels -> just the block/strand chips; N present ->
// a "skip" chip appears (unlike the static preview, which omits it).
test('cigarOps drives which indel chips the legend shows', () => {
  const none = getColorBySwatch('default', {
    cigarOps: { I: false, D: false, N: false },
  })
  if (none?.kind === 'chips') {
    expect(none.chips.map(c => c.label)).toEqual(['match'])
  }
  const insertionOnly = getColorBySwatch('default', {
    cigarOps: { I: true, D: false, N: false },
  })
  if (insertionOnly?.kind === 'chips') {
    expect(insertionOnly.chips.map(c => c.label)).toEqual(['match', 'insertion'])
  }
  const withSkip = getColorBySwatch('strand', {
    cigarOps: { I: false, D: true, N: true },
  })
  if (withSkip?.kind === 'chips') {
    expect(withSkip.chips.map(c => c.label)).toEqual([
      'forward',
      'reverse',
      'deletion',
      'skip',
    ])
  }
})

test('point-based views (pointBased) drop the CIGAR chips', () => {
  const def = getColorBySwatch('default', { pointBased: true })
  if (def?.kind === 'chips') {
    expect(def.chips.map(c => c.label)).toEqual(['alignment'])
    expect(def.chips[0]!.color).toBe('#000')
  }
  const strand = getColorBySwatch('strand', { pointBased: true })
  if (strand?.kind === 'chips') {
    expect(strand.chips.map(c => c.label)).toEqual(['forward', 'reverse'])
  }
})

test('per-name categorical modes have no fixed legend', () => {
  expect(getColorBySwatch('query')).toBeUndefined()
  expect(getColorBySwatch('target')).toBeUndefined()
})
