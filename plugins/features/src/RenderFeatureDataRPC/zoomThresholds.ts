const PEPTIDE_BACKGROUND_MAX_BP_PER_PX = 1

// The coarsest zoom the amino-acid letters draw at, and so the tightest codon
// cell they have to fit: 24px for a full triplet. The letter and residue-number
// layout holds at that worst case.
export const PEPTIDE_TEXT_MAX_BP_PER_PX = 1 / 8

// Above this on-screen features-per-pixel density 'auto' hides floating
// labels: too many to read individually, and React element creation costs
// ~70us each.
export const MAX_LABEL_FEATURE_DENSITY = 0.2

// Descriptions drop out of 'auto' before names do: a description costs a second
// text row and is usually wider than the name, so its overhang pushes more
// features onto new rows. Half the label threshold leaves a real names-only band
// at 0.1-0.2 without stripping descriptions at working zooms.
export const MAX_DESCRIPTION_FEATURE_DENSITY = 0.1

// At one pixel per base or finer the cursor resolves to a single base. Coarser
// than that, an HGVS c. coordinate would be off by however many bases share the
// pixel, and a silently wrong one is worse than none.
export function isBaseResolved(bpPerPx: number) {
  return bpPerPx <= 1
}

export function shouldRenderPeptideBackground(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_BACKGROUND_MAX_BP_PER_PX
}

export function shouldRenderPeptideText(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_TEXT_MAX_BP_PER_PX
}
