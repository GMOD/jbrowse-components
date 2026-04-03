import { GLSL_UBO_PREAMBLE, HP_GLSL_UBO } from './uboCommon.ts'

export const CONNECTING_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${HP_GLSL_UBO}

// SYNC(wgsl/miscShaders.ts): ConnectingLineInst struct { start_off, end_off, y }
in uvec2 a_position; // [startOffset, endOffset] from regionStart
in float a_y;        // row number

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  uint absStart = a_position.x + region_start();
  uint absEnd = a_position.y + region_start();
  vec2 splitStart = hp_split_uint(absStart);
  vec2 splitEnd = hp_split_uint(absEnd);
  float sx1 = hp_to_clip_x(splitStart, bp_range());
  float sx2 = hp_to_clip_x(splitEnd, bp_range());
  float sx = mix(sx1, sx2, localX);

  float rowHeight = feature_height() + feature_spacing();
  float rowCenter = coverage_offset() + a_y * rowHeight + feature_height() * 0.5 - uf(28u);
  float yTop = floor(rowCenter - 0.5);
  float yBot = yTop + 1.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = 1.0 - yTop * pxToClip;
  float syBot = 1.0 - yBot * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  // SYNC(wgsl/miscShaders.ts): line color vec4(0,0,0,0.45), 1px tall with floor snapping
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
