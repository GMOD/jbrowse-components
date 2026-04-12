const PEPTIDE_BACKGROUND_MAX_BP_PER_PX = 1
const PEPTIDE_TEXT_MAX_BP_PER_PX = 1 / 8

export function shouldRenderPeptideBackground(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_BACKGROUND_MAX_BP_PER_PX
}

export function shouldRenderPeptideText(bpPerPx: number) {
  return bpPerPx <= PEPTIDE_TEXT_MAX_BP_PER_PX
}
