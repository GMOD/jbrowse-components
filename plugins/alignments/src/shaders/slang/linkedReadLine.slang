// Linked-read connecting line for `linkedReadBezier` mode. Per-instance
// 6-vertex quad with per-endpoint Y (mates can sit on different rows when
// a column sort is in effect) and palette-indexed color: the arc palette,
// indexed by the color type's slot (see `linkedReadColor*` in
// alignmentsUniforms.slang).
//
// **A quad, because a native line cannot carry a width.** This was a 2-vertex
// `line-list` instance, and a GPU line list is 1 px wide whatever you ask for:
// WebGPU has no line-width parameter at all, and WebGL2 requires only 1.0 (its
// `lineWidth()` is capped there on essentially every implementation). Meanwhile
// `features/linkedReads/mark.ts` strokes 1.5 px, so every connector was
// half a pixel thinner on both GPU backends than in Canvas2D and the SVG export
// — over long diagonals across the whole pileup, which is a lot of pixels.
//
// It was measurable and was measured: `alignments-long-reads-sv-linked` sat at
// 1.99% cross-backend drift and `inversion-pbsim-linked` at 3.96%, and both were
// byte-identical under swiftshader and on a real GPU while every neighbouring
// pair moved — the signature of a real difference rather than antialiasing (see
// agent-docs/reference/CROSS_BACKEND_GATE.md).
//
// A linked-read connector is **diagonal**, so the quad is extruded along the
// segment's own frame rather than axis-aligned.
//! targets: wgsl, glsl
//! coverage: analytic
//! export-consts: LINKED_READ_LINE_ALPHA, LINKED_READ_LINE_WIDTH_PX

import alignmentsUniforms;
import antialias;
// The butt-capped half: the Canvas2D twin strokes butt caps, and
// buttSegmentCoverage.test.ts fails if a round one comes back.
import capsule;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

// Connector opacity: the lines cross the pileup, so they stay translucent enough
// to read the reads underneath. Exported so features/linkedReads/mark.ts
// (Canvas2D + SVG export) strokes the same alpha.
static const float LINKED_READ_LINE_ALPHA = 0.8;

// Connector weight in CSS px. Exported for the same reason the alpha is, and it
// is the value the Canvas2D path always used — the GPU is the side that has
// changed, from an un-asked-for 1.0 to the 1.5 both were supposed to draw.
static const float LINKED_READ_LINE_WIDTH_PX = 1.5;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  bp1       : ATTR0;
  uint  bp2       : ATTR1;
  float y1        : ATTR2;
  float y2        : ATTR3;
  uint  colorType : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // capsule.slang's (along from bp1, along back from bp2, across), CSS px
  float3 local    : COLOR1;
};

// linkedReadColorSlot (alignmentsUniforms) is the index rule, split out so the
// Canvas2D/SVG overlay can read the generated twin instead of spelling its own.
float3 linkedReadColorByIndex(uint colorType, Uniforms u) {
  return u.linkedReadColor[linkedReadColorSlot(colorType)].xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;

  // Both endpoints in CSS px. bpToClipX is the shared bp->clip mapping and does
  // not itself flip, so this frame is unflipped and `flipX` is applied to the
  // finished vertex below — a reflection is an isometry, so it mirrors the quad
  // without changing its width.
  float2 p1 = float2(
    clipXToPx(bpToClipX(inst.bp1, u), u.canvasW), pileupRowCenterPx(inst.y1, u));
  float2 p2 = float2(
    clipXToPx(bpToClipX(inst.bp2, u), u.canvasW), pileupRowCenterPx(inst.y2, u));
  SegmentCorner c = buttSegmentCorner(
    vid, p2 - p1, LINKED_READ_LINE_WIDTH_PX * 0.5, u.devicePixelRatio);
  o.local = c.local;

  float2 p = (c.atEnd ? p2 : p1) + c.offsetPx;
  o.position = float4(flipX(pxToClipX(p.x, u.canvasW), u),
                      yPxToClipY(p.y, u.canvasH), 0.0, 1.0);

  uint idx = inst.colorType;
  o.color = float4(linkedReadColorByIndex(idx, u), LINKED_READ_LINE_ALPHA);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // `local` is already in the segment's own frame, so the diagonal costs
  // nothing here, and the caps are BUTT, as its painter strokes them. The ramp
  // is a constant number of device pixels rather than a derivative
  // (aaHalfPx).
  float alpha = buttSegmentCoverage(
    fragIn.local, LINKED_READ_LINE_WIDTH_PX * 0.5, u.devicePixelRatio);
  // Straight alpha; the HAL blend func does the premultiply.
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
