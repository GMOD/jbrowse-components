import { HP_GLSL_FUNCTIONS } from './utils.ts'

// Connecting line shader for chain modes (cloud/linkedRead)
// Draws thin horizontal lines between chain min(start) and max(end)
// at the chain's Y row, connecting the individual reads visually
export const CONNECTING_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position; // [startOffset, endOffset] from regionStart
in float a_y;        // row number
in float a_colorType; // 0=normal, 1=long, 2=short, 3=interchrom, 4=orientation

uniform vec3 u_bpRangeX;       // [startHi, startLo, length] for HP position
uniform uint u_regionStart;
uniform float u_featureHeight;
uniform float u_canvasHeight;
uniform float u_scrollTop;      // Y scroll offset in pixels
uniform float u_coverageOffset; // coverage area height

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

vec3 getLineColor(float colorType) {
  if (colorType < 0.5) return vec3(0.7, 0.7, 0.7); // normal: light grey
  if (colorType < 1.5) return vec3(0.85, 0.25, 0.25); // long insert: red
  if (colorType < 2.5) return vec3(0.25, 0.35, 0.85); // short insert: blue
  if (colorType < 3.5) return vec3(0.5, 0.0, 0.5); // interchrom: purple
  return vec3(0.0, 0.5, 0.0); // orientation: green
}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_bpRangeX);
  float sx2 = hpToClipX(splitEnd, u_bpRangeX);
  float sx = mix(sx1, sx2, localX);

  // Y positioning: center of the feature row, 1px tall line
  float rowCenter = u_coverageOffset + a_y * u_featureHeight + u_featureHeight * 0.5 - u_scrollTop;
  float lineHalfHeight = 0.5; // 1px line
  float yTop = rowCenter - lineHalfHeight;
  float yBot = rowCenter + lineHalfHeight;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - yTop * pxToClip;
  float syBot = 1.0 - yBot * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(getLineColor(a_colorType), 0.5);
}
`

export const CONNECTING_LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`
