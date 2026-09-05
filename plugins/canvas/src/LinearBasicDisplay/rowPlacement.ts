// Its own module because layout.ts and yMorph.ts both ask, and either home
// would close an import cycle.

// Float32 holds this magnitude losslessly.
export const OFFSCREEN_Y = -1e6

// `>= 0` rather than `=== OFFSCREEN_Y`, so it reads correctly after a fit
// scale has multiplied the sentinel too.
export function isPlacedRow(topPx: number) {
  return topPx >= 0
}
