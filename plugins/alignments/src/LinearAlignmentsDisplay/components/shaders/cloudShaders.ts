import { HP_GLSL_FUNCTIONS } from './utils.ts'

// ---- Cloud shader constants ----
export const CLOUD_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
in uvec2 a_position;
in float a_y;
in float a_flags;
in float a_colorType;
uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_featureHeight;
uniform float u_canvasHeight;
uniform float u_coverageOffset;
uniform int u_colorScheme;
out vec4 v_color;

${HP_GLSL_FUNCTIONS}

vec3 getInsertSizeOrientationColor(float colorType, float flags) {
  if (colorType < 0.5) return vec3(0.55, 0.55, 0.55);
  if (colorType < 1.5) return vec3(0.85, 0.25, 0.25);
  if (colorType < 2.5) return vec3(0.25, 0.35, 0.85);
  if (colorType < 3.5) return vec3(0.5, 0.0, 0.5);
  return vec3(0.0, 0.5, 0.0);
}

vec3 cloudStrandColor(float flags) {
  bool isReverse = mod(floor(flags / 16.0), 2.0) > 0.5;
  return isReverse ? vec3(0.55, 0.55, 0.85) : vec3(0.85, 0.55, 0.55);
}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);
  float sx = mix(sx1, sx2, localX);
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yTopPx = u_coverageOffset + (1.0 - a_y) * availableHeight - u_featureHeight * 0.5;
  float yBotPx = yTopPx + u_featureHeight;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - yTopPx * pxToClip;
  float syBot = 1.0 - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);
  gl_Position = vec4(sx, sy, 0.0, 1.0);
  vec3 color;
  if (u_colorScheme == 0) {
    color = getInsertSizeOrientationColor(a_colorType, a_flags);
  } else if (u_colorScheme == 1) {
    color = cloudStrandColor(a_flags);
  } else {
    color = vec3(0.55);
  }
  v_color = vec4(color, 1.0);
}
`

export const CLOUD_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`
