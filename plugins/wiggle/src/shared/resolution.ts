// Resolution multiplies the bins fetched, stepped by `RESOLUTION_STEP`. Only
// the coarse side needs a floor; past raw per-base data a finer request returns
// the same bins, so the ceiling is only high. The track-menu stepper disables
// at the edges `clampResolution` holds a value to.
export const RESOLUTION_MIN = 1 / 16
export const RESOLUTION_MAX = 1024
export const RESOLUTION_STEP = 2

export function clampResolution(resolution: number) {
  return Math.min(RESOLUTION_MAX, Math.max(RESOLUTION_MIN, resolution))
}
