// Linked-read connecting line for `linkedReadBezier` mode. Per-instance
// 6-vertex quad with per-endpoint Y (mates can sit on different rows when
// sortedBy is in effect) and palette-indexed color (8 slots, see
// `linkedReadColor*` in alignmentsUniforms.slang).
//
// **A quad, because a native line cannot carry a width.** This was a 2-vertex
// `line-list` instance, and a GPU line list is 1 px wide whatever you ask for:
// WebGPU has no line-width parameter at all, and WebGL2 requires only 1.0 (its
// `lineWidth()` is capped there on essentially every implementation). Meanwhile
// `features/linkedReads/drawCanvas.ts` strokes 1.5 px, so every connector was
// half a pixel thinner on both GPU backends than in Canvas2D and the SVG export
// — over long diagonals across the whole pileup, which is a lot of pixels.
//
// It was measurable and was measured: `alignments-long-reads-sv-linked` sat at
// 1.99% cross-backend drift and `inversion-pbsim-linked` at 3.96%, and both were
// byte-identical under swiftshader and on a real GPU while every neighbouring
// pair moved — the signature of a real difference rather than antialiasing (see
// agent-docs/reference/CROSS_BACKEND_GATE.md).
//
// arcFlat.slang and arcLine.slang had already made this move for the read-cloud
// connectors and the interchromosomal ticks; this is the third and last native
// line in the plugin. The difference from those two is that a linked-read
// connector is **diagonal**, so the quad is extruded along the segment's own
// frame rather than axis-aligned.
//! targets: wgsl, glsl
//! export-consts: LINKED_READ_LINE_ALPHA, LINKED_READ_LINE_WIDTH_PX

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint VERTS_PER_INSTANCE = 6u;

// Connector opacity: the lines cross the pileup, so they stay translucent enough
// to read the reads underneath. Exported so features/linkedReads/drawCanvas.ts
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
  float colorType : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  // Offset from the segment's centre in CSS px, in the segment's OWN frame:
  // x along it, y perpendicular. The quad is extruded by exactly the padded
  // half-extents, so |grad| is 1 per CSS px on both axes and the AA ramp is a
  // constant — same contract as arcFlat.slang's `local`.
  float2 local    : COLOR1;
  // Half-length of the drawn segment, so the fragment can measure the butt caps.
  nointerpolation float halfLen : COLOR2;
};

// linkedReadColorSlot (alignmentsUniforms) is the index rule, split out so the
// Canvas2D/SVG overlay can read the generated twin instead of spelling its own.
float3 linkedReadColorByIndex(uint idx, Uniforms u) {
  return u.linkedReadColor[linkedReadColorSlot(idx)].xyz;
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;

  // Both endpoints in CSS px. bpToClipX is the shared bp->clip mapping and does
  // not itself flip, so this frame is unflipped and `flipX` is applied to the
  // finished vertex below — a reflection is an isometry, so it mirrors the quad
  // without changing its width.
  float x1Px = clipXToPx(bpToClipX(inst.bp1, u), u.canvasW);
  float x2Px = clipXToPx(bpToClipX(inst.bp2, u), u.canvasW);
  float y1Px = pileupRowCenterPx(inst.y1, u);
  float y2Px = pileupRowCenterPx(inst.y2, u);

  float2 mid = float2(x1Px + x2Px, y1Px + y2Px) * 0.5;
  float2 delta = float2(x2Px - x1Px, y2Px - y1Px);
  float len = length(delta);
  // A zero-length connector needs two mates at the same bp AND the same row,
  // which is the same read; the guard is here so a degenerate instance cannot
  // emit NaN positions and take the whole draw with it.
  float2 dir = (len > 0.0001) ? delta / len : float2(1.0, 0.0);
  float2 nrm = float2(-dir.y, dir.x);

  // segmentQuadLocal (alignmentsUniforms) owns the AA pad, paired with the
  // sdSegment the fragment measures with — the same pair arcFlat.slang uses.
  float halfLen = len * 0.5;
  o.local = segmentQuadLocal(vid, halfLen, LINKED_READ_LINE_WIDTH_PX * 0.5);
  o.halfLen = halfLen;

  float2 p = mid + dir * o.local.x + nrm * o.local.y;
  o.position = float4(flipX(pxToClipX(p.x, u.canvasW), u),
                      yPxToClipY(p.y, u.canvasH), 0.0, 1.0);

  uint idx = uint(inst.colorType + 0.5);
  o.color = float4(linkedReadColorByIndex(idx, u), LINKED_READ_LINE_ALPHA);
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // `local` is already in the segment's own frame, so the diagonal costs
  // nothing here — this is the same measurement arcFlat.slang makes of its
  // horizontal one. |grad d| is analytically 1 per CSS px, so the ramp is a
  // constant number of device pixels rather than a derivative (STROKE_AA_PX).
  float d = sdSegment(fragIn.local, fragIn.halfLen);
  float alpha = strokeCoverage(d, LINKED_READ_LINE_WIDTH_PX * 0.5, u);
  // Straight alpha; the HAL blend func does the premultiply.
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
