const PEPTIDE_BACKGROUND_MAX_BP_PER_PX = 1
const PEPTIDE_TEXT_MAX_BP_PER_PX = 1 / 8

// Above this features-per-pixel density, floating labels are hidden in 'auto'
// mode: too many labels to be individually readable, and React element
// creation becomes a significant frame-budget cost (~70µs per label).
// Low-density tracks stay labeled at any zoom — a sparse 5-feature track on a
// whole chromosome produces ~5/screenPx ≈ 0.005 features/px, well below this.
// At 0.2 features/px on a 1200px screen roughly 240 features are visible —
// labels stay on through denser/closer zoom before hiding.
export const MAX_LABEL_FEATURE_DENSITY = 0.2

export function shouldRenderPeptideBackground(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_BACKGROUND_MAX_BP_PER_PX
}

export function shouldRenderPeptideText(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_TEXT_MAX_BP_PER_PX
}
