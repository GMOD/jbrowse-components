import type { SyntenyColorBy } from './colorUtils.ts'

// One table for both views. They had a copy each and the help text had already
// drifted — dotplot's Default said "black" and synteny's said "red", both
// correct for their own renderer — so the wording that differs is a field
// rather than a reason to keep two tables.
export const VALUE_MODES_LABEL = 'Color by value'

// A mode is `structural` (what an alignment is: its strand, its track, which
// sequence it lies on) or a `value` (a number it carries, painted on a ramp).
// The palette menu lists the first kind at its top level and folds the second
// under one "Color by value" submenu beside the columns a track declares.
export const COLOR_MODES: {
  value: SyntenyColorBy
  label: string
  kind: 'structural' | 'value'
  helpText: string
  pointBasedHelpText?: string
}[] = [
  {
    value: 'default',
    kind: 'structural',
    label: 'Default',
    helpText:
      'Default ribbon color (red) with CIGAR operation coloring — insertions, deletions, and skips drawn in distinct colors over the alignment.',
    pointBasedHelpText:
      'Draw all alignments in black, the conventional dotplot line color.',
  },
  {
    value: 'strand',
    kind: 'structural',
    label: 'Strand',
    helpText:
      'Color alignments by strand orientation. Forward and reverse strand alignments use different colors, making inversions and strand-specific patterns easy to spot.',
  },
  {
    value: 'track',
    kind: 'structural',
    label: 'Distinct color per track',
    helpText:
      'Auto-palettize: hand every overlaid track its own color from a palette, so several alignment files drawn in the same plot can be told apart at a glance. Pin any individual color under "Customize per track".',
  },
  {
    value: 'query',
    kind: 'structural',
    label: 'Query',
    helpText:
      "Color by the query sequence (this assembly's own refName). Each unique sequence gets a consistent color, making it easy to distinguish different contigs/chromosomes.",
  },
  {
    value: 'target',
    kind: 'structural',
    label: 'Target',
    helpText:
      "Color by the target/mate sequence (the other assembly's refName). The complement of Query coloring — useful when one query maps across several targets.",
  },
  {
    value: 'reference',
    kind: 'structural',
    label: 'Reference',
    helpText:
      "Color every level by the shared reference assembly's chromosome names, so a region keeps one consistent color as it's traced across all levels of a stacked multi-genome view.",
  },
  {
    value: 'identity',
    kind: 'value',
    label: 'Identity',
    helpText:
      'Color by per-alignment sequence identity on a perceptually-uniform viridis scale: low identity is dark purple, high identity is bright yellow. Useful for distinguishing divergent vs conserved regions.',
  },
  {
    value: 'mappingQuality',
    kind: 'value',
    label: 'Mapping quality',
    helpText:
      'Color by per-alignment PAF mapping quality (MAPQ, 0–60) on a perceptually-uniform cividis scale: low MAPQ dark blue, high MAPQ yellow. Highlights ambiguous or multi-mapping regions.',
  },
  {
    value: 'dnds',
    kind: 'value',
    label: 'dN/dS',
    helpText:
      'Color by the ratio of non-synonymous to synonymous substitution rate, on a diverging blue–yellow–red scale pivoted at 1: blue below is purifying selection, the pale middle is neutral, red above is positive selection (clamped at 2). Needs an ortholog table carrying dN and dS per link.',
  },
]
