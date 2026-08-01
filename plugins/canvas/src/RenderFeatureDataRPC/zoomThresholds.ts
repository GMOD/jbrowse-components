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

// Descriptions drop out of 'auto' before names do, mirroring the fit ladder's
// `full` → `labels` rung (see fitStage): a description costs a second text row
// per feature and is typically wider than the name, so its label-width overhang
// pushes more features onto new rows. Degrading in two steps —
// name + description → name → nothing — keeps 'auto' useful across a zoom range
// where the single old threshold went straight from everything to nothing.
export const MAX_DESCRIPTION_FEATURE_DENSITY = 0.05

// At one pixel per base or finer the cursor resolves to a single base. Coarser
// than that, a position reported to the base — an HGVS c. coordinate — would be
// off by however many bases share the pixel, and a silently wrong one is worse
// than none.
export function isBaseResolved(bpPerPx: number) {
  return bpPerPx <= 1
}

export function shouldRenderPeptideBackground(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_BACKGROUND_MAX_BP_PER_PX
}

export function shouldRenderPeptideText(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_TEXT_MAX_BP_PER_PX
}
