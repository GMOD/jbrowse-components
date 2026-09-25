// [value, menu label]: the config enumeration and the radio both derive from it.
export const CONSERVATION_MODES = [
  ['base', 'Per-base (% identity)'],
  ['codon', 'Per-codon (amino-acid identity)'],
] as const

export const CONSERVATION_MODE_VALUES = CONSERVATION_MODES.map(
  ([value]) => value,
)

/** Conservation band resolution: nucleotide identity vs amino-acid identity. */
export type ConservationMode = (typeof CONSERVATION_MODES)[number][0]
