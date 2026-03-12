/**
 * Zoom thresholds for CDS peptide rendering
 */

/**
 * Minimum zoom level (bp per pixel) to fetch peptide data and render amino acid backgrounds
 */
export const ZOOM_THRESHOLD_FOR_PEPTIDE_BACKGROUND = 1

/**
 * Minimum zoom level (bp per pixel) to render amino acid text labels
 */
export const ZOOM_THRESHOLD_FOR_PEPTIDE_TEXT = 8

/**
 * Check if zoomed in enough to render amino acid backgrounds
 */
export function shouldRenderPeptideBackground(bpPerPx: number): boolean {
  return 1 / bpPerPx >= ZOOM_THRESHOLD_FOR_PEPTIDE_BACKGROUND
}

/**
 * Check if zoomed in enough to render amino acid text labels
 */
export function shouldRenderPeptideText(bpPerPx: number): boolean {
  return 1 / bpPerPx >= ZOOM_THRESHOLD_FOR_PEPTIDE_TEXT
}
