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
module colorRampLut;

// The colour at `t` in [0, 1], straight (non-premultiplied) alpha. Sampled at
// the texture's vertical center, mip level 0 — a 256×1 ramp has no other row
// and no other level. `t` is clamped so an out-of-range scalar lands on the end
// entry; the sampler's clamp-to-edge addressing already answers the same, but
// every consumer clamped explicitly and the module keeps that statement in one
// place.
public float4 rampColor(Sampler2D<float4> ramp, float t) {
  return ramp.SampleLevel(float2(clamp(t, 0.0, 1.0), 0.5), 0.0);
}

// The same sample with its colour multiplied through its alpha, for a fragment
// returned under `//! blend: premultiplied`. Alpha itself is unchanged, so a
// consumer's own alpha test (HiC's MIN_VISIBLE_ALPHA discard) reads the same
// number either side of this call.
public float4 rampColorPremultiplied(Sampler2D<float4> ramp, float t) {
  float4 c = rampColor(ramp, t);
  return float4(c.rgb * c.a, c.a);
}
