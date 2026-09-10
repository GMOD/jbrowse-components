/** The `step` value a `bin` step writes to follow the view's zoom. */
export const AUTO_BIN = 'auto'

/**
 * How wide an automatic bin aims to be on screen. Four pixels is a bar the eye
 * reads as a bar rather than a hairline, and it keeps a screenful of a
 * 1000px-wide view at ~250 instances.
 */
export const AUTO_BIN_TARGET_PX = 4

const LADDER = [1, 2, 5]

/**
 * The bin width an `auto` step resolves to at this zoom: the target width in bp
 * ({@link AUTO_BIN_TARGET_PX} pixels' worth), snapped up to the next 1/2/5
 * rung — 1, 2, 5, 10, 20, 50, 100 bp and so on, the ladder an axis picks its
 * ticks from. Snapping is what keeps the fetch off the zoom: every bp/px inside
 * a rung resolves to one width, so a zoom step within a rung refetches nothing
 * and one across it refetches at the width the new zoom asks for.
 */
export function autoBinStep(bpPerPx: number) {
  const target = Math.max(1, bpPerPx * AUTO_BIN_TARGET_PX)
  const decade = 10 ** Math.floor(Math.log10(target))
  return (LADDER.find(m => m * decade >= target) ?? 10) * decade
}

/** A `bin` step's declared width in bp, with `auto` resolved at this zoom. */
export function binStepWidth(step: number | string, bpPerPx: number) {
  return step === AUTO_BIN ? autoBinStep(bpPerPx) : Number(step)
}
