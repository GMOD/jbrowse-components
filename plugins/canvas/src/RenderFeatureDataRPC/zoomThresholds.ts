const PEPTIDE_BACKGROUND_MAX_BP_PER_PX = 1

// The coarsest zoom the amino-acid letters draw at, and so the tightest codon
// cell they ever have to fit: 3 / (1/8) = 24px for a full triplet. Exported
// because that is the worst case the letter/residue-number layout has to hold
// at (peptidePositioning), and a test asserting it should read the real number
// rather than restate it.
export const PEPTIDE_TEXT_MAX_BP_PER_PX = 1 / 8

// Above this on-screen features-per-pixel density (`labelDensityPerPx`) 'auto'
// hides floating labels: too many to read individually, and React element
// creation costs ~70us each. At 0.2 on a 1200px screen roughly 240 features are
// visible; a sparse 5-feature track on a whole chromosome sits near 0.005 and
// stays labeled at any zoom.
export const MAX_LABEL_FEATURE_DENSITY = 0.2

// Descriptions drop out of 'auto' before names do, mirroring the fit ladder's
// `full` -> `labels` rung: a description costs a second text row and is usually
// wider than the name, so its overhang pushes more features onto new rows.
// Degrading in two steps keeps 'auto' useful across a zoom range where one
// threshold went straight from everything to nothing.
//
// Half the label threshold, which leaves a real names-only band at 0.1-0.2
// without stripping descriptions at working zooms — a 14kb view of the volvox
// gene track sits at ~0.055, and a quarter-threshold cut them off there.
export const MAX_DESCRIPTION_FEATURE_DENSITY = 0.1

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
