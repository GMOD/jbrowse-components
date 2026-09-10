// The linear value → canvas-y scale a quantitative mark places its datum
// through: clamp into the domain, invert (a bigger value sits higher), scale to
// the canvas. `valueToYPx` is the linear scale on its own, which is what a
// consumer with no scale type of its own reads (Manhattan pins linear, and its
// -log10 p is already a pre-transform); `valueToYPxScaled` below takes a
// declared one.
//
// Two shapes compose it (ADR-095): `pointMark` reads it for a glyph centre and
// `barMark` for both cuts of a bar. Each keeps its own anchor (ADR-097) — a
// point centres on the value, a bar grows from `origin` to it — so only the
// scale lives here.
//
// max(range, 1e-6) guards a degenerate (min == max) domain from dividing by
// zero. JS spelled that guard `|| 1`, and the two are NOT the same: `|| 1`
// invents a phantom unit-wide domain, so with bounds pinned to a single value
// a value half a unit above it drew half-way up the Canvas2D canvas while the
// GPU clamped it to the top. Pinning a degenerate domain means everything above
// it is off the top, which is what this does; the parity test pins the case.
//
// A declared log scale takes the log arm of `scoreScale`'s `normalizeScore`,
// the normalizer wiggle and the coverage band are already placed by, so a mark
// display's axis ticks and its shader agree by construction. The linear arm
// stays this module's own: `normalizeScore` answers 0 on a degenerate domain
// and this answers 1, and that difference is a pinned cross-backend value
// (ADR-097).
//
// The JS twin is lifted by `pointMark.slang`'s `//! js-export` rather than
// here, the way hpmath's `expandToMinWidthPx` reaches JS through
// `coverageBar.slang`: one twin, in the generated module every consumer of the
// scale already imports.
module valueScale;

import scoreScale;

public float valueToYPx(float value, float domainMin, float domainMax, float h) {
  float norm = clamp(
    (value - domainMin) / max(domainMax - domainMin, 1e-6),
    0.0,
    1.0,
  );
  return (1.0 - norm) * h;
}

// The same placement under a declared scale type: `SCALE_TYPE_LOG` reads the
// value through `scoreScale`'s log arm, anything else through the linear one
// above.
public float valueToYPxScaled(float value, float domainMin, float domainMax, float h, int scaleType) {
  if (scaleType == SCALE_TYPE_LOG) {
    return (1.0 - normalizeScore(value, domainMin, domainMax, SCALE_TYPE_LOG, 1.0)) * h;
  }
  return valueToYPx(value, domainMin, domainMax, h);
}
