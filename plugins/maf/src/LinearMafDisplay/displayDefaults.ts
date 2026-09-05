// Default values for LinearMafDisplay settings. Kept in its own module so both
// the state model (stripDefault seeds) and the track menu presets can reference
// them without a circular import between stateModel and trackMenuItems.
export const DEFAULTS = {
  // Px height used by the "Normal" preset / custom row-height dialog. The
  // `rowHeight` property itself defaults to 0 (fit-to-display-height) so a
  // freshly loaded track bounds itself to the track height regardless of how
  // many species it has; the "Normal" preset switches to this px value.
  rowHeight: 15,
  /**
   * Ceiling on the height a freshly loaded track sizes itself to, before any
   * drag. Past it, fit-to-display-height keeps shrinking the rows rather than
   * growing the track — a deep alignment lands as a dense, whole-on-screen
   * band instead of a canvas several screens tall.
   *
   * Sizing purely to content (`nrow * rowHeight`) put a 100-way multiz at
   * 1545px and a 447-way cactus at 4141px by default. The rows area is not one
   * canvas but a stack of them — the GPU cells plus every mounted Canvas2D
   * overlay (labels, insertions, deletions, codons, frames, inversions,
   * summary bars, e-lines) — so at dpr 2 that 447-way costs ~98MB *per
   * mounted overlay*, and `maxRowsHeight` only stops it at the point the
   * backing store would throw.
   *
   * 600 keeps every common multiz (hg38 30-way, ce11 26-way — anything up to
   * 40 species) at exactly the height it has today, since those never reach
   * the ceiling. A drag past it is still honored: this bounds the default, not
   * the user.
   */
  maxAutoFitHeight: 600,
  rowProportion: 0.8,
  showAllLetters: false,
  mismatchRendering: true,
  showAsUpperCase: true,
  showTree: true,
  showRowLabels: true,
  showBranchLength: true,
  showCoverage: true,
  showAlignments: true,
  coverageHeight: 45,
  showConservation: false,
  conservationHeight: 40,
  // Conservation band resolution: per-base percent identity ('base') or
  // per-codon amino-acid identity ('codon', needs an annotationAdapter).
  conservationMode: 'base',
  rowIdentityMode: 'none',
  rowIdentityAutoZoom: true,
  // CDS-frame strip is an opt-in expert overlay (frame-number coloring is
  // noisy), so leave it off even when an annotationAdapter is configured. Codon
  // view (showTranslation) is likewise opt-in and no longer requires this on.
  showAnnotations: false,
  showTranslation: false,
  colorByChromosome: false,
  showInversions: false,
  // On, because that is what the track has always drawn. Under the default
  // mismatch coloring the row is a solid match-colored bar and UCSC omits it,
  // so this is the toggle's more useful position — but a row silently
  // disappearing from every existing MAF track is not what a version bump
  // should do.
  showReferenceRow: true,
} as const
