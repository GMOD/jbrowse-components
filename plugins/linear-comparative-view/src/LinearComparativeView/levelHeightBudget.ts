// A stack of synteny bands shares one screen, so their height is a budget split
// across levels rather than a per-level constant: at the 100px default a 5-row
// launch spends 400px on ribbons before any genome row is drawn, and the reader
// scrolls to see the stack it just asked for. 320px is the whole band budget, so
// up to three levels keep the 100px default (a pairwise view, at one level, is
// unaffected) and past that each level gets a smaller share, floored where a
// ribbon stops being readable.
//
// Shared by `autoScaleLevelHeights` (the "Auto-scale level heights" menu item
// and the init path) and the launch dialog, so the height a multi-way launch
// opens with is the same number the menu item would produce.
const BAND_BUDGET_PX = 320
const MIN_LEVEL_HEIGHT_PX = 40
const DEFAULT_LEVEL_HEIGHT_PX = 100

export function levelHeightForCount(numLevels: number) {
  return Math.round(
    Math.max(
      MIN_LEVEL_HEIGHT_PX,
      Math.min(DEFAULT_LEVEL_HEIGHT_PX, BAND_BUDGET_PX / numLevels),
    ),
  )
}
