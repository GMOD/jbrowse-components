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
  helpText?: string
  surfaceHelpText?: Partial<Record<ColorModeSurface, string>>
  /** what the alignments need to carry the field, said on its disabled row */
  needs?: string
  /** the surfaces whose data can carry the field; unset is every one */
  surfaces?: ColorModeSurface[]
}

export const COLOR_MODES: ColorModeEntry[] = [
  {
    field: undefined,
    kind: 'structural',
    label: 'Default',
  },
  {
    field: 'strand',
    kind: 'structural',
    label: 'Strand',
    surfaceHelpText: {
      lanes:
        "Each ribbon by the record's strand against the lane above, so a lane drawn flipped still shows its inversions.",
    },
  },
  {
    field: 'track',
    kind: 'structural',
    label: 'Distinct color per track',
  },
  {
    field: 'query',
    kind: 'structural',
    label: 'Query',
    helpText: 'One color per sequence on this side.',
    surfaceHelpText: {
      points: 'One color per X-axis sequence.',
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
      'One color per reference chromosome, the same on every level of the stack.',
  },
  {
    field: 'identity',
    kind: 'value',
    label: 'Identity',
    needs: 'a CIGAR with =/X or a de tag',
  },
  {
    field: 'mapq',
    kind: 'value',
    label: 'Mapping quality',
  },
  {
    field: 'dnds',
    kind: 'value',
    label: 'dN/dS',
    needs: 'dn and ds columns',
  },
  {
    field: 'syntenicDepth',
    kind: 'value',
    label: 'Syntenic depth',
    needs: 'an MCScan .anchors or .blocks file',
    surfaces: ['ribbons', 'points'],
  },
]
