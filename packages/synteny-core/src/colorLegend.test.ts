import {
  CIGAR_OP_D,
  CIGAR_OP_I,
  CIGAR_OP_N,
  NO_CIGAR_OPS,
  colorByFallbackNote,
  getColorBySwatch,
  trackLegendChips,
} from './colorLegend.ts'

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
  const none = getColorBySwatch('default', { cigarOps: NO_CIGAR_OPS })
  if (none?.kind === 'chips') {
    expect(none.chips.map(c => c.label)).toEqual(['match'])
  }
  const insertionOnly = getColorBySwatch('default', { cigarOps: CIGAR_OP_I })
  if (insertionOnly?.kind === 'chips') {
    expect(insertionOnly.chips.map(c => c.label)).toEqual([
      'match',
      'insertion',
    ])
  }
  const withSkip = getColorBySwatch('strand', {
    cigarOps: CIGAR_OP_D | CIGAR_OP_N,
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

// 'track' has no fixed legend of its own — the track list only the view knows
// supplies it, so an absent list means the mode falls back to its note.
test("colorBy:'track' renders the chips the view supplies, or nothing", () => {
  expect(getColorBySwatch('track')).toBeUndefined()
  expect(getColorBySwatch('track', { trackChips: [] })).toBeUndefined()

  const chips = [
    { color: '#4e79a7', label: 'hg38 vs mm39' },
    { color: '#f28e2c', label: 'hg38 vs rn7' },
  ]
  const swatch = getColorBySwatch('track', { trackChips: chips })
  expect(swatch).toEqual({ kind: 'chips', chips })
})

test('the fallback note names what the mode is actually doing', () => {
  expect(colorByFallbackNote('track')).toBe('Distinct color per track')
  expect(colorByFallbackNote('query')).toBe('Distinct color per sequence')
})

describe('trackLegendChips', () => {
  const tracks = [
    { name: 'a', colorBy: 'track' as const, trackColor: '#111111' },
    { name: 'b', colorBy: 'identity' as const, trackColor: '#222222' },
  ]

  test('uniform track mode lists every track with its color', () => {
    const uniform = [
      tracks[0]!,
      { name: 'b', colorBy: 'track' as const, trackColor: '#222222' },
    ]
    expect(trackLegendChips(uniform, 'track')).toEqual([
      { color: '#111111', label: 'a' },
      { color: '#222222', label: 'b' },
    ])
  })

  // A track on a ramp has no single color to show, so its row names the mode
  // and leaves the swatch empty rather than inventing a representative color.
  test('mixed modes name each track and only swatch the flat ones', () => {
    expect(trackLegendChips(tracks, undefined)).toEqual([
      { color: '#111111', label: 'a — Track' },
      { color: undefined, label: 'b — Identity' },
    ])
  })

  test('any other uniform mode has its own legend and adds no rows', () => {
    expect(trackLegendChips(tracks, 'strand')).toEqual([])
  })
})
