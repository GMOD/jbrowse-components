import {
  CIGAR_OP_D,
  CIGAR_OP_I,
  CIGAR_OP_N,
  NO_CIGAR_OPS,
  colorByFallbackNote,
  colorByScale,
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

// The scale is the swatch spec in the vocabulary the shared key draws: a ramp
// keeps its own end labels through `format`, chips become entries composited
// by the view's alpha, and a mode with no fixed key is one note row.
test('colorByScale carries a ramp with its own end labels', () => {
  const scale = colorByScale('identity')
  expect(scale.kind).toBe('ramp')
  if (scale.kind === 'ramp') {
    expect(scale.title).toBe('Identity')
    expect(scale.domain).toEqual([0, 1])
    expect(scale.format!(0)).toBe('0%')
    expect(scale.format!(1)).toBe('100%')
    expect(scale.stops.length).toBeGreaterThan(2)
  }
})

test('colorByScale composites chips by alpha and notes the keyless modes', () => {
  const chips = colorByScale('default', { pointBased: true, alpha: 0.5 })
  expect(chips.kind).toBe('categorical')
  if (chips.kind === 'categorical') {
    expect(chips.entries.map(e => e.label)).toEqual(['alignment'])
    expect(chips.entries[0]!.color).toMatch(/^rgb\(/)
  }
  const query = colorByScale('query')
  if (query.kind === 'categorical') {
    expect(query.entries).toEqual([
      { value: 'note', label: colorByFallbackNote('query') },
    ])
  }
})
