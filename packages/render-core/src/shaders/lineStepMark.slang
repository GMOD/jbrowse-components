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
// `barMark` reads it: a key resolved to its slot and color, or dropped off
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
  nointerpolation float4 color : COLOR0;
  // the y range the fragment's color is read in: a rise's own span, or a
  // level run's value placed unclamped
  nointerpolation float2 colorLine : TEXCOORD0;
  nointerpolation float4 cutYsLo : TEXCOORD1;
  nointerpolation float4 cutYsHi : TEXCOORD2;
  float yPx : TEXCOORD3;
  nointerpolation float colorAlongY : TEXCOORD4;
};

// A neighbour's y: its value's, or the origin's where it is a gap.
float neighbourYPx(float neighbour, float bandTop) {
  return lineValueYPx(neighbour < GAP_Y * 0.5 ? u.origin : neighbour, bandTop, u);
}

[shader("vertex")]
VsOut vs_main(LineStepInstance inst, uint vid : SV_VertexID) {
  VsOut o;
  RowPlacement place = rowTableLookup(rowTable, inst.row, u.rowTableKeys,
    markScaleColor(colorRamp, inst.color, u.rampMode, u.rampMin, u.rampMax, u.rampMidNorm, u.colorCutCount, u.colorCuts[0], u.colorCuts[1], u.colorBands));
  if (place.hidden) {
    o.position = float4(2.0, 2.0, 0.0, 1.0);
    o.color = float4(0.0);
    o.colorLine = float2(0.0);
    o.cutYsLo = float4(0.0);
    o.cutYsHi = float4(0.0);
    o.colorAlongY = 0.0;
    o.yPx = 0.0;
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
  float2 colorLine;
  if (seg == 0u) {
    sx = lerp(sx1 - hwx, sx1 + hwx, q.x);
    sy = lerp(max(prevPx, yPx) + hw, min(prevPx, yPx) - hw, q.y);
    colorLine = float2(min(prevPx, yPx), max(prevPx, yPx));
  } else if (seg == 1u) {
    sx = lerp(min(sx1, sx2) - hwx, max(sx1, sx2) + hwx, q.x);
    sy = lerp(yPx + hw, yPx - hw, q.y);
    float colorYPx = lineColorYPx(inst.y, bandTop, u);
    colorLine = float2(colorYPx, colorYPx);
  } else {
    sx = lerp(sx2 - hwx, sx2 + hwx, q.x);
    sy = lerp(max(yPx, nextPx) + hw, min(yPx, nextPx) - hw, q.y);
    colorLine = float2(min(yPx, nextPx), max(yPx, nextPx));
  }
  o.position = float4(sx, yPxToClipY(sy, u.canvasHeight), 0.0, 1.0);
  o.color = place.color;
  o.colorLine = colorLine;
  o.cutYsLo = lineCutYsPx(0, bandTop, u);
  o.cutYsHi = lineCutYsPx(4, bandTop, u);
  o.colorAlongY =
    lineColorAlongY(u.rampMode, u.colorFromY, place.overridden) ? 1.0 : 0.0;
  o.yPx = sy;
  return o;
}

// The quads stay flat fills: a feature's three quads overlap at the joints so
// corners fill with no gaps, and per-fragment coverage on an edge two quads
// both cover would double-blend there. Under a threshold the color is read at
// the fragment's own y along a rise, so a step across a cut changes color at
// the cut, and at the value's y along a level run so a thick line lying on a
// cut stays one color.
[shader("fragment")]
float4 fs_main(VsOut v) : SV_Target {
  return lineFragmentColor(
    clamp(v.yPx, v.colorLine.x, v.colorLine.y), v.cutYsLo, v.cutYsHi, v.color, v.colorAlongY, u);
}
