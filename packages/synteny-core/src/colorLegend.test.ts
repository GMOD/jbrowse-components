import { NO_VALUE_LABEL } from '@jbrowse/core/util/categoricalField'
import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'

import {
  CIGAR_OP_D,
  CIGAR_OP_I,
  CIGAR_OP_N,
  NO_CIGAR_OPS,
  colorByFallbackNote,
  colorByScales,
  getColorBySwatch,
} from './colorLegend.ts'

test('continuous modes get a gradient ramp with bounded domain labels', () => {
  const identity = getColorBySwatch('identity')
  expect(identity?.kind).toBe('ramp')
  if (identity?.kind === 'ramp') {
    expect(identity.minLabel).toBe('0%')
    expect(identity.maxLabel).toBe('100%')
    expect(identity.stops.length).toBeGreaterThan(2)
  }

  const mapq = getColorBySwatch('mappingQual')
  if (mapq?.kind === 'ramp') {
    expect(mapq.maxLabel).toBe('60')
  }
})

// Default (no cigarOps) is the static menu preview: match + the two indel ops
// a typical alignment carries. The rare N (skip) op is opt-in.
test('default/strand modes show labeled chips including CIGAR indels', () => {
  const def = getColorBySwatch('')
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
  const none = getColorBySwatch('', { cigarOps: NO_CIGAR_OPS })
  if (none?.kind === 'chips') {
    expect(none.chips.map(c => c.label)).toEqual(['match'])
  }
  const insertionOnly = getColorBySwatch('', { cigarOps: CIGAR_OP_I })
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
  const def = getColorBySwatch('', { pointBased: true })
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
test("the 'track' field renders the chips the view supplies, or nothing", () => {
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
// one, the grey its unlabelled rows paint last where some row carried no
// label, and past the readable cap it says how many labels it left out.
test('a categorical attribute lists a chip per label', () => {
  const swatch = getColorBySwatch('group', {
    attributeRanges: {
      group: {
        labels: ['B1', 'A1a'],
        colors: { A1a: '#4DB5E3' },
        missing: true,
      },
    },
  })
  expect(swatch?.kind).toBe('chips')
  if (swatch?.kind === 'chips') {
    expect(swatch.chips.map(c => c.label)).toEqual([
      'B1',
      'A1a',
      NO_VALUE_LABEL,
    ])
    expect(swatch.chips.at(-1)).toEqual({
      color: NO_CATEGORY_COLOR,
      label: NO_VALUE_LABEL,
      missing: true,
    })
    expect(swatch.chips[1]!.color).toBe('#4DB5E3')
    expect(swatch.chips[0]!.color).toBeDefined()
  }
  const labels = Array.from({ length: 35 }, (_, i) => `L${i}`)
  const many = getColorBySwatch('group', {
    attributeRanges: {
      group: {
        labels,
        colors: Object.fromEntries(
          labels.map((l, i) => [
            l,
            `#${(i + 1).toString(16).padStart(6, '0')}`,
          ]),
        ),
        missing: true,
      },
    },
  })
  if (many?.kind === 'chips') {
    expect(many.chips.length).toBe(32)
    expect(many.chips[30]).toEqual({ label: '+5 more' })
    expect(many.chips[31]!.label).toBe(NO_VALUE_LABEL)
  }
})

// Every SyRI row carries a type, so nothing paints the unlabelled grey, and a
// grey row in the key would name a color beside SYN's that is not on screen.
test('a column every row labelled keys no unlabelled grey', () => {
  const swatch = getColorBySwatch('type', {
    attributeRanges: { type: { labels: ['SYN', 'INV'], colors: {} } },
  })
  expect(swatch?.kind === 'chips' && swatch.chips.map(c => c.label)).toEqual([
    'SYN',
    'INV',
  ])
})

// SyRI's palette, as plotsr draws it, paints an inverted duplication in the
// duplication color and an inverted translocation in the translocation one,
// so the key is one row per color naming both, as plotsr's is.
test('labels sharing a color are one chip naming each', () => {
  const colors = {
    SYN: '#c8c8c8',
    TRANS: '#9acd32',
    INVTR: '#9ACD32',
    DUP: '#00bbff',
    INVDP: '#00bbff',
  }
  const [scale] = colorByScales('type', {
    attributeRanges: {
      type: { labels: ['SYN', 'INVDP', 'TRANS', 'DUP', 'INVTR'], colors },
    },
    hideUnlabelled: true,
  })
  expect(scale!.kind === 'categorical' && scale!.entries).toEqual([
    expect.objectContaining({ value: 'SYN', label: 'SYN' }),
    expect.objectContaining({
      value: 'DUP',
      values: ['DUP', 'INVDP'],
      label: 'DUP, INVDP',
    }),
    expect.objectContaining({
      value: 'INVTR',
      values: ['INVTR', 'TRANS'],
      label: 'INVTR, TRANS',
    }),
  ])
})

// The scale is the swatch spec in the vocabulary the shared key draws: a ramp
// keeps its own end labels through `format`, chips become entries composited
// by the view's alpha, and a mode with no fixed key is one note row.
test('colorByScales carries a ramp with its own end labels', () => {
  const scales = colorByScales('identity')
  expect(scales).toHaveLength(1)
  const [scale] = scales
  expect(scale!.kind).toBe('ramp')
  if (scale!.kind === 'ramp') {
    expect(scale!.title).toBe('Identity')
    expect(scale!.domain).toEqual([0, 1])
    expect(scale!.format!(0)).toBe('0%')
    expect(scale!.format!(1)).toBe('100%')
    expect(scale!.stops.length).toBeGreaterThan(2)
  }
})

// A pair with no dN/dS paints the no-value grey every scale paints one in, and
// the key names it beside the ramp once some pair had none.
test('a ramp over rows with no value keys the color they paint', () => {
  const [, noValue] = colorByScales('dnds', {
    attributeRanges: { dnds: { min: 0.1, max: 3, missing: true } },
  })
  expect(noValue).toMatchObject({
    kind: 'categorical',
    entries: [{ label: NO_VALUE_LABEL, color: NO_CATEGORY_COLOR }],
  })
  expect(
    colorByScales('dnds', { attributeRanges: { dnds: { min: 0.1, max: 3 } } }),
  ).toHaveLength(1)
})

test('colorByScales composites chips by alpha and notes the keyless modes', () => {
  const [chips] = colorByScales('', { pointBased: true, alpha: 0.5 })
  expect(chips!.kind).toBe('categorical')
  if (chips!.kind === 'categorical') {
    expect(chips!.entries.map(e => e.label)).toEqual(['alignment'])
    expect(chips!.entries[0]!.color).toMatch(/^rgb\(/)
  }
  const [query] = colorByScales('query')
  if (query!.kind === 'categorical') {
    expect(query!.entries).toEqual([
      { value: 'note', label: colorByFallbackNote('query') },
    ])
  }
})
