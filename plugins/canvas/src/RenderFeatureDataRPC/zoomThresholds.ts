const PEPTIDE_BACKGROUND_MAX_BP_PER_PX = 1
const PEPTIDE_TEXT_MAX_BP_PER_PX = 1 / 8

// Above this features-per-pixel density, floating labels are hidden: too many
// labels to be individually readable, and React element creation becomes a
// significant frame-budget cost (~70µs per label). Low-density tracks stay
// labeled at any zoom — a sparse 5-feature track on a whole chromosome
// produces ~5/screenPx ≈ 0.005 features/px, well below the threshold.
const MAX_LABEL_FEATURE_DENSITY = 0.02

export function shouldRenderPeptideBackground(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_BACKGROUND_MAX_BP_PER_PX
}

export function shouldRenderPeptideText(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_TEXT_MAX_BP_PER_PX
}

export function shouldRenderFloatingLabels(
  featureCount: number,
  screenWidthPx: number,
) {
  if (screenWidthPx <= 0) {
    return true
  }
  return featureCount / screenWidthPx <= MAX_LABEL_FEATURE_DENSITY
}
