// Manhattan plot scatter renderer. Glyph per feature:
//   - ranged SV wider than a point  → horizontal bar from start→end
//   - insertion (glyph==1)          → inverted triangle marker
//   - everything else (SNP/point)   → filled circle (disc)
// All are a 6-vertex quad; the fragment shader carves the shape. GWAS scores
// are conventionally pre-transformed (e.g. -log10 p), so we only do linear Y
// mapping — no log branch here.
//! targets: wgsl, glsl

import hpmath;
import colorPack;

public static const uint VERTS_PER_INSTANCE = 6u;

struct ManhattanInstance {
  uint  absPosition : ATTR0;
  uint  absEnd      : ATTR1;
  float score       : ATTR2;
  uint  color       : ATTR3;
  uint  glyph       : ATTR4;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainYMin;
  float  domainYMax;
  float  zero;
  float  viewportWidth;
  float  pointRadius;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

float bpToClipX(uint bp, Uniforms u) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  // Shape discriminator passed to the fragment shader: 0 = disc, 1 = inverted
  // triangle, 2 = solid bar.
  float  shape    : TEXCOORD1;
};

// 1px pad (in device pixels) around the marker so the smoothstep edge has room
// to fade. localPos is normalized so the marker boundary sits at distance 1.
static const float AA_PAD_PX = 1.0;
static const float SHAPE_DISC = 0.0;
static const float SHAPE_TRI = 1.0;
static const float SHAPE_BAR = 2.0;
// 1/sqrt(5): normalizes the two slanted edges of the inverted triangle so the
// edge functions read as true perpendicular distances for antialiasing.
static const float INV_SQRT5 = 0.4472136;

[shader("vertex")]
VsOut vs_main(ManhattanInstance inst, uint vid : SV_VertexID) {
  uint v = vid % 6u;

  // Two-triangle quad: x=0 when v in {0,2,3}, y=0 when v in {0,1,4}
  bool xZero = (v == 0u || v == 2u || v == 3u);
  bool yZero = (v == 0u || v == 1u || v == 4u);
  float qx = xZero ? 0.0 : 1.0;
  float qy = yZero ? 0.0 : 1.0;
  float2 local = float2(qx, qy) * 2.0 - float2(1.0, 1.0);

  float startClipX = bpToClipX(inst.absPosition, u);
  float endClipX = bpToClipX(inst.absEnd, u);
  float scoreNorm = clamp(
    (inst.score - u.domainYMin) / (u.domainYMax - u.domainYMin),
    0.0,
    1.0,
  );
  float scoreYPx = (1.0 - scoreNorm) * u.canvasHeight;
  float centerClipY = yPxToClipY(scoreYPx, u.canvasHeight);

  // Genomic span in CSS px (clip width spans -1..1 across viewportWidth).
  float spanPx = (endClipX - startClipX) * 0.5 * u.viewportWidth;
  bool isBar = spanPx > u.pointRadius * 2.0;

  VsOut o;
  o.color = unpackRGBA(inst.color);
  if (isBar) {
    // Horizontal bar from start→end, height 2*pointRadius px, centered on the
    // score. 1px AA pad on each x edge so adjacent bars don't shimmer.
    float padClipX = AA_PAD_PX * 2.0 / u.viewportWidth;
    float x = xZero ? (startClipX - padClipX) : (endClipX + padClipX);
    float halfBandPx = u.pointRadius;
    float y = centerClipY + local.y * halfBandPx * 2.0 / u.canvasHeight;
    o.position = float4(x, y, 0.0, 1.0);
    o.localPos = local;
    o.shape = SHAPE_BAR;
  } else {
    float expand = (u.pointRadius + AA_PAD_PX) / max(u.pointRadius, 0.5);
    float halfPx = u.pointRadius * expand;
    float dx = local.x * halfPx * 2.0 / u.viewportWidth;
    float dy = local.y * halfPx * 2.0 / u.canvasHeight;
    o.position = float4(startClipX + dx, centerClipY + dy, 0.0, 1.0);
    o.localPos = local * expand;
    o.shape = inst.glyph == 1u ? SHAPE_TRI : SHAPE_DISC;
  }
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (fragIn.shape > 1.5) {
    // Ranged-SV bar: solid fill, no marker AA.
    return fragIn.color;
  }
  float2 p = fragIn.localPos;
  float coverage;
  if (fragIn.shape > 0.5) {
    // Inverted triangle: top edge (-1,1)-(1,1), apex (0,-1). Each edge's signed
    // distance is positive inside; the min is the SDF used for the AA fade.
    float dTop = 1.0 - p.y;
    float dLeft = (2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    float dRight = (-2.0 * p.x + p.y + 1.0) * INV_SQRT5;
    coverage = min(dTop, min(dLeft, dRight));
  } else {
    // Disc: boundary at distance 1 from center, so the SDF is 1 - radius.
    coverage = 1.0 - length(p);
  }
  float aa = fwidth(coverage);
  float alpha = smoothstep(-aa, aa, coverage);
  if (alpha <= 0.0) discard;
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
