import { toRgb } from './colors.ts'
import { GLSL_UBO_PREAMBLE, HP_GLSL_UBO } from './uboCommon.ts'
import { fillColor } from '../../../shared/color.ts'

import type { RGBColor } from './colors.ts'

// ---- Arc shader constants ----
export const ARC_CURVE_SEGMENTS = 64
export const ARC_HEIGHT_MARGIN = 8
export const NUM_ARC_COLORS = 8
export const NUM_LINE_COLORS = 2

export const arcColorPalette: RGBColor[] = [
  toRgb(fillColor.color_pair_lr),
  toRgb(fillColor.color_longinsert),
  toRgb(fillColor.color_shortinsert),
  toRgb(fillColor.color_interchrom),
  toRgb(fillColor.color_pair_ll),
  toRgb(fillColor.color_pair_rr),
  toRgb(fillColor.color_pair_rl),
  toRgb(fillColor.color_longread_rev_fwd),
]

export const arcLineColorPalette: RGBColor[] = [
  toRgb(fillColor.color_interchrom),
  toRgb(fillColor.color_longinsert),
]

// WARNING: DO NOT DELETE THIS COMMENT.
// The arc/sashimi geometry and AA formula in this file MUST be kept in sync with
// the WGSL source in wgsl/miscShaders.ts (ARC_WGSL / SASHIMI_WGSL).
// Both implement the same stroke rendering logic:
//   - vertex: halfWidth = lineWidth * 0.5 + 1.0  (geometry padding)
//   - fragment: alpha = clamp((halfWidth - d) / aa + 0.5, 0, 1)  (AA formula)
// If you change either, update the other file to match.

export const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}

// SYNC(wgsl/miscShaders.ts): ArcInst struct { x1, x2, color_type, is_arc }
// Instance data (per-instance attributes via HAL)
in float a_x1;
in float a_x2;
in float a_colorType;
in float a_isArc;

out vec4 v_color;
out float v_dist;

// SYNC(wgsl/miscShaders.ts): PI = 3.14159265359
const float PI = 3.14159265359;

// Per-block coordinate conversion: bp offset -> screen pixel
// Uses blockStartPx (slot 24), blockWidth (slot 25), bpLen (slot 2), domainStart (slot 30)
float bpToPx(float bpOffset) {
  float pxPerBp = uf(25u) / uf(2u);
  return uf(24u) + (bpOffset - uf(30u)) * pxPerBp;
}

vec3 getArcColor(float colorType) {
  int idx = int(colorType + 0.5);
  if (idx < ${NUM_ARC_COLORS}) {
    return color3(98u + uint(idx) * 3u);
  }
  float h = uf(27u) / 360.0;
  float s = 0.5;
  float l = 0.5;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float xc = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c / 2.0;
  vec3 rgb;
  if (h < 1.0/6.0) rgb = vec3(c, xc, 0.0);
  else if (h < 2.0/6.0) rgb = vec3(xc, c, 0.0);
  else if (h < 3.0/6.0) rgb = vec3(0.0, c, xc);
  else if (h < 4.0/6.0) rgb = vec3(0.0, xc, c);
  else if (h < 5.0/6.0) rgb = vec3(xc, 0.0, c);
  else rgb = vec3(c, 0.0, xc);
  return rgb + m;
}

vec2 evalCurve(float t) {
  float startPx = bpToPx(a_x1);
  float endPx = bpToPx(a_x2);
  float radiusPx = (endPx - startPx) / 2.0;
  float absradPx = abs(radiusPx);
  float availableHeight = canvas_height() - coverage_offset() - ${ARC_HEIGHT_MARGIN}.0;
  float destY = min(availableHeight, absradPx);
  float screenX, y_px;
  if (a_isArc > 0.5) {
    float angle = t * PI;
    float cxPx = (startPx + endPx) / 2.0;
    screenX = cxPx + cos(angle) * radiusPx;
    float rawY = sin(angle) * absradPx;
    y_px = (absradPx > 0.0) ? rawY * (destY / absradPx) : 0.0;
  } else {
    // SYNC(wgsl/miscShaders.ts): cubic Bezier basis mt3, 3*mt2*t, 3*mt*t2, t3
    float mt = 1.0 - t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = t * t;
    float t3 = t2 * t;
    screenX = mt3 * startPx + 3.0 * mt2 * t * startPx + 3.0 * mt * t2 * endPx + t3 * endPx;
    y_px = 3.0 * mt2 * t * destY + 3.0 * mt * t2 * destY;
  }
  return vec2(screenX, y_px);
}

void main() {
  // Compute t and side from vertex index (triangle-strip topology)
  int seg = gl_VertexID / 2;
  float side = (gl_VertexID % 2 == 0) ? 1.0 : -1.0;
  float t = float(seg) / ${ARC_CURVE_SEGMENTS}.0;

  vec2 pos = evalCurve(t);
  float eps = 1.0 / ${ARC_CURVE_SEGMENTS}.0;
  float t0 = max(t - eps * 0.5, 0.0);
  float t1 = min(t + eps * 0.5, 1.0);
  vec2 p0 = evalCurve(t0);
  vec2 p1 = evalCurve(t1);
  vec2 tangent = p1 - p0;
  float tangentLen = length(tangent);
  vec2 normal;
  // SYNC(wgsl/miscShaders.ts): tangent threshold 0.001, halfWidth = lineWidth*0.5+1.0
  if (tangentLen > 0.001) {
    tangent /= tangentLen;
    normal = vec2(-tangent.y, tangent.x);
  } else {
    normal = vec2(0.0, 1.0);
  }
  float halfWidth = uf(26u) * 0.5 + 1.0;
  pos += normal * halfWidth * side;
  float clipX = (pos.x / canvas_width()) * 2.0 - 1.0;
  float clipY = 1.0 - ((pos.y + coverage_offset()) / canvas_height()) * 2.0;
  gl_Position = vec4(flip_x(clipX), clipY, 0.0, 1.0);
  v_dist = side * halfWidth;
  v_color = vec4(getArcColor(a_colorType), 1.0);
}
`

export const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}

in vec4 v_color;
in float v_dist;
out vec4 fragColor;
void main() {
  // SYNC(wgsl/miscShaders.ts): AA formula clamp((halfWidth - d) / aa + 0.5, 0, 1)
  float halfWidth = uf(26u) * 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float alpha = clamp((halfWidth - d) / aa + 0.5, 0.0, 1.0);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`

