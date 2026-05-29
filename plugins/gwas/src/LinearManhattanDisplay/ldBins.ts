import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

// LocusZoom r² color convention: the index SNP is purple, partners are binned
// by r² to it in 0.2 steps (red high → blue low), and SNPs with no LD data to
// the index render grey. Hex values match the LocusZoom.js default palette.
const GREY = cssColorToABGR('#b8b8b8')
const INDEX = cssColorToABGR('#9632b8')

// Lower-bound (≥) thresholds, scanned high→low — the standard LocusZoom legend
// (0.8–1.0 red, 0.6–0.8 orange, 0.4–0.6 green, 0.2–0.4 light blue, <0.2 blue).
const BINS: [number, number][] = [
  [0.8, cssColorToABGR('#d43f3a')], // red
  [0.6, cssColorToABGR('#eea236')], // orange
  [0.4, cssColorToABGR('#5cb85c')], // green
  [0.2, cssColorToABGR('#46b8da')], // light blue
  [0, cssColorToABGR('#357ebd')], // blue
]

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

export const ldIndexColor = INDEX
