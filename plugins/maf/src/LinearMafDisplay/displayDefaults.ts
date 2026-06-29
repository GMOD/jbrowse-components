// Default values for LinearMafDisplay settings. Kept in its own module so both
// the state model (stripDefault seeds) and the track menu presets can reference
// them without a circular import between stateModel and trackMenuItems.
export const DEFAULTS = {
  // Px height used by the "Normal" preset / "Set feature height" dialog.
  rowHeight: 15,
  // Default for the `rowHeightMode` property: 0 = fit-to-display-height, so a
  // freshly loaded track bounds itself to the track height regardless of how
  // many species it has. The "Normal" preset switches to the px `rowHeight`.
  rowHeightMode: 0,
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
  // CDS-frame strip is an opt-in expert overlay (frame-number coloring is
  // noisy), so leave it off even when an annotationAdapter is configured. Codon
  // view (showTranslation) is likewise opt-in and no longer requires this on.
  showAnnotations: false,
  showTranslation: false,
  colorByChromosome: false,
  showInversions: false,
} as const
