import { cssColorToRgb } from './colors.ts'
import { HP_GLSL_FUNCTIONS } from './utils.ts'
import { fillColor } from '../../../shared/color.ts'

import type { RGBColor } from './colors.ts'

// ---- Arc shader constants ----
export const ARC_CURVE_SEGMENTS = 64
export const NUM_ARC_COLORS = 8
export const NUM_LINE_COLORS = 2

export const arcColorPalette: RGBColor[] = [
  cssColorToRgb(fillColor.color_pair_lr),
  cssColorToRgb(fillColor.color_longinsert),
  cssColorToRgb(fillColor.color_shortinsert),
  cssColorToRgb(fillColor.color_interchrom),
  cssColorToRgb(fillColor.color_pair_ll),
  cssColorToRgb(fillColor.color_pair_rr),
  cssColorToRgb(fillColor.color_pair_rl),
  cssColorToRgb(fillColor.color_longread_rev_fwd),
]

export const arcLineColorPalette: RGBColor[] = [
  cssColorToRgb(fillColor.color_interchrom),
  cssColorToRgb(fillColor.color_longinsert),
]

export const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;
in float a_t;
in float a_side;
in float a_x1;
in float a_x2;
in float a_colorType;
in float a_isArc;

uniform float u_bpStartOffset;
uniform float u_bpRegionLength;
uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform float u_blockStartPx;
uniform float u_blockWidth;
uniform float u_coverageOffset;
uniform float u_lineWidthPx;
uniform float u_gradientHue;
uniform vec3 u_arcColors[${NUM_ARC_COLORS}];

out vec4 v_color;
out float v_dist;

const float PI = 3.14159265359;

vec3 getArcColor(float colorType) {
  int idx = int(colorType + 0.5);
  if (idx < ${NUM_ARC_COLORS}) {
    return u_arcColors[idx];
  }
  float h = u_gradientHue / 360.0;
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
  float radius = (a_x2 - a_x1) / 2.0;
  float absrad = abs(radius);
  float cx = a_x1 + radius;
  float pxPerBp = u_blockWidth / u_bpRegionLength;
  float absradPx = absrad * pxPerBp;
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float destY = min(availableHeight, absradPx);
  float x_bp, y_px;
  if (a_isArc > 0.5) {
    float angle = t * PI;
    x_bp = cx + cos(angle) * radius;
    float rawY = sin(angle) * absradPx;
    y_px = (absradPx > 0.0) ? rawY * (destY / absradPx) : 0.0;
  } else {
    float mt = 1.0 - t;
    float mt2 = mt * mt;
    float mt3 = mt2 * mt;
    float t2 = t * t;
    float t3 = t2 * t;
    x_bp = mt3 * a_x1 + 3.0 * mt2 * t * a_x1 + 3.0 * mt * t2 * a_x2 + t3 * a_x2;
    y_px = 3.0 * mt2 * t * destY + 3.0 * mt * t2 * destY;
  }
  float screenX = u_blockStartPx + (x_bp - u_bpStartOffset) * pxPerBp;
  return vec2(screenX, y_px);
}

