// [value, menu label]: the config enumeration and the radio both derive from it.
export const CONSERVATION_UNIT_OPTIONS = [
  ['base', 'Per-base (% identity)'],
  ['codon', 'Per-codon (amino-acid identity)'],
] as const

export const CONSERVATION_UNITS = CONSERVATION_UNIT_OPTIONS.map(
  ([value]) => value,
)

/** What one conservation bar stands for: nucleotide or amino-acid identity. */
export type ConservationUnit = (typeof CONSERVATION_UNIT_OPTIONS)[number][0]
