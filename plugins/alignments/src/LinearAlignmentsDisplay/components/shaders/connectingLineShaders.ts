import { HP_GLSL_FUNCTIONS } from './utils.ts'

// Connecting line shader for chain modes (cloud/linkedRead)
// Draws thin horizontal lines between chain min(start) and max(end)
// at the chain's Y row, connecting the individual reads visually
export const CONNECTING_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position; // [startOffset, endOffset] from regionStart
in float a_y;        // row number

uniform vec3 u_bpRangeX;       // [startHi, startLo, length] for HP position
uniform uint u_regionStart;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_canvasHeight;
uniform float u_scrollTop;      // Y scroll offset in pixels
uniform float u_coverageOffset; // coverage area height

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

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

  // Y positioning: center of the feature row, exactly 1px tall line
  float rowHeight = u_featureHeight + u_featureSpacing;
  float rowCenter = u_coverageOffset + a_y * rowHeight + u_featureHeight * 0.5 - u_scrollTop;
  float yTop = floor(rowCenter - 0.5);
  float yBot = yTop + 1.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = 1.0 - yTop * pxToClip;
  float syBot = 1.0 - yBot * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  // Plain grey line matching canvas LinearReadCloudDisplay (#6665)
  v_color = vec4(0, 0, 0, 0.45);
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
