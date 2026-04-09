import { HP_GLSL_CORE } from '@jbrowse/alignments-core'

// SYNC: Hand-written GLSL ES 3.00 for the WebGL2 fallback via HAL.
// Mirrors the WGSL shaders in canvasShaders.ts (used by WebGPU).
// Uses a std140 UBO instead of individual uniforms (required by HAL).
// Uses interleaved vertex attributes matching the storage buffer layout.

const UNIFORMS_BLOCK = `
layout(std140) uniform Uniforms {
  vec3 bp_range_x;
  uint region_start;
  float canvas_height;
  float canvas_width;
  float scroll_y;
  float bp_per_px;
  float zero;
  float reversed;
};

${HP_GLSL_CORE}

float snapToPixelX(float clipX) {
  float px = (clipX + 1.0) * 0.5 * canvas_width;
  return floor(px + 0.5) / canvas_width * 2.0 - 1.0;
}
`

export const RECT_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_start_end;
in float a_y;
in float a_height;
in vec4 a_color;

out vec4 v_color;

${UNIFORMS_BLOCK}

void main() {
  uint vid = uint(gl_VertexID) % 6u;
  float localX = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float localY = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;

  uint absStart = a_start_end.x + region_start;
  uint absEnd = a_start_end.y + region_start;
  float sx1 = snapToPixelX(hpToClipX(hpSplitUint(absStart), bp_range_x, zero));
  float sx2 = snapToPixelX(hpToClipX(hpSplitUint(absEnd), bp_range_x, zero));

  // SYNC: must match MIN_RECT_WIDTH_PX in sharedRendererConstants.ts
  float minWidth = 4.0 / canvas_width;
  float dx = sx2 - sx1;
  if (abs(dx) < minWidth) {
    sx2 = sx1 + (dx < 0.0 ? -minWidth : minWidth);
  }

  float sx = mix(sx1, sx2, localX);

  float yTopPx = floor(a_y - scroll_y + 0.5);
  float yBotPx = floor(yTopPx + a_height + 0.5);
  float syTop = 1.0 - (yTopPx / canvas_height) * 2.0;
  float syBot = 1.0 - (yBotPx / canvas_height) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

export const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_start_end;
in float a_y;
in float a_direction;
in vec4 a_color;

out vec4 v_color;

${UNIFORMS_BLOCK}

void main() {
  uint vid = uint(gl_VertexID) % 6u;

  uint absStart = a_start_end.x + region_start;
  uint absEnd = a_start_end.y + region_start;
  float sx1 = hpToClipX(hpSplitUint(absStart), bp_range_x, zero);
  float sx2 = hpToClipX(hpSplitUint(absEnd), bp_range_x, zero);

  float yPx = floor(a_y - scroll_y + 0.5) + 0.5;
  float cy = 1.0 - (yPx / canvas_height) * 2.0;
  float halfPx = 1.0 / canvas_height;

  float localX = (vid == 0u || vid == 2u || vid == 3u) ? 0.0 : 1.0;
  float localY = (vid == 0u || vid == 1u || vid == 4u) ? 0.0 : 1.0;
  float sx = mix(sx1, sx2, localX);
  float sy = mix(cy - halfPx, cy + halfPx, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

export const CHEVRON_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_start_end;
in float a_y;
in float a_direction;
in vec4 a_color;

out vec4 v_color;

${UNIFORMS_BLOCK}

void main() {
  int localChevronIndex = gl_VertexID / 12;
  uint v = uint(gl_VertexID) % 12u;

  float lineLengthBp = float(a_start_end.y - a_start_end.x);
  float lineWidthPx = lineLengthBp / bp_per_px;
  float chevronSpacingPx = 25.0;

  if (a_direction == 0.0 || lineWidthPx < chevronSpacingPx * 0.5) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  int totalChevrons = max(1, int(floor(lineWidthPx / chevronSpacingPx)));
  float bpSpacing = lineLengthBp / float(totalChevrons + 1);

  float vpBase = bp_range_x.x + bp_range_x.y - float(region_start) - float(a_start_end.x);
  float vpOther = vpBase + bp_range_x.z;
  float viewportStartBp = min(vpBase, vpOther);
  float viewportEndBp = max(vpBase, vpOther);

  int firstVisible = max(0, int(floor(viewportStartBp / bpSpacing)) - 1);
  int lastVisible = min(totalChevrons - 1, int(ceil(viewportEndBp / bpSpacing)));

  int globalChevronIndex = firstVisible + localChevronIndex;

  if (globalChevronIndex < 0 || globalChevronIndex > lastVisible || globalChevronIndex >= totalChevrons) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  float chevronOffsetBp = bpSpacing * float(globalChevronIndex + 1);
  uint lineStartAbs = a_start_end.x + region_start;
  vec2 splitStart = hpSplitUint(lineStartAbs);
  vec2 splitChevron = vec2(splitStart.x, splitStart.y + chevronOffsetBp);
  float cx = hpToClipX(splitChevron, bp_range_x, zero);

  float yPx = floor(a_y - scroll_y + 0.5) + 0.5;
  float cy = 1.0 - (yPx / canvas_height) * 2.0;

  float halfW = 4.5 / canvas_width;
  float halfH = 4.5 / canvas_height;
  float thickness = 1.5 / canvas_height;
  float dir = mix(a_direction, -a_direction, reversed);

  bool isTopArm = v < 6u;
  uint qv = v % 6u;
  float sx, sy;

  float tipX = cx + halfW * dir;
  float outerX = cx - halfW * dir;
  float armY = isTopArm ? halfH : -halfH;

  if (qv == 0u) { sx = outerX; sy = cy + armY; }
  else if (qv == 1u) { sx = tipX; sy = cy + thickness * 0.5; }
  else if (qv == 2u) { sx = tipX; sy = cy - thickness * 0.5; }
  else if (qv == 3u) { sx = outerX; sy = cy + armY; }
  else if (qv == 4u) { sx = tipX; sy = cy - thickness * 0.5; }
  else { sx = outerX; sy = cy + armY - (isTopArm ? thickness : -thickness); }

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

export const ARROW_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_x;
in float a_color_a;
in float a_y;
in float a_direction;
in float a_height;
in float a_color_r;
in float a_color_g;
in float a_color_b;

out vec4 v_color;

${UNIFORMS_BLOCK}

void main() {
  int vid = gl_VertexID % 9;

  uint absX = a_x + region_start;
  float cx = hpToClipX(hpSplitUint(absX), bp_range_x, zero);

  float yPx = floor(a_y - scroll_y + 0.5) + 0.5;
  float cy = 1.0 - (yPx / canvas_height) * 2.0;

  float stemLength = 7.0 / canvas_width * 2.0;
  float stemHalf = 0.5 / canvas_height * 2.0;
  float headHalf = 2.5 / canvas_height * 2.0;

  float dir = mix(a_direction, -a_direction, reversed);

  float sx, sy;
  if (vid < 6) {
    float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    float localY = (vid == 0 || vid == 1 || vid == 4) ? 1.0 : -1.0;
    sx = cx + localX * stemLength * 0.5 * dir;
    sy = cy + localY * stemHalf;
  } else {
    int hvid = vid - 6;
    if (hvid == 0) {
      sx = cx + stemLength * 0.5 * dir;
      sy = cy + headHalf;
    } else if (hvid == 1) {
      sx = cx + stemLength * 0.5 * dir;
      sy = cy - headHalf;
    } else {
      sx = cx + stemLength * dir;
      sy = cy;
    }
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(a_color_r, a_color_g, a_color_b, a_color_a);
}
`

export const SIMPLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`
