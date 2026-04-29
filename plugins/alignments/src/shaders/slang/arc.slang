// Paired-read arc pass: each instance is a stroked path rendered as a
// triangle-strip that inflates the curve by a half-width on each side;
// fragment shader smooths the edge into AA.
//
// shapeType encodes the curve form:
//   0 = cubic bezier (close-range pair)
//   1 = semicircle (long-range pair; drawn as half-circle arc)
//   2 = flat horizontal line at Y = destY (samplot paired, solid, alpha 0.25)
//   3 = flat horizontal line at Y = destY (samplot split read, dashed, alpha 0.25)
//
// yBp is the target Y position in genomic bp — for arc/bezier this is the
// apex height; for flat it is the line's Y. Samplot sets yBp = |tlen|; arc
// mode sets yBp = |x2-x1|/2 (reproducing the original radius-based height).
//! targets: wgsl, glsl

import alignmentsUniforms;
import colorPack;
import hpmath;


public static const uint ARC_CURVE_SEGMENTS = 64u;
public static const uint VERTS_PER_INSTANCE = (ARC_CURVE_SEGMENTS + 1u) * 2u;
static const float ARC_HEIGHT_MARGIN = 8.0;
static const float PI = 3.14159265359;

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;

struct Instance {
  uint  x1        : ATTR0;
  uint  x2        : ATTR1;
  float colorType : ATTR2;
  float shapeType : ATTR3;
  uint  yBp       : ATTR4;
};

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float  dist     : COLOR1;
  float  dashed   : COLOR2;
};

float3 arcColorByIndex(uint idx, Uniforms u) {
  uint colors[8];
  colors[0] = u.arcColor0; colors[1] = u.arcColor1;
  colors[2] = u.arcColor2; colors[3] = u.arcColor3;
  colors[4] = u.arcColor4; colors[5] = u.arcColor5;
  colors[6] = u.arcColor6; colors[7] = u.arcColor7;
  return unpackRGBA(colors[min(idx, 7u)]).xyz;
}

// Gradient fallback for colorType >= NUM_ARC_COLORS: HSL hue sweep from the
// gradientHue uniform.
float3 hueGradient(float hueDeg) {
  float h = hueDeg / 360.0;
  float c = 0.5;
  float x = c * (1.0 - abs(h * 6.0 % 2.0 - 1.0));
  float m = 0.25;
  float3 hue;
  if (h < 1.0 / 6.0)      { hue = float3(c, x, 0.0); }
  else if (h < 2.0 / 6.0) { hue = float3(x, c, 0.0); }
  else if (h < 3.0 / 6.0) { hue = float3(0.0, c, x); }
  else if (h < 4.0 / 6.0) { hue = float3(0.0, x, c); }
  else if (h < 5.0 / 6.0) { hue = float3(x, 0.0, c); }
  else                    { hue = float3(c, 0.0, x); }
  return hue + m;
}

float3 arcColor(float ct, Uniforms u) {
  uint idx = uint(ct + 0.5);
  if (idx < 8u) { return arcColorByIndex(idx, u); }
  return hueGradient(u.gradientHue);
}

// Evaluates the curve at parameter t ∈ [0,1] in screen pixels.
// x1/x2 are absolute genomic uint32. Convert each to a normalized fraction
// in the visible window via hp-math (preserves 3-Gbp precision), then run
// the curve in that small-float space.
float2 evalArc(float t, Instance inst, Uniforms u) {
  float x1Norm = hpLinear(hpSplitUint(inst.x1), u);
  float x2Norm = hpLinear(hpSplitUint(inst.x2), u);
  float availH = u.canvasH - ARC_HEIGHT_MARGIN;
  float yDir = (u.pairedArcsDown > 0.5) ? 1.0 : -1.0;

  // Y scale: availH pixels = arcsYDomainBp genomic bp. CPU chooses the
  // domain (zoom-proportional for arcs, autoscaled |tlen| for samplot).
  float destY = min(availH, (float(inst.yBp) / u.arcsYDomainBp) * availH);

  float xNorm, yPx;
  if (inst.shapeType > 1.5) {
    // Flat line: x interpolates from x1 to x2, y is constant at destY.
    xNorm = x1Norm + t * (x2Norm - x1Norm);
    yPx = destY * yDir;
  } else if (inst.shapeType > 0.5) {
    float angle = t * PI;
    float cxNorm = (x1Norm + x2Norm) * 0.5;
    float rNorm = (x2Norm - x1Norm) * 0.5;
    xNorm = cxNorm + cos(angle) * rNorm;
    yPx = (destY > 0.0) ? sin(angle) * destY * yDir : 0.0;
  } else {
    // Cubic Bezier with control points at x1,x1,x2,x2 (so the curve
    // approaches each anchor tangent to the x-axis).
    float mt = 1.0 - t; float mt2 = mt*mt; float mt3 = mt2*mt;
    float t2 = t*t;     float t3 = t2*t;
    xNorm = mt3*x1Norm + 3.0*mt2*t*x1Norm + 3.0*mt*t2*x2Norm + t3*x2Norm;
    yPx = (3.0*mt2*t*destY + 3.0*mt*t2*destY) * yDir;
  }
  float screenX = u.blockStartPx + xNorm * u.blockWidth;
  return float2(screenX, yPx);
}

[shader("vertex")]
VsOut vs_main(Instance inst, uint vid : SV_VertexID) {
  VsOut o;
  uint seg = vid / 2u;
  uint sideIdx = vid % 2u;
  float side = (sideIdx == 0u) ? -1.0 : 1.0;
  float t = float(seg) / float(ARC_CURVE_SEGMENTS);

  float2 pos = evalArc(t, inst, u);
  float eps = 1.0 / float(ARC_CURVE_SEGMENTS);
  float2 p0 = evalArc(max(t - eps * 0.5, 0.0), inst, u);
  float2 p1 = evalArc(min(t + eps * 0.5, 1.0), inst, u);
  float2 tang = p1 - p0;
  float tlen = length(tang);
  float2 normal;
  if (tlen > 0.001) {
    float2 tn = tang / tlen;
    normal = float2(-tn.y, tn.x);
  } else {
    normal = float2(0.0, 1.0);
  }

  float lw = u.lineWidthPx;
  float hw = lw * 0.5 + 1.0;
  float2 off = pos + normal * hw * side;
  float clipX = (off.x / u.canvasW) * 2.0 - 1.0;
  float clipY = 1.0 - ((off.y + u.covOffset) / u.canvasH) * 2.0;
  o.position = float4(flipX(clipX, u), clipY, 0.0, 1.0);
  o.dist = side * hw;
  // Samplot flat arcs (shape >= 2): alpha 0.25 matches samplot.py's alpha=0.25.
  float arcAlpha = (inst.shapeType > 1.5) ? 0.25 : 1.0;
  o.color = float4(arcColor(inst.colorType, u), arcAlpha);
  o.dashed = (inst.shapeType > 2.5) ? 1.0 : 0.0;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  // Split-read flat arcs render dashed (samplot.py's dotted style).
  if (fragIn.dashed > 0.5 && frac(fragIn.position.x / 6.0) > 0.5) { discard; }
  float hw = u.lineWidthPx * 0.5;
  float d = abs(fragIn.dist);
  float aa = fwidth(fragIn.dist);
  float alpha = clamp((hw - d) / aa + 0.5, 0.0, 1.0);
  // Output straight alpha — see shaders/AGENTS.md, blend does the premultiply.
  return float4(fragIn.color.rgb, fragIn.color.a * alpha);
}
