// Single source of truth for the conservation-band resolution modes: [value,
// menu label]. The state enumeration derives its valid values and the track
// menu derives its radio items, so the two can't drift. Mirrors
// `rowIdentityModes.ts`.
export const CONSERVATION_MODES = [
  ['base', 'Per-base (% identity)'],
  ['codon', 'Per-codon (amino-acid identity)'],
] as const

export const CONSERVATION_MODE_VALUES = CONSERVATION_MODES.map(
  ([value]) => value,
)

/** Conservation band resolution: nucleotide identity vs amino-acid identity. */
export type ConservationMode = (typeof CONSERVATION_MODES)[number][0]
