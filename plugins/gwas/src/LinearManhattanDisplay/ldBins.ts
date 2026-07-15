import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

// LocusZoom r² color convention: the index SNP is purple, partners are binned
// by r² to it in 0.2 steps (red high → blue low), and SNPs with no LD data to
// the index render grey. Hex values match the LocusZoom.js default palette.
//
// One source of truth for both the GPU/worker color lookup (ABGR) and the
// on-screen legend (CSS hex + label).
export interface LdSwatch {
  label: string
  color: string
}

// r² bins, high → low. `min` is the inclusive lower bound (scanned high→low).
const LD_BIN_DEFS: (LdSwatch & { min: number })[] = [
  { min: 0.8, color: '#d43f3a', label: '0.8 – 1.0' },
  { min: 0.6, color: '#eea236', label: '0.6 – 0.8' },
  { min: 0.4, color: '#5cb85c', label: '0.4 – 0.6' },
  { min: 0.2, color: '#46b8da', label: '0.2 – 0.4' },
  { min: 0, color: '#357ebd', label: '< 0.2' },
]

export const LD_INDEX_SWATCH: LdSwatch = {
  label: 'Index SNP',
  color: '#c951c9',
}
export const LD_MISSING_SWATCH: LdSwatch = {
  label: 'No LD data',
  color: '#b8b8b8',
}

// Legend rows, top → bottom: index, then r² bins high→low, then the no-data grey.
export const LD_LEGEND: LdSwatch[] = [
  LD_INDEX_SWATCH,
  ...LD_BIN_DEFS,
  LD_MISSING_SWATCH,
]

// Shared by both legend renderers (SVG export in renderSvg, DOM overlay in
// LdColorLegend) so the title and swatch size stay in lockstep across them.
export const LD_LEGEND_TITLE = 'r² to index'
export const LD_LEGEND_SWATCH_PX = 10

const GREY = cssColorToABGR(LD_MISSING_SWATCH.color)
const BINS = LD_BIN_DEFS.map(b => [b.min, cssColorToABGR(b.color)] as const)

// ABGR uint32 for a point at the given r² to the index SNP. `undefined` r²
// (SNP absent from the LD data) renders grey.
export function ldBinColor(r2: number | undefined): number {
  if (r2 === undefined || Number.isNaN(r2)) {
    return GREY
  }
  for (const [threshold, color] of BINS) {
    if (r2 >= threshold) {
      return color
    }
  }
  return GREY
}

export const ldIndexColor = cssColorToABGR(LD_INDEX_SWATCH.color)
