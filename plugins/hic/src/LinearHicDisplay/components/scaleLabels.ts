/**
 * The domain a Hi-C color scale spans, shared by the model's `colorScales`
 * and the parity test against the shader.
 *
 * The endpoints are the renderer's, not a niced version of them: the bar draws
 * ramp entry `t` at bar fraction `t`, so a rounded-outward maximum moves every
 * interior score on the bar. `mapHicCount` saturates at `colorMaxScore` under
 * the same two floors spelled here, and bottoms out at a count of 1 in log
 * scale (where it clamps the count up first) and 0 in linear.
 */
export function hicScaleDomain(
  score: number,
  useLogScale: boolean,
): [number, number] {
  return [useLogScale ? 1 : 0, Math.max(score, useLogScale ? 2 : 0.001)]
}
