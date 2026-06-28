// Default values for LinearMafDisplay settings. Kept in its own module so both
// the state model (stripDefault seeds) and the track menu presets can reference
// them without a circular import between stateModel and trackMenuItems.
export const DEFAULTS = {
  rowHeight: 15,
  rowProportion: 0.8,
  showAllLetters: false,
  mismatchRendering: true,
  showAsUpperCase: true,
  showTree: true,
  showBranchLength: false,
  showCoverage: true,
  showAlignments: true,
  coverageHeight: 45,
  showConservation: false,
  conservationHeight: 40,
  rowIdentityMode: 'none',
  rowIdentityAutoZoom: true,
  showAnnotations: true,
  showTranslation: false,
} as const
