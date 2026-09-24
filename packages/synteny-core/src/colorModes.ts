export const VALUE_MODES_LABEL = 'Color by value'

/** what draws the alignments: synteny ribbons, dotplot points, or ribbons between multi-way lanes */
export type ColorModeSurface = 'ribbons' | 'points' | 'lanes'

/**
 * One radio of the Color by menu, keyed by the field it writes; `''` is the
 * default colour. A `structural` field is what an alignment is (its strand,
 * its track, the sequence it lies on) and sits at the menu's top level; a
 * `value` is a measurement on a preset ramp, folded under "Color by value"
 * beside the columns a track declares.
 */
export interface ColorModeEntry {
  field: string
  kind: 'structural' | 'value'
  label: string
  helpText: string
  surfaceHelpText?: Partial<Record<ColorModeSurface, string>>
}

export const COLOR_MODES: ColorModeEntry[] = [
  {
    field: '',
    kind: 'structural',
    label: 'Default',
    helpText:
      'The default red ribbon, with insertions, deletions and skips in their own colors.',
    surfaceHelpText: {
      points: 'Every alignment in black.',
      lanes: "Every ribbon in the track's ribbon color.",
    },
  },
  {
    field: 'strand',
    kind: 'structural',
    label: 'Strand',
    helpText:
      'Forward and reverse alignments in different colors, so a twisted ribbon reads as an inversion.',
    surfaceHelpText: {
      lanes:
        "Each ribbon by the record's strand against the lane above, so a lane drawn flipped still shows its inversions.",
    },
  },
  {
    field: 'track',
    kind: 'structural',
    label: 'Distinct color per track',
    helpText:
      'Every overlaid track its own palette color. Pin one under Track colors.',
  },
  {
    field: 'query',
    kind: 'structural',
    label: 'Query',
    helpText:
      'One color per sequence on this side, so contigs can be told apart.',
    surfaceHelpText: {
      points: 'One color per X-axis sequence, so contigs can be told apart.',
    },
  },
  {
    field: 'target',
    kind: 'structural',
    label: 'Target',
    helpText: 'One color per sequence on the other side.',
    surfaceHelpText: {
      points: 'One color per Y-axis sequence.',
    },
  },
  {
    field: 'reference',
    kind: 'structural',
    label: 'Reference',
    helpText:
      'One color per reference chromosome, kept the same on every level of the stack.',
  },
  {
    field: 'identity',
    kind: 'value',
    label: 'Identity',
    helpText:
      'Sequence identity on a viridis ramp, dark for divergent and yellow for identical. Needs a CIGAR with =/X or a de tag.',
  },
  {
    field: 'mappingQual',
    kind: 'value',
    label: 'Mapping quality',
    helpText: 'MAPQ 0 to 60 on a cividis ramp.',
  },
  {
    field: 'dnds',
    kind: 'value',
    label: 'dN/dS',
    helpText:
      'Blue below 1 is purifying selection, red above it positive, clamped at 2. Needs dn and ds columns.',
  },
]
