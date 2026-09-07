import {
  CIGAR_OP_D,
  CIGAR_OP_I,
  CIGAR_OP_N,
  NO_CIGAR_OPS,
  colorByFallbackNote,
  getColorBySwatch,
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

// A text column keys one chip per label, the file color where the file gave
// one, and past the readable cap it says how many it left out.
test('a categorical attribute lists a chip per label', () => {
  const swatch = getColorBySwatch('attribute:group', {
    attributeRanges: {
      group: { labels: ['B1', 'A1a'], colors: { A1a: '#4DB5E3' } },
    },
  })
  expect(swatch?.kind).toBe('chips')
  if (swatch?.kind === 'chips') {
    expect(swatch.chips.map(c => c.label)).toEqual(['B1', 'A1a'])
    expect(swatch.chips[1]!.color).toBe('#4DB5E3')
    expect(swatch.chips[0]!.color).toBeDefined()
  }
  const many = getColorBySwatch('attribute:group', {
    attributeRanges: {
      group: {
        labels: Array.from({ length: 35 }, (_, i) => `L${i}`),
        colors: {},
      },
    },
  })
  if (many?.kind === 'chips') {
    expect(many.chips.length).toBe(31)
    expect(many.chips[30]).toEqual({ label: '+5 more' })
  }
})
