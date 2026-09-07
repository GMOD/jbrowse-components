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
      'The default red ribbon, with insertions, deletions and skips in their own colors.',
    pointBasedHelpText: 'Every alignment in black.',
  },
  {
    value: 'strand',
    kind: 'structural',
    label: 'Strand',
    helpText:
      'Forward and reverse alignments in different colors, so a twisted ribbon reads as an inversion.',
  },
  {
    value: 'track',
    kind: 'structural',
    label: 'Distinct color per track',
    helpText:
      'Every overlaid track its own palette color. Pin one under Track colors.',
  },
  {
    value: 'query',
    kind: 'structural',
    label: 'Query',
    helpText:
      'One color per sequence on this side, so contigs can be told apart.',
  },
  {
    value: 'target',
    kind: 'structural',
    label: 'Target',
    helpText: 'One color per sequence on the other side.',
  },
  {
    value: 'reference',
    kind: 'structural',
    label: 'Reference',
    helpText:
      'One color per reference chromosome, kept the same on every level of the stack.',
  },
  {
    value: 'identity',
    kind: 'value',
    label: 'Identity',
    helpText:
      'Sequence identity on a viridis ramp, dark for divergent and yellow for identical. Needs a CIGAR with =/X or a de tag.',
  },
  {
    value: 'mappingQuality',
    kind: 'value',
    label: 'Mapping quality',
    helpText: 'MAPQ 0 to 60 on a cividis ramp.',
  },
  {
    value: 'dnds',
    kind: 'value',
    label: 'dN/dS',
    helpText:
      'Blue below 1 is purifying selection, red above it positive, clamped at 2. Needs dn and ds columns.',
  },
]
