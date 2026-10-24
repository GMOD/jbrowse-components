export const VALUE_MODES_LABEL = 'Color by value'

/** what draws the alignments: synteny ribbons, dotplot points, or ribbons between multi-way lanes */
export type ColorModeSurface = 'ribbons' | 'points' | 'lanes'

/** what a view carrying `TrackColorsMixin` draws; lanes are a display's */
export type SyntenyColorSurface = Exclude<ColorModeSurface, 'lanes'>

/**
 * One radio of the Color by menu, keyed by the field it writes; undefined is
 * the default color. A `structural` field is what an alignment is (its strand,
 * its track, the sequence it lies on) and sits at the menu's top level; a
 * `value` is a measurement on a preset ramp, folded under "Color by value"
 * beside the columns a track declares.
 */
export interface ColorModeEntry {
  field: string | undefined
  kind: 'structural' | 'value'
  label: string
  helpText: string
  surfaceHelpText?: Partial<Record<ColorModeSurface, string>>
  /** the surfaces whose data can carry the field; unset is every one */
  surfaces?: ColorModeSurface[]
}

export const COLOR_MODES: ColorModeEntry[] = [
  {
    field: undefined,
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
      'Forward and reverse alignments in two colors, so an inversion shows as the other color.',
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
      'Sequence identity, red for divergent through grey to blue for identical, as the MAF track paints it. Needs a CIGAR with =/X or a de tag.',
  },
  {
    field: 'mapq',
    kind: 'value',
    label: 'Mapping quality',
    helpText:
      'MAPQ in the bins aligners are filtered at, 0, 1-9, 10-29 and 30+, dark to light.',
  },
  {
    field: 'dnds',
    kind: 'value',
    label: 'dN/dS',
    helpText:
      'Blue below 1 is purifying selection, red above it positive, clamped at 2. Needs dn and ds columns.',
  },
  {
    field: 'syntenicDepth',
    kind: 'value',
    label: 'Syntenic depth',
    helpText:
      'Grey for a one-to-one ortholog, orange where several genes share one, often a tandem array. Counted over the whole MCScan .anchors or .blocks file, so a gene sharing with one off screen still takes color.',
    surfaces: ['ribbons', 'points'],
  },
]
