// The `line` mark shape: a stroke through consecutive instances of one row,
// on the shared `valueScale`, in one of two variants the pass names.
//
// STEP (`LINE_STEP`): each instance draws three square-capped quads — a
// vertical from the previous instance's value at `x`, a horizontal at its own
// value across [x, x2), a vertical to the next instance's value at `x2` — so
// adjacent instances join at a shared corner and a gap drops to the origin and
// rises again. The quads deliberately overlap and stay flat fills: coverage on
// a self-overlapped edge double-blends into a lattice of darker joints.
//
// CENTER (`LINE_CENTER`): one capsule per instance from the previous
// instance's bp midpoint to its own, thickened to `lineWidth` with round caps,
// drawn under a max blend so coincident caps union into a seamless round join;
// a run starts (`prevX == NO_PREV_X`) as a dot. The break rule is the packer's
// (`gapBp`), so both backends break in the same place.
//
// The band is the instance's row, `rowHeight` px each, the scale ruling every
// band on its own (ADR-126); a rowless caller sends the canvas height.
//! targets: wgsl, glsl
//! export-consts: STEP_LINE_VERTS, NO_PREV_X, GAP_Y, LINE_STEP, LINE_CENTER

import antialias;
import capsule;
import hpmath;
import colorPack;
import markColor;
import valueScale;

public static const uint VERTS_PER_INSTANCE = 6u;

static const uint STEP_LINE_SEGMENTS = 3u;
static const uint STEP_LINE_QUAD_VERTS = 6u;
public static const uint STEP_LINE_VERTS = STEP_LINE_SEGMENTS * STEP_LINE_QUAD_VERTS;

// The packer's sentinels: a center segment with no previous point, and a step
// neighbour that is a gap, which the shader reads as the origin.
public static const uint NO_PREV_X = 0xffffffffu;
public static const float GAP_Y = -3.0e38;

public static const int LINE_STEP = 0;
public static const int LINE_CENTER = 1;

struct LineMarkInstance {
  uint  x         : ATTR0;
  uint  x2        : ATTR1;
  float y         : ATTR2;
  uint  color     : ATTR3;
  uint  row       : ATTR4;
  // step: the neighbours' values, GAP_Y where the neighbour is not adjacent
  float prevY     : ATTR5;
  float nextY     : ATTR6;
  // center: the previous instance's span and value, NO_PREV_X at a run start
  uint  prevX     : ATTR7;
  uint  prevX2    : ATTR8;
  float prevYLine : ATTR9;
};

struct Uniforms {
  float3 bpRangeX;
  float  canvasHeight;
  float  domainMin;
  float  domainMax;
  int    valueScaleType;
  int    rampMode;
  float  rampMin;
  float  rampMax;
  float  rowHeight;
  // The value a step drops to across a gap, on the same scale as `y`.
  float  origin;
  float  lineWidth;
  int    variant;
  float  zero;
  float  viewportWidth;
  float  devicePixelRatio;
};
[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
  float2 localPos : TEXCOORD0;
  nointerpolation float segHalfLen : TEXCOORD1;
};

float bpToClipX(uint bp) {
  return hpToClipX(hpSplitUint(bp), u.bpRangeX, u.zero);
}

float valueYPx(float value, float bandTop) {
  return bandTop + valueToYPxScaled(value, u.domainMin, u.domainMax, u.rowHeight, u.valueScaleType);
}

float stepNeighbourYPx(float neighbour, float bandTop) {
  return valueYPx(neighbour < GAP_Y * 0.5 ? u.origin : neighbour, bandTop);
}

[shader("vertex")]
VsOut vs_main(LineMarkInstance inst, uint vid : SV_VertexID) {
  float sx1 = bpToClipX(inst.x);
  float sx2 = bpToClipX(inst.x2);
  float bandTop = u.rowHeight * float(inst.row);
  float pxToClip = 2.0 / u.canvasHeight;

  float sx;
  float sy;
  float2 localPos = float2(0.0, 0.0);
  float segHalfLen = 0.0;

  if (u.variant == LINE_STEP) {
    uint seg = vid / STEP_LINE_QUAD_VERTS;
    float2 q = quadLocal(vid);
    float clipY     = 1.0 - valueYPx(inst.y, bandTop) * pxToClip;
    float clipPrevY = 1.0 - stepNeighbourYPx(inst.prevY, bandTop) * pxToClip;
    float clipNextY = 1.0 - stepNeighbourYPx(inst.nextY, bandTop) * pxToClip;
    float hwx = pxToClipLen(u.lineWidth * 0.5, u.viewportWidth);
    float hwy = u.lineWidth * 0.5 * pxToClip;
    if (seg == 0u) {
      sx = lerp(sx1 - hwx, sx1 + hwx, q.x);
      sy = lerp(min(clipPrevY, clipY) - hwy, max(clipPrevY, clipY) + hwy, q.y);
    } else if (seg == 1u) {
      sx = lerp(min(sx1, sx2) - hwx, max(sx1, sx2) + hwx, q.x);
      sy = lerp(clipY - hwy, clipY + hwy, q.y);
    } else {
      sx = lerp(sx2 - hwx, sx2 + hwx, q.x);
      sy = lerp(min(clipY, clipNextY) - hwy, max(clipY, clipNextY) + hwy, q.y);
    }
  } else {
    bool hasPrev = inst.prevX != NO_PREV_X;
    float midCurrX = (sx1 + sx2) * 0.5;
    // averaged in clip space, as midCurrX is, so consecutive capsules meet
    float midPrevX = hasPrev
      ? (bpToClipX(inst.prevX) + bpToClipX(inst.prevX2)) * 0.5
      : midCurrX;
    float currYpx = valueYPx(inst.y, bandTop);
    float prevYpx = hasPrev ? valueYPx(inst.prevYLine, bandTop) : currYpx;
    float centerClipX = (midPrevX + midCurrX) * 0.5;
    float centerYpx = (prevYpx + currYpx) * 0.5;
    float2 deltaPx = float2(
      (midCurrX - midPrevX) * u.viewportWidth * 0.5, currYpx - prevYpx);
    float len = length(deltaPx);
    CapsuleFrame f = capsuleFrame(deltaPx, len);
    float2 local =
      capsuleQuadLocal(vid, len * 0.5, u.lineWidth * 0.5, u.devicePixelRatio);
    float2 off = f.tangent * local.x + f.normal * local.y;
    sx = centerClipX + pxToClipLen(off.x, u.viewportWidth);
    sy = 1.0 - (centerYpx + off.y) * pxToClip;
    localPos = local;
    segHalfLen = len * 0.5;
  }

  VsOut o;
  o.position = float4(sx, sy, 0.0, 1.0);
  o.color = markInstanceColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax);
  o.localPos = localPos;
  o.segHalfLen = segHalfLen;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut fragIn) : SV_Target {
  if (u.variant == LINE_CENTER) {
    float dist = capsuleDist(fragIn.localPos, fragIn.segHalfLen);
    float alpha = edgeCoverage(u.lineWidth * 0.5 - dist, u.devicePixelRatio);
    if (alpha <= 0.0) {
      discard;
    }
    // premultiplied, so same-colour overlaps union under the max blend
    return float4(fragIn.color.rgb * alpha, fragIn.color.a * alpha);
  }
  return fragIn.color;
}
