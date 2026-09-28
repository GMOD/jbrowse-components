// The `line` mark shape's step variant: a stroke that holds each instance's
// value across its span and steps to the next at the shared edge. Each
// instance draws three square-capped quads — a vertical at `x` from the
// previous instance's value to its own, a horizontal at its own value across
// [x, x2), a vertical at `x2` to the next instance's value — so adjacent
// instances join at a shared corner, and a gap drops to the `origin` and rises
// again. A joined next collapses the third quad onto the corner the next
// instance's first quad draws, so the seam is stroked once.
//
// The quads deliberately overlap and stay flat fills: per-fragment coverage on
// an edge two quads both cover double-blends there, and the step line would
// gain a lattice of darker joints. The variant that wants an antialiased stroke
// is `lineCenterMark.slang`, whose capsules union under a max blend.
//
// The band is the instance's `row`, read through the bound row table as
// `barMark` reads it: a key resolved to its slot and colour, or dropped off
// clip space where the table hides it. A pass binding none (`rowTableKeys` −1)
// draws `row` as the band.
//! targets: wgsl, glsl

import antialias;
import hpmath;
import colorPack;
import markColor;
import rowTable;
import valueScale;
import lineCommon;

static const uint STEP_LINE_SEGMENTS = 3u;
static const uint STEP_LINE_QUAD_VERTS = 6u;
public static const uint VERTS_PER_INSTANCE = STEP_LINE_SEGMENTS * STEP_LINE_QUAD_VERTS;

struct LineStepInstance {
  uint  x     : ATTR0;
  uint  x2    : ATTR1;
  float y     : ATTR2;
  uint  color : ATTR3;
  uint  row   : ATTR4;
  // The neighbours' values, GAP_Y where the neighbour does not abut.
  float prevY : ATTR5;
  float nextY : ATTR6;
};

[[vk::binding(1, 0)]] ConstantBuffer<Uniforms> u;
[[vk::binding(2, 0)]] Sampler2D<float4> colorRamp;
[[vk::binding(4, 0)]] Sampler2D<float4> rowTable;

struct VsOut {
  float4 position : SV_Position;
  float4 color    : COLOR0;
};

// A neighbour's y: its value's, or the origin's where it is a gap.
float neighbourYPx(float neighbour, float bandTop) {
  return lineValueYPx(neighbour < GAP_Y * 0.5 ? u.origin : neighbour, bandTop, u);
}

[shader("vertex")]
VsOut vs_main(LineStepInstance inst, uint vid : SV_VertexID) {
  VsOut o;
  RowPlacement place = rowTableLookup(rowTable, inst.row, u.rowTableKeys,
    markInstanceColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm));
  if (place.hidden) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.color = float4(0.0);
    return o;
  }
  float sx1 = lineBpToClipX(inst.x, u);
  float sx2 = lineBpToClipX(inst.x2, u);
  float bandTop = rowBandTopPx(u.rowOffsetPx, u.rowHeight, place.slot);
  float yPx = lineValueYPx(inst.y, bandTop, u);
  float prevPx = neighbourYPx(inst.prevY, bandTop);
  float nextPx = neighbourYPx(inst.nextY, bandTop);
  float hw = u.lineWidth * 0.5;
  float hwx = pxToClipLen(hw, u.viewportWidth);

  uint seg = vid / STEP_LINE_QUAD_VERTS;
  float2 q = quadLocal(vid);
  float sx;
  float sy;
  if (seg == 0u) {
    sx = lerp(sx1 - hwx, sx1 + hwx, q.x);
    sy = lerp(max(prevPx, yPx) + hw, min(prevPx, yPx) - hw, q.y);
  } else if (seg == 1u) {
    sx = lerp(min(sx1, sx2) - hwx, max(sx1, sx2) + hwx, q.x);
    sy = lerp(yPx + hw, yPx - hw, q.y);
  } else {
    sx = lerp(sx2 - hwx, sx2 + hwx, q.x);
    sy = lerp(max(yPx, nextPx) + hw, min(yPx, nextPx) - hw, q.y);
  }
  o.position = float4(sx, yPxToClipY(sy, u.canvasHeight), 0.0, 1.0);
  o.color = place.color;
  return o;
}

[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  return v.color;
}
