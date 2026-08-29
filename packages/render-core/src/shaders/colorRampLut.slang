// Sampling a 256×1 colour-ramp LUT texture by a [0,1] scalar — the mechanism
// HiC's contact map and both LD heatmap variants reached independently, down to
// the binding slot, and wiggle density's third spelling. The module owns ONLY
// the sampling: each consumer keeps its own scale (`mapHicCount`, LD's signed
// remap plus `ldValueComputed` sentinel gate, wiggle's `normalizeScore` +
// `densityGradientT`) and declares its own `[[vk::binding(2, 0)]]
// Sampler2D<float4> colorRamp;` — a module can take a sampler as a parameter
// but not declare the binding for its importer. The TS half of the mechanism is
// `uploadColorRampLut` (../colorRampLut.ts), which puts the 256-entry
// `Uint8Array` behind these samplers; `buildColorRampLut`
// (@jbrowse/core/util/colorRamp) is what builds it on both backends.
//
// Two entry points because premultiplication follows the consumer's declared
// blend, and the `//! blend:` declaration stays per-shader: HiC and LD both
// draw under `//! blend: premultiplied` and both multiplied the sample through
// its own alpha, so that shared line lives here rather than surviving as a
// copy in each fragment — while wiggle density draws opaque ramps under the
// default straight-alpha blend, where a premultiplied return would be wrong
// the day a translucent ramp entry appears. The function name carries the
// contract, so a consumer picks the form that matches its blend declaration.
//! export-consts: RAMP_LUT_ENTRIES
module colorRampLut;

// Entries in the ramp texture. Exported because `buildColorRampLut` sizes the
// array by it and the mapping below divides by it: a table built to one number
// and sampled by another is a half-shade of drift at every entry.
public static const float RAMP_LUT_ENTRIES = 256.0;

// The colour at `t` in [0, 1], straight (non-premultiplied) alpha. Sampled at
// the texture's vertical center, mip level 0 — the ramp has no other row and no
// other level.
//
// `t` is remapped into texel space rather than passed through. The builder
// defines entry i as the colour at `i / (N - 1)`, while a linear-filtered
// texture puts entry i's center at `(i + 0.5) / N`, so sampling at `t` returns
// a blend of two neighbours at every entry but the ends — half a step off the
// table the Canvas2D and SVG twins index. `clamp` lands an out-of-range scalar
// on the end entry, which clamp-to-edge addressing also answers.
public float4 rampColor(Sampler2D<float4> ramp, float t) {
  float u = (clamp(t, 0.0, 1.0) * (RAMP_LUT_ENTRIES - 1.0) + 0.5) / RAMP_LUT_ENTRIES;
  return ramp.SampleLevel(float2(u, 0.5), 0.0);
}

// The same sample with its colour multiplied through its alpha, for a fragment
// returned under `//! blend: premultiplied`. Alpha itself is unchanged, so a
// consumer's own alpha test (HiC's MIN_VISIBLE_ALPHA discard) reads the same
// number either side of this call.
public float4 rampColorPremultiplied(Sampler2D<float4> ramp, float t) {
  float4 c = rampColor(ramp, t);
  return float4(c.rgb * c.a, c.a);
}
