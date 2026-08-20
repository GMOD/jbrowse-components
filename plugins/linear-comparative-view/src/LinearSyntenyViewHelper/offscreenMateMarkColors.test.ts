import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import { paletteColorAt } from '@jbrowse/synteny-core'

import { offscreenMateMarkColorFor } from './offscreenMateMarkColors.ts'

import type { SyntenyColorBy } from '@jbrowse/synteny-core'

const ORDER = ['chr1', 'chr2', 'chr3', 'chr4', 'chr5', 'chr6', 'chr7']

function level(...modes: SyntenyColorBy[]) {
  return {
    linearSyntenyDisplays: modes.map(effectiveColorBy => ({
      effectiveColorBy,
      paintedChromosomeOrder: ORDER,
    })),
  }
}

// A top-strip mark sits on the query row and names a TARGET contig, so it is
// only in the ribbons' own key when the level paints by target name.
test('a lane is colored when the ribbons are keyed by the axis it names', () => {
  expect(offscreenMateMarkColorFor(level('target'), 'top')).toBeDefined()
  expect(offscreenMateMarkColorFor(level('query'), 'bottom')).toBeDefined()
})

test('and grey when they are keyed by the axis it merely sits on', () => {
  expect(offscreenMateMarkColorFor(level('query'), 'top')).toBeUndefined()
  expect(offscreenMateMarkColorFor(level('target'), 'bottom')).toBeUndefined()
})

test('and grey against a mode with no per-contig key at all', () => {
  for (const mode of ['default', 'strand', 'identity', 'track'] as const) {
    expect(offscreenMateMarkColorFor(level(mode), 'top')).toBeUndefined()
  }
})

// The strip is one object across the level's tracks; half-colored reads as two
// kinds of mark.
test('one track disagreeing greys the whole strip', () => {
  expect(
    offscreenMateMarkColorFor(level('target', 'strand'), 'top'),
  ).toBeUndefined()
})

test('a level with no displays is grey rather than colored by nothing', () => {
  expect(offscreenMateMarkColorFor(level(), 'top')).toBeUndefined()
})

// The point of routing through synteny-core rather than picking a palette here:
// a mark and the ribbons to the contig it names have to be the same hue, or the
// color says two things.
test('a mark takes its contig its own ribbon color, at the mark alpha', () => {
  const color = offscreenMateMarkColorFor(level('target'), 'top')!
  const ribbon = abgrToCssRgba(paletteColorAt(ORDER.indexOf('chr4')))
  const [r, g, b] = /rgba?\(([^)]*)\)/.exec(ribbon)![1]!.split(',')
  expect(color('chr4')).toBe(
    `rgba(${Number(r)}, ${Number(g)}, ${Number(b)}, 0.35)`,
  )
})

test('two contigs get two colors, and one contig one color', () => {
  const color = offscreenMateMarkColorFor(level('target'), 'top')!
  expect(color('chr2')).not.toBe(color('chr5'))
  expect(color('chr2')).toBe(color('chr2'))
})

// A contig the assembly does not list (a scaffold under an alias, an assembly
// still loading) still gets a stable color rather than none — the same hash
// fallback the ribbons take.
test('a contig outside the order still gets a stable color', () => {
  const color = offscreenMateMarkColorFor(level('target'), 'top')!
  expect(color('scaffold_913')).toBe(color('scaffold_913'))
  expect(color('scaffold_913')).toMatch(/^rgba\(/)
})
