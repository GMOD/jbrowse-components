/**
 * What fills an aligned cell besides a constant: the mean identity to the
 * reference, or the rank of its block's source sequence within the row.
 */
export const MAF_COLOR_FIELDS = ['identity', 'refNameRank'] as const

export type MafColorField = (typeof MAF_COLOR_FIELDS)[number]

/** What the per-position layer paints: every base, or each codon's change. */
export const MAF_BASES_FIELDS = ['base', 'codon'] as const

export type MafBasesField = (typeof MAF_BASES_FIELDS)[number]

/** What a row's bar height carries, where the row is a bar chart. */
export const MAF_Y_FIELDS = ['identity'] as const

export type MafYField = (typeof MAF_Y_FIELDS)[number]

/** The Color by menu's fill rows, in menu order. */
export const MAF_COLOR_FIELD_LABELS = {
  identity: 'Identity to reference',
  refNameRank: 'Source sequence',
} as const satisfies Record<MafColorField, string>

/** The Color by menu's per-position rows, in menu order. */
export const MAF_BASES_FIELD_LABELS = {
  base: 'Every base',
  codon: 'Codon changes (amino acids)',
} as const satisfies Record<MafBasesField, string>

/**
 * What the rows draw now, the config's words with the view's overrides
 * applied, as alignments' `colorField`, `baseLayer` and `showMismatches`.
 */
export interface RowPlan {
  /** `bar` where `encoding.y` makes each row a bar chart */
  mark: 'rect' | 'bar'
  /** the field filling the cells or bars, undefined where a constant does */
  color: MafColorField | undefined
  mismatches: boolean
  bases: MafBasesField | undefined
  /** cells draw base by base, so letters, insertions and deletion counts draw */
  perBase: boolean
}

/**
 * The summary tier carries no bases, so its bars take the constant and no
 * layer draws. At base level a one-base identity is a match call the
 * mismatches already draw, so the identity fill and the X-Y plot yield to
 * the constant fill there, which also keeps base level to one walk of the
 * cells. Bars have no cells for a layer to draw over. The codon layer needs
 * reading frames and base level, and while it draws the mismatches do not, as
 * alignments' mismatches yield to a per-base layer.
 */
export function resolveRowPlan({
  field,
  y,
  mismatches,
  bases,
  summaryTier,
  baseLevel,
  hasFrames,
}: {
  field: MafColorField | undefined
  y: MafYField | undefined
  mismatches: boolean
  bases: MafBasesField | undefined
  summaryTier: boolean
  baseLevel: boolean
  hasFrames: boolean
}): RowPlan {
  if (summaryTier) {
    return {
      mark: 'rect',
      color: undefined,
      mismatches: false,
      bases: undefined,
      perBase: false,
    }
  }
  const mark = y && !baseLevel ? 'bar' : 'rect'
  const layer =
    mark === 'rect' && (bases !== 'codon' || (hasFrames && baseLevel))
      ? bases
      : undefined
  const drawsMismatches = mismatches && mark === 'rect' && layer === undefined
  return {
    mark,
    color: field === 'identity' && baseLevel ? undefined : field,
    mismatches: drawsMismatches,
    bases: layer,
    perBase: drawsMismatches || layer === 'base',
  }
}
