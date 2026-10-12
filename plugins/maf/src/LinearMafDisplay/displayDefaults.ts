// Defaults shared by the state model and the track menu presets, in a module of
// their own to avoid a stateModel/trackMenuItems import cycle.
export const DEFAULTS = {
  // Px height of the "Normal" preset; the `rowHeight` property itself defaults
  // to 0 (fit to display height).
  rowHeight: 15,
  /**
   * Ceiling on the height a fresh track sizes itself to before any drag; past
   * it fit mode shrinks the rows instead of growing the track. 600 leaves every
   * common multiz (up to 40 species) at its natural height. A drag past it is
   * still honored.
   */
  maxAutoFitHeight: 600,
  rowProportion: 0.8,
  showAllLetters: false,
  showAsUpperCase: true,
  showTree: true,
  showRowLabels: true,
  showBranchLength: true,
  showCoverage: true,
  showAlignments: true,
  coverageHeight: 45,
  showConservation: false,
  conservationHeight: 40,
  conservationMode: 'base',
  rowIdentityAutoZoom: true,
  showAnnotations: false,
  showInversions: false,
  // On, so existing tracks keep drawing the row.
  showReferenceRow: true,
} as const

// Each preset pairs a row height with the glyph proportion that reads best at
// it; maf is the one display with this second axis.
export const HEIGHT_PRESETS = [
  { label: 'Normal', rowHeight: DEFAULTS.rowHeight, rowProportion: 0.8 },
  { label: 'Compact', rowHeight: 8, rowProportion: 0.9 },
]
