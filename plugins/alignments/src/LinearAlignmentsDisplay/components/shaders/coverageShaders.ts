// Coverage vertex shader - renders grey bars for total coverage
// Uses explicit position attribute for consistent positioning with other coverage elements
export const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;    // position offset from regionStart
in float a_depth;       // normalized depth (0-1, against per-region max)

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_coverageHeight;  // height in pixels
uniform float u_coverageYOffset; // padding at top/bottom for scalebar labels
uniform float u_depthScale;      // perRegionMax / nicedOverallMax correction
uniform float u_binSize;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Coverage bar color (typically light grey)
uniform vec3 u_colorCoverage;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  // Use explicit position (offset from regionStart)
  float domainWidth = u_visibleRange.y - u_visibleRange.x;

  float x1 = (a_position - u_visibleRange.x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + u_binSize - u_visibleRange.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  // Y: coverage area at top of canvas with offset padding
  // Effective drawing area is from offset to coverageHeight-offset
  // depthScale corrects for nice() domain expansion and multi-region max differences
  float effectiveHeight = u_coverageHeight - 2.0 * u_coverageYOffset;
  float coverageBottom = 1.0 - ((u_coverageHeight - u_coverageYOffset) / u_canvasHeight) * 2.0;
  float barTop = coverageBottom + (a_depth * u_depthScale * effectiveHeight / u_canvasHeight) * 2.0;
  float sy = mix(coverageBottom, barTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(u_colorCoverage, 1.0);
}
`

export const COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// SNP Coverage vertex shader - renders colored stacked bars at exact positions
// Uses simple float offsets (relative to regionStart) - sufficient for coverage features
export const SNP_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;       // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in float a_colorType;     // 1=A(green), 2=C(blue), 3=G(orange), 4=T(red)

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_coverageHeight;
uniform float u_coverageYOffset; // padding at top/bottom for scalebar labels
uniform float u_depthScale;      // perRegionMax / nicedOverallMax correction
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Base color uniforms from theme
uniform vec3 u_colorBaseA;
uniform vec3 u_colorBaseC;
uniform vec3 u_colorBaseG;
uniform vec3 u_colorBaseT;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_visibleRange.y - u_visibleRange.x;
  float x1 = (a_position - u_visibleRange.x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + 1.0 - u_visibleRange.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  // Y: stacked from bottom of coverage area with offset padding
  float effectiveHeight = u_coverageHeight - 2.0 * u_coverageYOffset;
  float coverageBottom = 1.0 - ((u_coverageHeight - u_coverageYOffset) / u_canvasHeight) * 2.0;
  float segmentBot = coverageBottom + (a_yOffset * u_depthScale * effectiveHeight / u_canvasHeight) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * u_depthScale * effectiveHeight / u_canvasHeight) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Colors: A=green, C=blue, G=orange, T=red (from theme uniforms)
  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(u_colorBaseA, 1.0);
  } else if (colorIdx == 2) {
    v_color = vec4(u_colorBaseC, 1.0);
  } else if (colorIdx == 3) {
    v_color = vec4(u_colorBaseG, 1.0);
  } else {
    v_color = vec4(u_colorBaseT, 1.0);
  }
}
`

export const SNP_COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Modification coverage vertex shader - renders colored stacked bars at exact positions
// Like SNP coverage but uses per-instance RGBA color instead of color type lookup
export const MOD_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;       // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in vec4 a_color;          // RGBA color (normalized from Uint8)

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_coverageHeight;
uniform float u_coverageYOffset; // padding at top/bottom for scalebar labels
uniform float u_depthScale;      // perRegionMax / nicedOverallMax correction
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_visibleRange.y - u_visibleRange.x;
  float x1 = (a_position - u_visibleRange.x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + 1.0 - u_visibleRange.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  // Y: stacked from bottom of coverage area with offset padding
  float effectiveHeight = u_coverageHeight - 2.0 * u_coverageYOffset;
  float coverageBottom = 1.0 - ((u_coverageHeight - u_coverageYOffset) / u_canvasHeight) * 2.0;
  float segmentBot = coverageBottom + (a_yOffset * u_depthScale * effectiveHeight / u_canvasHeight) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * u_depthScale * effectiveHeight / u_canvasHeight) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

export const MOD_COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Noncov (interbase) histogram vertex shader - renders colored bars DOWNWARD from top
// For insertion/softclip/hardclip counts aggregated by position
// Uses FIXED PIXEL WIDTH (1.2px like the original renderer) regardless of zoom
export const NONCOV_HISTOGRAM_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;      // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in float a_colorType;     // 1=insertion, 2=softclip, 3=hardclip

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_noncovHeight; // height in pixels for noncov bars
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Indel/clip color uniforms from theme
uniform vec3 u_colorInsertion;
uniform vec3 u_colorSoftclip;
uniform vec3 u_colorHardclip;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_visibleRange.y - u_visibleRange.x;

  // Center position in clip space
  float cx = (a_position - u_visibleRange.x) / domainWidth * 2.0 - 1.0;

  // Fixed pixel width (1px)
  float barWidthClip = 1.0 / u_canvasWidth * 2.0;
  float x1 = cx - barWidthClip * 0.5;
  float x2 = cx + barWidthClip * 0.5;

  float sx = mix(x1, x2, localX);

  // Y: bars grow DOWNWARD from top of canvas, below indicator triangles
  // Top of canvas is y=1.0 in clip space
  // Offset by indicator triangle height (4.5px) so bars appear directly below triangles
  float indicatorOffsetClip = 4.5 / u_canvasHeight * 2.0;
  float segmentTop = 1.0 - indicatorOffsetClip - (a_yOffset * u_noncovHeight / u_canvasHeight) * 2.0;
  float segmentBot = segmentTop - (a_segmentHeight * u_noncovHeight / u_canvasHeight) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Colors from theme uniforms
  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(u_colorInsertion, 1.0);
  } else if (colorIdx == 2) {
    v_color = vec4(u_colorSoftclip, 1.0);
  } else {
    v_color = vec4(u_colorHardclip, 1.0);
  }
}
`

export const NONCOV_HISTOGRAM_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Interbase indicator vertex shader - renders small triangles pointing DOWN
// at positions with significant insertion/softclip/hardclip counts
// Positioned at the very top of the coverage area
export const INDICATOR_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;   // position offset from regionStart
in float a_colorType;  // 1=insertion, 2=softclip, 3=hardclip (dominant type)

uniform vec2 u_visibleRange;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Indel/clip color uniforms from theme
uniform vec3 u_colorInsertion;
uniform vec3 u_colorSoftclip;
uniform vec3 u_colorHardclip;

out vec4 v_color;

void main() {
  // Triangle: 3 vertices per indicator
  int vid = gl_VertexID % 3;

  float domainWidth = u_visibleRange.y - u_visibleRange.x;
  float cx = (a_position - u_visibleRange.x) / domainWidth * 2.0 - 1.0;

  // Triangle dimensions in clip space
  float triangleWidth = 7.0 / u_canvasWidth * 2.0;  // 7px wide
  float triangleHeight = 4.5 / u_canvasHeight * 2.0; // 4.5px tall

  float sx, sy;
  if (vid == 0) {
    // Top left
    sx = cx - triangleWidth * 0.5;
    sy = 1.0;
  } else if (vid == 1) {
    // Top right
    sx = cx + triangleWidth * 0.5;
    sy = 1.0;
  } else {
    // Bottom center (point)
    sx = cx;
    sy = 1.0 - triangleHeight;
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Colors from theme uniforms
  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(u_colorInsertion, 1.0);
  } else if (colorIdx == 2) {
    v_color = vec4(u_colorSoftclip, 1.0);
  } else {
    v_color = vec4(u_colorHardclip, 1.0);
  }
}
`

export const INDICATOR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Simple line shader for drawing separator
export const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec4 u_color;
void main() {
  fragColor = u_color;
}
`