// ---- Sashimi arc shader constants ----
export const NUM_SASHIMI_COLORS = 2

// Pink forward, blue reverse (matches SVG sashimi)
export const sashimiColorPalette: RGBColor[] = [
  [1, 0.667, 0.667],
  [0.627, 0.627, 1],
]

export const SASHIMI_ARC_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}

// SYNC(wgsl/miscShaders.ts): SashimiInst struct { x1, x2, color_type, line_width }
// Instance data (per-instance attributes via HAL)
in float a_x1;
in float a_x2;
in float a_colorType;
in float a_lineWidth;

out vec4 v_color;
out float v_dist;
out float v_lineWidth;

// Per-block coordinate conversion: bp offset -> screen pixel
float bpToPx(float bpOffset) {
  float pxPerBp = uf(25u) / uf(2u);
  return uf(24u) + (bpOffset - uf(30u)) * pxPerBp;
}

// CRITICAL: This Bezier curve formula MUST match the CPU version in:
// hitTesting.ts:hitTestSashimiArc
vec2 evalCurve(float t) {
  float startPx = bpToPx(a_x1);
  float endPx = bpToPx(a_x2);
  float mt = 1.0 - t;
  float mt2 = mt * mt;
  float mt3 = mt2 * mt;
  float t2 = t * t;
  float t3 = t2 * t;
  float screenX = mt3 * startPx + 3.0 * mt2 * t * startPx + 3.0 * mt * t2 * endPx + t3 * endPx;
  float ch = uf(16u);
  // SYNC(wgsl/miscShaders.ts): destY = coverageHeight * (0.8/0.75), baseline at 0.9*covH
  float destY = ch * (0.8 / 0.75);
  float y_px = 3.0 * mt2 * t * destY + 3.0 * mt * t2 * destY;
  return vec2(screenX, 0.9 * ch - y_px);
}

void main() {
  // Compute t and side from vertex index (triangle-strip topology)
  int seg = gl_VertexID / 2;
  float side = (gl_VertexID % 2 == 0) ? 1.0 : -1.0;
  float t = float(seg) / ${ARC_CURVE_SEGMENTS}.0;

  vec2 pos = evalCurve(t);
  float eps = 1.0 / ${ARC_CURVE_SEGMENTS}.0;
  float t0 = max(t - eps * 0.5, 0.0);
  float t1 = min(t + eps * 0.5, 1.0);
  vec2 p0 = evalCurve(t0);
  vec2 p1 = evalCurve(t1);
  vec2 tangent = p1 - p0;
  float tangentLen = length(tangent);
  vec2 normal;
  if (tangentLen > 0.001) {
    tangent /= tangentLen;
    normal = vec2(-tangent.y, tangent.x);
  } else {
    normal = vec2(0.0, 1.0);
  }
  float halfWidth = a_lineWidth * 0.5 + 1.0;
  pos += normal * halfWidth * side;
  float clipX = (pos.x / canvas_width()) * 2.0 - 1.0;
  float clipY = 1.0 - ((pos.y + coverage_offset()) / canvas_height()) * 2.0;
  gl_Position = vec4(flip_x(clipX), clipY, 0.0, 1.0);
  v_dist = side * halfWidth;
  v_lineWidth = a_lineWidth;
  int idx = int(a_colorType + 0.5);
  if (idx < ${NUM_SASHIMI_COLORS}) {
    v_color = vec4(color3(128u + uint(idx) * 3u), 1.0);
  } else {
    v_color = vec4(color3(128u), 1.0);
  }
}
`

export const SASHIMI_ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_dist;
in float v_lineWidth;
out vec4 fragColor;
void main() {
  // SYNC(wgsl/miscShaders.ts): AA formula clamp((halfWidth - d) / aa + 0.5, 0, 1)
  float halfWidth = v_lineWidth * 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float alpha = clamp((halfWidth - d) / aa + 0.5, 0.0, 1.0);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`

export const ARC_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${HP_GLSL_UBO}

in uint a_position;
in float a_y;
in float a_colorType;

out vec4 v_color;

void main() {
  uint absPos = a_position + region_start();
  vec2 splitPos = hp_split_uint(absPos);
  float normalizedBpPos = hp_scale_linear(splitPos, bp_range());
  float screenX = uf(24u) + normalizedBpPos * uf(25u);
  float sx = (screenX / canvas_width()) * 2.0 - 1.0;
  float sy = 1.0 - ((a_y + coverage_offset()) / canvas_height()) * 2.0;
  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  int idx = int(a_colorType + 0.5);
  uint ci = uint(min(idx, ${NUM_LINE_COLORS - 1}));
  v_color = vec4(color3(122u + ci * 3u), 1.0);
}
`

export const ARC_LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`
