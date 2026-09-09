// The linear value → canvas-y scale a quantitative mark places its datum
// through: clamp into the domain, invert (a bigger value sits higher), scale to
// the canvas. Linear only — a consumer that wants log pre-transforms its
// values, which is what GWAS -log10 p already is.
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
// The JS twin is lifted by `pointMark.slang`'s `//! js-export` rather than
// here, the way hpmath's `expandToMinWidthPx` reaches JS through
// `coverageBar.slang`: one twin, in the generated module every consumer of the
// scale already imports.
module valueScale;

public float valueToYPx(float value, float domainMin, float domainMax, float h) {
  float norm = clamp(
    (value - domainMin) / max(domainMax - domainMin, 1e-6),
    0.0,
    1.0,
  );
  return (1.0 - norm) * h;
}