void main() {
  vec2 pos = evalCurve(a_t);
  float eps = 1.0 / ${ARC_CURVE_SEGMENTS}.0;
  float t0 = max(a_t - eps * 0.5, 0.0);
  float t1 = min(a_t + eps * 0.5, 1.0);
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
  float halfWidth = u_lineWidthPx * 0.5 + 0.5;
  pos += normal * halfWidth * a_side;
  float clipX = (pos.x / u_canvasWidth) * 2.0 - 1.0;
  float clipY = 1.0 - ((pos.y + u_coverageOffset) / u_canvasHeight) * 2.0;
  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_dist = a_side * halfWidth;
  v_color = vec4(getArcColor(a_colorType), 1.0);
}
`

export const ARC_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in float v_dist;
uniform float u_lineWidthPx;
out vec4 fragColor;
void main() {
  float halfWidth = u_lineWidthPx * 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float alpha = 1.0 - smoothstep(halfWidth - aa * 0.5, halfWidth + aa, d);
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
in float a_t;
in float a_side;
in float a_x1;
in float a_x2;
in float a_colorType;
in float a_lineWidth;

uniform float u_bpStartOffset;
uniform float u_bpRegionLength;
uniform float u_canvasWidth;
uniform float u_canvasHeight;
uniform float u_blockStartPx;
uniform float u_blockWidth;
uniform float u_coverageOffset;
uniform float u_coverageHeight;
uniform vec3 u_sashimiColors[${NUM_SASHIMI_COLORS}];

out vec4 v_color;
out float v_dist;
out float v_lineWidth;

// CRITICAL: This Bezier curve formula MUST match the CPU version in:
// WebGLAlignmentsComponent.tsx:hitTestSashimiArc (around line 1389)
// If either implementation changes, the other MUST be updated to match,
// otherwise picking and rendering will be out of sync.
vec2 evalCurve(float t) {
  float mt = 1.0 - t;
  float mt2 = mt * mt;
  float mt3 = mt2 * mt;
  float t2 = t * t;
  float t3 = t2 * t;
  float x_bp = mt3 * a_x1 + 3.0 * mt2 * t * a_x1 + 3.0 * mt * t2 * a_x2 + t3 * a_x2;
  // Quadratic Bezier peaks at 0.75 of destY. Scale destY so the peak reaches
  // 0.8*coverageHeight amplitude (from 0.9 to 0.1 of coverage height)
  float destY = u_coverageHeight * (0.8 / 0.75);
  float y_px = 3.0 * mt2 * t * destY + 3.0 * mt * t2 * destY;
  float pxPerBp = u_blockWidth / u_bpRegionLength;
  float screenX = u_blockStartPx + (x_bp - u_bpStartOffset) * pxPerBp;
  // Arc baseline at 0.9*coverageHeight, peaks at 0.1*coverageHeight
  return vec2(screenX, 0.9 * u_coverageHeight - y_px);
}

void main() {
  vec2 pos = evalCurve(a_t);
  float eps = 1.0 / ${ARC_CURVE_SEGMENTS}.0;
  float t0 = max(a_t - eps * 0.5, 0.0);
  float t1 = min(a_t + eps * 0.5, 1.0);
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
  float halfWidth = a_lineWidth * 0.5 + 0.5;
  pos += normal * halfWidth * a_side;
  float clipX = (pos.x / u_canvasWidth) * 2.0 - 1.0;
  float clipY = 1.0 - ((pos.y + u_coverageOffset) / u_canvasHeight) * 2.0;
  gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  v_dist = a_side * halfWidth;
  v_lineWidth = a_lineWidth;
  int idx = int(a_colorType + 0.5);
  if (idx < ${NUM_SASHIMI_COLORS}) {
    v_color = vec4(u_sashimiColors[idx], 1.0);
  } else {
    v_color = vec4(u_sashimiColors[0], 1.0);
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
  float halfWidth = v_lineWidth * 0.5;
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float alpha = 1.0 - smoothstep(halfWidth - aa * 0.5, halfWidth + aa, d);
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`

export const ARC_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
in uint a_position;
in float a_y;
in float a_colorType;
uniform vec3 u_bpRangeX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_canvasWidth;
uniform float u_coverageOffset;
uniform float u_blockStartPx;
uniform float u_blockWidth;
uniform vec3 u_arcLineColors[${NUM_LINE_COLORS}];
out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  uint absPos = a_position + u_regionStart;
  vec2 splitPos = hpSplitUint(absPos);
  // Map genomic position to block-relative pixel, then to global clip space
  float normalizedBpPos = hpScaleLinear(splitPos, u_bpRangeX);
  float screenX = u_blockStartPx + normalizedBpPos * u_blockWidth;
  float sx = (screenX / u_canvasWidth) * 2.0 - 1.0;
  float sy = 1.0 - ((a_y + u_coverageOffset) / u_canvasHeight) * 2.0;
  gl_Position = vec4(sx, sy, 0.0, 1.0);
  int idx = int(a_colorType + 0.5);
  if (idx < ${NUM_LINE_COLORS}) {
    v_color = vec4(u_arcLineColors[idx], 1.0);
  } else {
    v_color = vec4(u_arcLineColors[0], 1.0);
  }
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
