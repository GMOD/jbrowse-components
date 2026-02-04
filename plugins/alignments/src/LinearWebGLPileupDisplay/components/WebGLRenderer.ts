/**
 * WebGL Renderer for pileup display
 *
 * Handles shader compilation, buffer management, and rendering.
 * Data is uploaded once, then rendering only updates uniforms.
 */

import type { FeatureData, CoverageData, SNPCoverageData, GapData, MismatchData, InsertionData } from '../model'

// Vertex shader for reads
const READ_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;
in float a_y;
in float a_flags;
in float a_mapq;
in float a_insertSize;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform int u_colorScheme;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;  // pixels to offset down for coverage area
uniform float u_canvasHeight;

out vec4 v_color;

vec3 strandColor(float flags) {
  return vec3(0.8, 0.8, 0.8);
}

vec3 mapqColor(float mapq) {
  float t = clamp(mapq / 60.0, 0.0, 1.0);
  return mix(vec3(0.85, 0.35, 0.35), vec3(0.35, 0.45, 0.85), t);
}

vec3 insertSizeColor(float insertSize) {
  float normal = 400.0;
  float dev = abs(insertSize - normal) / normal;
  if (insertSize < normal) {
    return mix(vec3(0.55), vec3(0.85, 0.25, 0.25), clamp(dev * 2.0, 0.0, 1.0));
  }
  return mix(vec3(0.55), vec3(0.25, 0.35, 0.85), clamp(dev, 0.0, 1.0));
}

vec3 firstOfPairColor(float flags) {
  bool isFirst = mod(floor(flags / 64.0), 2.0) > 0.5;
  return isFirst ? vec3(0.85, 0.53, 0.53) : vec3(0.53, 0.53, 0.85);
}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (a_position.x - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (a_position.y - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  // Calculate available height for pileup (below coverage)
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  // Map to clip space, accounting for coverage offset at top
  // Coverage takes top u_coverageOffset pixels
  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  vec3 color;
  if (u_colorScheme == 0) color = strandColor(a_flags);
  else if (u_colorScheme == 1) color = mapqColor(a_mapq);
  else if (u_colorScheme == 2) color = insertSizeColor(a_insertSize);
  else if (u_colorScheme == 3) color = firstOfPairColor(a_flags);
  else color = vec3(0.6);

  v_color = vec4(color, 1.0);
}
`

const READ_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Coverage vertex shader - renders grey bars for total coverage
const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;    // genomic position (start of bin)
in float a_depth;       // normalized depth (0-1)

uniform vec2 u_visibleRange;  // visible genomic range [start, end]
uniform float u_coverageHeight;  // height in pixels
uniform float u_binSize;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float visibleWidth = u_visibleRange.y - u_visibleRange.x;

  // X: map genomic position to clip space
  float x1 = (a_position - u_visibleRange.x) / visibleWidth * 2.0 - 1.0;
  float x2 = (a_position + u_binSize - u_visibleRange.x) / visibleWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  // Y: coverage area at top of canvas
  float coverageBottom = 1.0 - (u_coverageHeight / u_canvasHeight) * 2.0;
  float barTop = coverageBottom + (a_depth * u_coverageHeight / u_canvasHeight) * 2.0;
  float sy = mix(coverageBottom, barTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(0.8, 0.8, 0.8, 1.0);  // light grey
}
`

const COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// SNP Coverage vertex shader - renders colored stacked bars at exact positions
const SNP_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;      // exact genomic position (1bp)
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in float a_colorType;     // 1=A(green), 2=C(blue), 3=G(orange), 4=T(red)

uniform vec2 u_visibleRange;
uniform float u_coverageHeight;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float visibleWidth = u_visibleRange.y - u_visibleRange.x;

  // X: 1bp wide bar
  float x1 = (a_position - u_visibleRange.x) / visibleWidth * 2.0 - 1.0;
  float x2 = (a_position + 1.0 - u_visibleRange.x) / visibleWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  // Y: stacked from bottom of coverage area
  float coverageBottom = 1.0 - (u_coverageHeight / u_canvasHeight) * 2.0;
  float segmentBot = coverageBottom + (a_yOffset * u_coverageHeight / u_canvasHeight) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * u_coverageHeight / u_canvasHeight) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Colors: A=green, C=blue, G=orange, T=red
  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(0.3, 0.8, 0.3, 1.0);      // A - green
  } else if (colorIdx == 2) {
    v_color = vec4(0.3, 0.3, 0.9, 1.0);      // C - blue
  } else if (colorIdx == 3) {
    v_color = vec4(0.9, 0.7, 0.2, 1.0);      // G - orange
  } else {
    v_color = vec4(0.9, 0.3, 0.3, 1.0);      // T - red
  }
}
`

const SNP_COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Simple line shader for drawing separator
const LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec4 u_color;
void main() {
  fragColor = u_color;
}
`

// Gap (deletion/skip) vertex shader - dark rectangles over reads
const GAP_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_position;  // start, end
in float a_y;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (a_position.x - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (a_position.y - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  // Gap is a thin line in the middle of the read row
  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;

  float yMid = a_y * rowHeight + u_featureHeight * 0.5;
  float gapHeight = u_featureHeight * 0.3;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yMid - gapHeight - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yMid + gapHeight - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
}
`

const GAP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() {
  fragColor = vec4(0.15, 0.15, 0.15, 1.0);  // Dark for deletion
}
`

// Mismatch vertex shader - colored rectangles for SNPs
const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;  // Genomic position
in float a_y;
in float a_base;      // 0=A, 1=C, 2=G, 3=T

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;

  // Mismatch is 1bp wide
  float x1 = a_position;
  float x2 = a_position + 1.0;

  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Base colors: A=green, C=blue, G=orange, T=red
  vec3 baseColors[4] = vec3[4](
    vec3(0.3, 0.8, 0.3),   // A = green
    vec3(0.3, 0.3, 0.9),   // C = blue
    vec3(0.9, 0.7, 0.2),   // G = orange
    vec3(0.9, 0.3, 0.3)    // T = red
  );
  int baseIdx = int(a_base);
  v_color = vec4(baseColors[baseIdx], 1.0);
}
`

const MISMATCH_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Insertion vertex shader - vertical bars like PileupRenderer
// Renders: main bar + top tick + bottom tick (3 rectangles = 18 vertices per insertion)
const INSERTION_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;
in float a_y;
in float a_length;  // insertion length

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  // Each insertion uses 18 vertices (3 rectangles x 6 vertices each)
  // Rectangle 0: main vertical bar
  // Rectangle 1: top horizontal tick
  // Rectangle 2: bottom horizontal tick
  int rectIdx = gl_VertexID / 6;
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float bpPerPx = domainWidth / u_canvasWidth;
  float invBpPerPx = 1.0 / bpPerPx;

  // Bar width: max 1.2px in genomic coords, min 1px
  float barWidthBp = max(bpPerPx, min(1.2 * bpPerPx, 1.0));
  float tickWidthBp = barWidthBp * 3.0;  // Tick marks are 3x wider

  float cx = a_position;

  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;

  float x1, x2, y1, y2;

  if (rectIdx == 0) {
    // Main vertical bar
    x1 = cx - barWidthBp * 0.5;
    x2 = cx + barWidthBp * 0.5;
    y1 = syBot;
    y2 = syTop;
  } else if (rectIdx == 1) {
    // Top tick (only show when zoomed in enough)
    if (invBpPerPx < 6.0) {
      // Not zoomed in enough - degenerate to zero-area rect
      x1 = cx;
      x2 = cx;
      y1 = syTop;
      y2 = syTop;
    } else {
      x1 = cx - tickWidthBp * 0.5;
      x2 = cx + tickWidthBp * 0.5;
      float tickHeight = 1.0 / u_canvasHeight * 2.0;  // 1px in clip space
      y1 = syTop;
      y2 = syTop + tickHeight;
    }
  } else {
    // Bottom tick (only show when zoomed in enough)
    if (invBpPerPx < 6.0) {
      x1 = cx;
      x2 = cx;
      y1 = syBot;
      y2 = syBot;
    } else {
      x1 = cx - tickWidthBp * 0.5;
      x2 = cx + tickWidthBp * 0.5;
      float tickHeight = 1.0 / u_canvasHeight * 2.0;
      y1 = syBot - tickHeight;
      y2 = syBot;
    }
  }

  // Transform X to clip space
  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel for the bar
  float minWidth = 2.0 / u_canvasWidth;
  if (rectIdx == 0 && sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);
  float sy = mix(y1, y2, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(0.8, 0.2, 0.8, 1.0);  // Purple for insertions
}
`

const INSERTION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Soft clip vertex shader - small colored bars
const SOFTCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;
in float a_y;
in float a_length;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float bpPerPx = domainWidth / u_canvasWidth;

  // Soft clip bar width
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float cx = a_position;
  float x1 = cx - barWidthBp * 0.5;
  float x2 = cx + barWidthBp * 0.5;

  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width
  float minWidth = 2.0 / u_canvasWidth;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(0.6, 0.6, 0.6, 1.0);  // Grey for soft clips
}
`

const SOFTCLIP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Hard clip vertex shader - dark bars
const HARDCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;
in float a_y;
in float a_length;

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float bpPerPx = domainWidth / u_canvasWidth;

  // Hard clip bar width
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float cx = a_position;
  float x1 = cx - barWidthBp * 0.5;
  float x2 = cx + barWidthBp * 0.5;

  float sx1 = (x1 - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (x2 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width
  float minWidth = 2.0 / u_canvasWidth;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float availableHeight = u_canvasHeight - u_coverageOffset;
  float yRange = u_rangeY.y - u_rangeY.x;
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTop = a_y * rowHeight;
  float yBot = yTop + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float syTop = pileupTop - (yTop - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float syBot = pileupTop - (yBot - u_rangeY.x) / yRange * (availableHeight / u_canvasHeight) * 2.0;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(0.3, 0.3, 0.3, 1.0);  // Dark grey for hard clips
}
`

const HARDCLIP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface RenderState {
  domainX: [number, number]
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  showMismatches: boolean
}

interface GPUBuffers {
  readVAO: WebGLVertexArrayObject
  readCount: number
  coverageVAO: WebGLVertexArrayObject | null
  coverageCount: number
  maxDepth: number
  binSize: number
  // SNP coverage (exact positions)
  snpCoverageVAO: WebGLVertexArrayObject | null
  snpCoverageCount: number
  // CIGAR data
  gapVAO: WebGLVertexArrayObject | null
  gapCount: number
  mismatchVAO: WebGLVertexArrayObject | null
  mismatchCount: number
  insertionVAO: WebGLVertexArrayObject | null
  insertionCount: number
  softclipVAO: WebGLVertexArrayObject | null
  softclipCount: number
  hardclipVAO: WebGLVertexArrayObject | null
  hardclipCount: number
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private readProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private snpCoverageProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private gapProgram: WebGLProgram
  private mismatchProgram: WebGLProgram
  private insertionProgram: WebGLProgram
  private softclipProgram: WebGLProgram
  private hardclipProgram: WebGLProgram

  private buffers: GPUBuffers | null = null
  private layoutMap: Map<string, number> = new Map()
  private lineVAO: WebGLVertexArrayObject | null = null
  private lineBuffer: WebGLBuffer | null = null

  private readUniforms: Record<string, WebGLUniformLocation | null> = {}
  private coverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private snpCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  private gapUniforms: Record<string, WebGLUniformLocation | null> = {}
  private mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}
  private insertionUniforms: Record<string, WebGLUniformLocation | null> = {}
  private softclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  private hardclipUniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.readProgram = this.createProgram(
      READ_VERTEX_SHADER,
      READ_FRAGMENT_SHADER,
    )

    this.coverageProgram = this.createProgram(
      COVERAGE_VERTEX_SHADER,
      COVERAGE_FRAGMENT_SHADER,
    )

    this.snpCoverageProgram = this.createProgram(
      SNP_COVERAGE_VERTEX_SHADER,
      SNP_COVERAGE_FRAGMENT_SHADER,
    )

    this.lineProgram = this.createProgram(LINE_VERTEX_SHADER, LINE_FRAGMENT_SHADER)
    this.gapProgram = this.createProgram(GAP_VERTEX_SHADER, GAP_FRAGMENT_SHADER)
    this.mismatchProgram = this.createProgram(MISMATCH_VERTEX_SHADER, MISMATCH_FRAGMENT_SHADER)
    this.insertionProgram = this.createProgram(INSERTION_VERTEX_SHADER, INSERTION_FRAGMENT_SHADER)
    this.softclipProgram = this.createProgram(SOFTCLIP_VERTEX_SHADER, SOFTCLIP_FRAGMENT_SHADER)
    this.hardclipProgram = this.createProgram(HARDCLIP_VERTEX_SHADER, HARDCLIP_FRAGMENT_SHADER)

    this.cacheUniforms(this.lineProgram, this.lineUniforms, ['u_color'])

    // Create line VAO and buffer for separator
    this.lineVAO = gl.createVertexArray()
    this.lineBuffer = gl.createBuffer()
    gl.bindVertexArray(this.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
    const linePosLoc = gl.getAttribLocation(this.lineProgram, 'a_position')
    gl.enableVertexAttribArray(linePosLoc)
    gl.vertexAttribPointer(linePosLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    this.cacheUniforms(this.readProgram, this.readUniforms, [
      'u_domainX',
      'u_rangeY',
      'u_colorScheme',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
    ])

    this.cacheUniforms(this.coverageProgram, this.coverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_binSize',
      'u_canvasHeight',
      'u_canvasWidth',
    ])

    this.cacheUniforms(this.snpCoverageProgram, this.snpCoverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_canvasHeight',
      'u_canvasWidth',
    ])

    const cigarUniforms = [
      'u_domainX',
      'u_rangeY',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
    ]
    const cigarUniformsWithWidth = [...cigarUniforms, 'u_canvasWidth']
    this.cacheUniforms(this.gapProgram, this.gapUniforms, cigarUniforms)
    this.cacheUniforms(this.mismatchProgram, this.mismatchUniforms, cigarUniformsWithWidth)
    this.cacheUniforms(this.insertionProgram, this.insertionUniforms, cigarUniformsWithWidth)
    this.cacheUniforms(this.softclipProgram, this.softclipUniforms, cigarUniformsWithWidth)
    this.cacheUniforms(this.hardclipProgram, this.hardclipUniforms, cigarUniformsWithWidth)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compile error: ${info}`)
    }
    return shader
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const gl = this.gl
    const program = gl.createProgram()!
    gl.attachShader(program, this.createShader(gl.VERTEX_SHADER, vsSource))
    gl.attachShader(program, this.createShader(gl.FRAGMENT_SHADER, fsSource))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`Program link error: ${info}`)
    }
    return program
  }

  private cacheUniforms(
    program: WebGLProgram,
    cache: Record<string, WebGLUniformLocation | null>,
    names: string[],
  ) {
    for (const name of names) {
      cache[name] = this.gl.getUniformLocation(program, name)
    }
  }

  private computeLayout(features: FeatureData[]): { maxY: number } {
    const sorted = [...features].sort((a, b) => a.start - b.start)
    const levels: number[] = []
    this.layoutMap.clear()

    for (const feature of sorted) {
      let y = 0
      for (let i = 0; i < levels.length; i++) {
        if (levels[i] <= feature.start) {
          y = i
          break
        }
        y = i + 1
      }
      this.layoutMap.set(feature.id, y)
      levels[y] = feature.end + 2
    }

    return { maxY: levels.length }
  }

  uploadFeatures(features: FeatureData[]): { maxY: number } {
    const gl = this.gl

    // Clean up old buffers
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.coverageVAO) {
        gl.deleteVertexArray(this.buffers.coverageVAO)
      }
      if (this.buffers.snpCoverageVAO) {
        gl.deleteVertexArray(this.buffers.snpCoverageVAO)
      }
      if (this.buffers.gapVAO) {
        gl.deleteVertexArray(this.buffers.gapVAO)
      }
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.insertionVAO) {
        gl.deleteVertexArray(this.buffers.insertionVAO)
      }
      if (this.buffers.softclipVAO) {
        gl.deleteVertexArray(this.buffers.softclipVAO)
      }
      if (this.buffers.hardclipVAO) {
        gl.deleteVertexArray(this.buffers.hardclipVAO)
      }
    }

    if (features.length === 0) {
      this.buffers = null
      return { maxY: 0 }
    }

    const { maxY } = this.computeLayout(features)

    // Prepare arrays
    const positions = new Float32Array(features.length * 2)
    const ys = new Float32Array(features.length)
    const flags = new Float32Array(features.length)
    const mapqs = new Float32Array(features.length)
    const insertSizes = new Float32Array(features.length)

    for (let i = 0; i < features.length; i++) {
      const f = features[i]
      const y = this.layoutMap.get(f.id) ?? 0

      positions[i * 2] = f.start
      positions[i * 2 + 1] = f.end
      ys[i] = y
      flags[i] = f.flags
      mapqs[i] = f.mapq
      insertSizes[i] = f.insertSize
    }

    // Read VAO
    const readVAO = gl.createVertexArray()!
    gl.bindVertexArray(readVAO)
    this.uploadBuffer(this.readProgram, 'a_position', positions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', ys, 1)
    this.uploadBuffer(this.readProgram, 'a_flags', flags, 1)
    this.uploadBuffer(this.readProgram, 'a_mapq', mapqs, 1)
    this.uploadBuffer(this.readProgram, 'a_insertSize', insertSizes, 1)
    gl.bindVertexArray(null)

    this.buffers = {
      readVAO,
      readCount: features.length,
      coverageVAO: null,
      coverageCount: 0,
      maxDepth: 0,
      binSize: 1,
      snpCoverageVAO: null,
      snpCoverageCount: 0,
      gapVAO: null,
      gapCount: 0,
      mismatchVAO: null,
      mismatchCount: 0,
      insertionVAO: null,
      insertionCount: 0,
      softclipVAO: null,
      softclipCount: 0,
      hardclipVAO: null,
      hardclipCount: 0,
    }

    return { maxY }
  }

  /**
   * Upload reads from pre-computed typed arrays (from RPC worker)
   * Zero-copy path - arrays come directly from worker via transferables
   */
  uploadFromTypedArrays(data: {
    readPositions: Float32Array
    readYs: Float32Array
    readFlags: Float32Array
    readMapqs: Float32Array
    readInsertSizes: Float32Array
    numReads: number
    maxY: number
  }) {
    const gl = this.gl

    // Clean up old buffers
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.coverageVAO) {
        gl.deleteVertexArray(this.buffers.coverageVAO)
      }
      if (this.buffers.snpCoverageVAO) {
        gl.deleteVertexArray(this.buffers.snpCoverageVAO)
      }
      if (this.buffers.gapVAO) {
        gl.deleteVertexArray(this.buffers.gapVAO)
      }
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.insertionVAO) {
        gl.deleteVertexArray(this.buffers.insertionVAO)
      }
      if (this.buffers.softclipVAO) {
        gl.deleteVertexArray(this.buffers.softclipVAO)
      }
      if (this.buffers.hardclipVAO) {
        gl.deleteVertexArray(this.buffers.hardclipVAO)
      }
    }

    if (data.numReads === 0) {
      this.buffers = null
      return
    }

    // Read VAO - upload pre-computed arrays directly
    const readVAO = gl.createVertexArray()!
    gl.bindVertexArray(readVAO)
    this.uploadBuffer(this.readProgram, 'a_position', data.readPositions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', data.readYs, 1)
    this.uploadBuffer(this.readProgram, 'a_flags', data.readFlags, 1)
    this.uploadBuffer(this.readProgram, 'a_mapq', data.readMapqs, 1)
    this.uploadBuffer(this.readProgram, 'a_insertSize', data.readInsertSizes, 1)
    gl.bindVertexArray(null)

    this.buffers = {
      readVAO,
      readCount: data.numReads,
      coverageVAO: null,
      coverageCount: 0,
      maxDepth: 0,
      binSize: 1,
      snpCoverageVAO: null,
      snpCoverageCount: 0,
      gapVAO: null,
      gapCount: 0,
      mismatchVAO: null,
      mismatchCount: 0,
      insertionVAO: null,
      insertionCount: 0,
      softclipVAO: null,
      softclipCount: 0,
      hardclipVAO: null,
      hardclipCount: 0,
    }
  }

  /**
   * Upload CIGAR data from pre-computed typed arrays (from RPC worker)
   */
  uploadCigarFromTypedArrays(data: {
    gapPositions: Float32Array
    gapYs: Float32Array
    numGaps: number
    mismatchPositions: Float32Array
    mismatchYs: Float32Array
    mismatchBases: Float32Array
    numMismatches: number
    insertionPositions: Float32Array
    insertionYs: Float32Array
    insertionLengths: Float32Array
    numInsertions: number
    softclipPositions: Float32Array
    softclipYs: Float32Array
    softclipLengths: Float32Array
    numSoftclips: number
    hardclipPositions: Float32Array
    hardclipYs: Float32Array
    hardclipLengths: Float32Array
    numHardclips: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old CIGAR VAOs
    if (this.buffers.gapVAO) {
      gl.deleteVertexArray(this.buffers.gapVAO)
      this.buffers.gapVAO = null
    }
    if (this.buffers.mismatchVAO) {
      gl.deleteVertexArray(this.buffers.mismatchVAO)
      this.buffers.mismatchVAO = null
    }
    if (this.buffers.insertionVAO) {
      gl.deleteVertexArray(this.buffers.insertionVAO)
      this.buffers.insertionVAO = null
    }
    if (this.buffers.softclipVAO) {
      gl.deleteVertexArray(this.buffers.softclipVAO)
      this.buffers.softclipVAO = null
    }
    if (this.buffers.hardclipVAO) {
      gl.deleteVertexArray(this.buffers.hardclipVAO)
      this.buffers.hardclipVAO = null
    }

    // Upload gaps
    if (data.numGaps > 0) {
      const gapVAO = gl.createVertexArray()!
      gl.bindVertexArray(gapVAO)
      this.uploadBuffer(this.gapProgram, 'a_position', data.gapPositions, 2)
      this.uploadBuffer(this.gapProgram, 'a_y', data.gapYs, 1)
      gl.bindVertexArray(null)

      this.buffers.gapVAO = gapVAO
      this.buffers.gapCount = data.numGaps
    } else {
      this.buffers.gapCount = 0
    }

    // Upload mismatches
    if (data.numMismatches > 0) {
      const mismatchVAO = gl.createVertexArray()!
      gl.bindVertexArray(mismatchVAO)
      this.uploadBuffer(this.mismatchProgram, 'a_position', data.mismatchPositions, 1)
      this.uploadBuffer(this.mismatchProgram, 'a_y', data.mismatchYs, 1)
      this.uploadBuffer(this.mismatchProgram, 'a_base', data.mismatchBases, 1)
      gl.bindVertexArray(null)

      this.buffers.mismatchVAO = mismatchVAO
      this.buffers.mismatchCount = data.numMismatches
    } else {
      this.buffers.mismatchCount = 0
    }

    // Upload insertions
    if (data.numInsertions > 0) {
      const insertionVAO = gl.createVertexArray()!
      gl.bindVertexArray(insertionVAO)
      this.uploadBuffer(this.insertionProgram, 'a_position', data.insertionPositions, 1)
      this.uploadBuffer(this.insertionProgram, 'a_y', data.insertionYs, 1)
      this.uploadBuffer(this.insertionProgram, 'a_length', data.insertionLengths, 1)
      gl.bindVertexArray(null)

      this.buffers.insertionVAO = insertionVAO
      this.buffers.insertionCount = data.numInsertions
    } else {
      this.buffers.insertionCount = 0
    }

    // Upload soft clips
    if (data.numSoftclips > 0) {
      const softclipVAO = gl.createVertexArray()!
      gl.bindVertexArray(softclipVAO)
      this.uploadBuffer(this.softclipProgram, 'a_position', data.softclipPositions, 1)
      this.uploadBuffer(this.softclipProgram, 'a_y', data.softclipYs, 1)
      this.uploadBuffer(this.softclipProgram, 'a_length', data.softclipLengths, 1)
      gl.bindVertexArray(null)

      this.buffers.softclipVAO = softclipVAO
      this.buffers.softclipCount = data.numSoftclips
    } else {
      this.buffers.softclipCount = 0
    }

    // Upload hard clips
    if (data.numHardclips > 0) {
      const hardclipVAO = gl.createVertexArray()!
      gl.bindVertexArray(hardclipVAO)
      this.uploadBuffer(this.hardclipProgram, 'a_position', data.hardclipPositions, 1)
      this.uploadBuffer(this.hardclipProgram, 'a_y', data.hardclipYs, 1)
      this.uploadBuffer(this.hardclipProgram, 'a_length', data.hardclipLengths, 1)
      gl.bindVertexArray(null)

      this.buffers.hardclipVAO = hardclipVAO
      this.buffers.hardclipCount = data.numHardclips
    } else {
      this.buffers.hardclipCount = 0
    }
  }

  /**
   * Upload coverage data from pre-computed typed arrays (from RPC worker)
   */
  uploadCoverageFromTypedArrays(data: {
    coveragePositions: Float32Array
    coverageDepths: Float32Array
    coverageMaxDepth: number
    coverageBinSize: number
    numCoverageBins: number
    snpPositions: Float32Array
    snpYOffsets: Float32Array
    snpHeights: Float32Array
    snpColorTypes: Float32Array
    numSnpSegments: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old coverage VAOs
    if (this.buffers.coverageVAO) {
      gl.deleteVertexArray(this.buffers.coverageVAO)
    }
    if (this.buffers.snpCoverageVAO) {
      gl.deleteVertexArray(this.buffers.snpCoverageVAO)
    }

    // Upload grey coverage bars
    if (data.numCoverageBins > 0) {
      // Normalize depths
      const normalizedDepths = new Float32Array(data.coverageDepths.length)
      for (let i = 0; i < data.coverageDepths.length; i++) {
        normalizedDepths[i] = data.coverageDepths[i] / data.coverageMaxDepth
      }

      const coverageVAO = gl.createVertexArray()!
      gl.bindVertexArray(coverageVAO)
      this.uploadBuffer(this.coverageProgram, 'a_position', data.coveragePositions, 1)
      this.uploadBuffer(this.coverageProgram, 'a_depth', normalizedDepths, 1)
      gl.bindVertexArray(null)

      this.buffers.coverageVAO = coverageVAO
      this.buffers.coverageCount = data.numCoverageBins
      this.buffers.maxDepth = data.coverageMaxDepth
      this.buffers.binSize = data.coverageBinSize
    } else {
      this.buffers.coverageVAO = null
      this.buffers.coverageCount = 0
    }

    // Upload SNP coverage
    if (data.numSnpSegments > 0) {
      const snpCoverageVAO = gl.createVertexArray()!
      gl.bindVertexArray(snpCoverageVAO)
      this.uploadBuffer(this.snpCoverageProgram, 'a_position', data.snpPositions, 1)
      this.uploadBuffer(this.snpCoverageProgram, 'a_yOffset', data.snpYOffsets, 1)
      this.uploadBuffer(this.snpCoverageProgram, 'a_segmentHeight', data.snpHeights, 1)
      this.uploadBuffer(this.snpCoverageProgram, 'a_colorType', data.snpColorTypes, 1)
      gl.bindVertexArray(null)

      this.buffers.snpCoverageVAO = snpCoverageVAO
      this.buffers.snpCoverageCount = data.numSnpSegments
    } else {
      this.buffers.snpCoverageVAO = null
      this.buffers.snpCoverageCount = 0
    }
  }

  uploadCigarData(
    gaps: GapData[],
    mismatches: MismatchData[],
    insertions: InsertionData[],
  ) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old CIGAR VAOs
    if (this.buffers.gapVAO) {
      gl.deleteVertexArray(this.buffers.gapVAO)
      this.buffers.gapVAO = null
    }
    if (this.buffers.mismatchVAO) {
      gl.deleteVertexArray(this.buffers.mismatchVAO)
      this.buffers.mismatchVAO = null
    }
    if (this.buffers.insertionVAO) {
      gl.deleteVertexArray(this.buffers.insertionVAO)
      this.buffers.insertionVAO = null
    }

    // Upload gaps
    if (gaps.length > 0) {
      const gapPositions = new Float32Array(gaps.length * 2)
      const gapYs = new Float32Array(gaps.length)

      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i]
        const y = this.layoutMap.get(g.featureId) ?? 0
        gapPositions[i * 2] = g.start
        gapPositions[i * 2 + 1] = g.end
        gapYs[i] = y
      }

      const gapVAO = gl.createVertexArray()!
      gl.bindVertexArray(gapVAO)
      this.uploadBuffer(this.gapProgram, 'a_position', gapPositions, 2)
      this.uploadBuffer(this.gapProgram, 'a_y', gapYs, 1)
      gl.bindVertexArray(null)

      this.buffers.gapVAO = gapVAO
      this.buffers.gapCount = gaps.length
    } else {
      this.buffers.gapCount = 0
    }

    // Upload mismatches
    if (mismatches.length > 0) {
      const mmPositions = new Float32Array(mismatches.length)
      const mmYs = new Float32Array(mismatches.length)
      const mmBases = new Float32Array(mismatches.length)

      for (let i = 0; i < mismatches.length; i++) {
        const mm = mismatches[i]
        const y = this.layoutMap.get(mm.featureId) ?? 0
        mmPositions[i] = mm.position
        mmYs[i] = y
        mmBases[i] = mm.base
      }

      const mismatchVAO = gl.createVertexArray()!
      gl.bindVertexArray(mismatchVAO)
      this.uploadBuffer(this.mismatchProgram, 'a_position', mmPositions, 1)
      this.uploadBuffer(this.mismatchProgram, 'a_y', mmYs, 1)
      this.uploadBuffer(this.mismatchProgram, 'a_base', mmBases, 1)
      gl.bindVertexArray(null)

      this.buffers.mismatchVAO = mismatchVAO
      this.buffers.mismatchCount = mismatches.length
    } else {
      this.buffers.mismatchCount = 0
    }

    // Upload insertions
    if (insertions.length > 0) {
      const insPositions = new Float32Array(insertions.length)
      const insYs = new Float32Array(insertions.length)

      for (let i = 0; i < insertions.length; i++) {
        const ins = insertions[i]
        const y = this.layoutMap.get(ins.featureId) ?? 0
        insPositions[i] = ins.position
        insYs[i] = y
      }

      const insertionVAO = gl.createVertexArray()!
      gl.bindVertexArray(insertionVAO)
      this.uploadBuffer(this.insertionProgram, 'a_position', insPositions, 1)
      this.uploadBuffer(this.insertionProgram, 'a_y', insYs, 1)
      gl.bindVertexArray(null)

      this.buffers.insertionVAO = insertionVAO
      this.buffers.insertionCount = insertions.length
    } else {
      this.buffers.insertionCount = 0
    }
  }

  uploadCoverage(
    coverageData: CoverageData[],
    maxDepth: number,
    binSize: number,
  ) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old coverage VAO
    if (this.buffers.coverageVAO) {
      gl.deleteVertexArray(this.buffers.coverageVAO)
    }

    if (coverageData.length === 0) {
      this.buffers.coverageVAO = null
      this.buffers.coverageCount = 0
      return
    }

    // Prepare arrays for grey coverage bars
    const positions = new Float32Array(coverageData.length)
    const depths = new Float32Array(coverageData.length)

    for (let i = 0; i < coverageData.length; i++) {
      const bin = coverageData[i]!
      positions[i] = bin.position
      depths[i] = bin.depth / maxDepth  // normalized
    }

    // Coverage VAO
    const coverageVAO = gl.createVertexArray()!
    gl.bindVertexArray(coverageVAO)
    this.uploadBuffer(this.coverageProgram, 'a_position', positions, 1)
    this.uploadBuffer(this.coverageProgram, 'a_depth', depths, 1)
    gl.bindVertexArray(null)

    this.buffers.coverageVAO = coverageVAO
    this.buffers.coverageCount = coverageData.length
    this.buffers.maxDepth = maxDepth
    this.buffers.binSize = binSize
  }

  uploadSNPCoverage(
    snpData: SNPCoverageData[],
    maxDepth: number,
  ) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    // Clean up old SNP coverage VAO
    if (this.buffers.snpCoverageVAO) {
      gl.deleteVertexArray(this.buffers.snpCoverageVAO)
    }

    if (snpData.length === 0 || maxDepth === 0) {
      this.buffers.snpCoverageVAO = null
      this.buffers.snpCoverageCount = 0
      return
    }

    // Build stacked segments for SNPs at exact positions
    const segments: { position: number; yOffset: number; height: number; colorType: number }[] = []

    for (const bin of snpData) {
      const total = bin.snpA + bin.snpC + bin.snpG + bin.snpT
      if (total === 0) {
        continue
      }

      let yOffset = 0

      // A segment (green)
      if (bin.snpA > 0) {
        const height = bin.snpA / maxDepth
        segments.push({ position: bin.position, yOffset, height, colorType: 1 })
        yOffset += height
      }

      // C segment (blue)
      if (bin.snpC > 0) {
        const height = bin.snpC / maxDepth
        segments.push({ position: bin.position, yOffset, height, colorType: 2 })
        yOffset += height
      }

      // G segment (orange)
      if (bin.snpG > 0) {
        const height = bin.snpG / maxDepth
        segments.push({ position: bin.position, yOffset, height, colorType: 3 })
        yOffset += height
      }

      // T segment (red)
      if (bin.snpT > 0) {
        const height = bin.snpT / maxDepth
        segments.push({ position: bin.position, yOffset, height, colorType: 4 })
      }
    }

    if (segments.length === 0) {
      this.buffers.snpCoverageVAO = null
      this.buffers.snpCoverageCount = 0
      return
    }

    // Prepare arrays
    const positions = new Float32Array(segments.length)
    const yOffsets = new Float32Array(segments.length)
    const heights = new Float32Array(segments.length)
    const colorTypes = new Float32Array(segments.length)

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!
      positions[i] = seg.position
      yOffsets[i] = seg.yOffset
      heights[i] = seg.height
      colorTypes[i] = seg.colorType
    }

    // SNP Coverage VAO
    const snpCoverageVAO = gl.createVertexArray()!
    gl.bindVertexArray(snpCoverageVAO)
    this.uploadBuffer(this.snpCoverageProgram, 'a_position', positions, 1)
    this.uploadBuffer(this.snpCoverageProgram, 'a_yOffset', yOffsets, 1)
    this.uploadBuffer(this.snpCoverageProgram, 'a_segmentHeight', heights, 1)
    this.uploadBuffer(this.snpCoverageProgram, 'a_colorType', colorTypes, 1)
    gl.bindVertexArray(null)

    this.buffers.snpCoverageVAO = snpCoverageVAO
    this.buffers.snpCoverageCount = segments.length
  }

  private uploadBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Float32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: RenderState) {
    const gl = this.gl
    const canvas = this.canvas

    // Handle resize
    if (
      canvas.width !== canvas.clientWidth ||
      canvas.height !== canvas.clientHeight
    ) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0.0, 0.0, 0.0, 0.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    // Draw coverage first (at top)
    const willDrawCoverage = state.showCoverage && this.buffers.coverageVAO && this.buffers.coverageCount > 0
    if (willDrawCoverage) {
      // Draw grey coverage bars
      gl.useProgram(this.coverageProgram)
      gl.uniform2f(
        this.coverageUniforms.u_visibleRange!,
        state.domainX[0],
        state.domainX[1],
      )
      gl.uniform1f(
        this.coverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(this.coverageUniforms.u_binSize!, this.buffers.binSize)
      gl.uniform1f(this.coverageUniforms.u_canvasHeight!, canvas.height)
      gl.uniform1f(this.coverageUniforms.u_canvasWidth!, canvas.width)

      gl.bindVertexArray(this.buffers.coverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.coverageCount)

      // Draw SNP coverage on top (at exact 1bp positions)
      if (this.buffers.snpCoverageVAO && this.buffers.snpCoverageCount > 0) {
        gl.useProgram(this.snpCoverageProgram)
        gl.uniform2f(
          this.snpCoverageUniforms.u_visibleRange!,
          state.domainX[0],
          state.domainX[1],
        )
        gl.uniform1f(
          this.snpCoverageUniforms.u_coverageHeight!,
          state.coverageHeight,
        )
        gl.uniform1f(this.snpCoverageUniforms.u_canvasHeight!, canvas.height)
        gl.uniform1f(this.snpCoverageUniforms.u_canvasWidth!, canvas.width)

        gl.bindVertexArray(this.buffers.snpCoverageVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.snpCoverageCount)
      }

      // Draw separator line at bottom of coverage area
      const lineY = 1.0 - (state.coverageHeight / canvas.height) * 2.0
      gl.useProgram(this.lineProgram)
      gl.uniform4f(this.lineUniforms.u_color!, 0.7, 0.7, 0.7, 1.0)

      const lineData = new Float32Array([-1, lineY, 1, lineY])
      gl.bindVertexArray(this.lineVAO)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
      gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.DYNAMIC_DRAW)
      gl.drawArrays(gl.LINES, 0, 2)
    }

    // Draw reads
    const coverageOffset = state.showCoverage ? state.coverageHeight : 0

    // Enable scissor test to clip pileup to area below coverage
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(
      0,
      0,
      canvas.width,
      canvas.height - coverageOffset,
    )

    gl.useProgram(this.readProgram)
    gl.uniform2f(
      this.readUniforms.u_domainX!,
      state.domainX[0],
      state.domainX[1],
    )
    gl.uniform2f(
      this.readUniforms.u_rangeY!,
      state.rangeY[0],
      state.rangeY[1],
    )
    gl.uniform1i(this.readUniforms.u_colorScheme!, state.colorScheme)
    gl.uniform1f(this.readUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.readUniforms.u_featureSpacing!, state.featureSpacing)
    gl.uniform1f(this.readUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.readUniforms.u_canvasHeight!, canvas.height)

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.readCount)

    // Draw CIGAR features if enabled
    if (state.showMismatches) {
      const bpPerPx = (state.domainX[1] - state.domainX[0]) / canvas.width

      // Draw gaps (deletions) - always visible
      if (this.buffers.gapVAO && this.buffers.gapCount > 0) {
        gl.useProgram(this.gapProgram)
        gl.uniform2f(this.gapUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.gapUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.gapUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.gapUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.gapUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.gapUniforms.u_canvasHeight!, canvas.height)

        gl.bindVertexArray(this.buffers.gapVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.gapCount)
      }

      // Draw mismatches - only when zoomed in enough (< 50 bp/px)
      if (this.buffers.mismatchVAO && this.buffers.mismatchCount > 0 && bpPerPx < 50) {
        gl.useProgram(this.mismatchProgram)
        gl.uniform2f(this.mismatchUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.mismatchUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.mismatchUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.mismatchUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.mismatchUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.mismatchUniforms.u_canvasHeight!, canvas.height)
        gl.uniform1f(this.mismatchUniforms.u_canvasWidth!, canvas.width)

        gl.bindVertexArray(this.buffers.mismatchVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.mismatchCount)
      }

      // Draw insertions - only when zoomed in enough (< 100 bp/px)
      // Each insertion is 3 rectangles (bar + 2 ticks) = 18 vertices
      if (this.buffers.insertionVAO && this.buffers.insertionCount > 0 && bpPerPx < 100) {
        gl.useProgram(this.insertionProgram)
        gl.uniform2f(this.insertionUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.insertionUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.insertionUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.insertionUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.insertionUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.insertionUniforms.u_canvasHeight!, canvas.height)
        gl.uniform1f(this.insertionUniforms.u_canvasWidth!, canvas.width)

        gl.bindVertexArray(this.buffers.insertionVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, this.buffers.insertionCount)
      }

      // Draw soft clips - only when zoomed in enough (< 100 bp/px)
      if (this.buffers.softclipVAO && this.buffers.softclipCount > 0 && bpPerPx < 100) {
        gl.useProgram(this.softclipProgram)
        gl.uniform2f(this.softclipUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.softclipUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.softclipUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.softclipUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.softclipUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.softclipUniforms.u_canvasHeight!, canvas.height)
        gl.uniform1f(this.softclipUniforms.u_canvasWidth!, canvas.width)

        gl.bindVertexArray(this.buffers.softclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.softclipCount)
      }

      // Draw hard clips - only when zoomed in enough (< 100 bp/px)
      if (this.buffers.hardclipVAO && this.buffers.hardclipCount > 0 && bpPerPx < 100) {
        gl.useProgram(this.hardclipProgram)
        gl.uniform2f(this.hardclipUniforms.u_domainX!, state.domainX[0], state.domainX[1])
        gl.uniform2f(this.hardclipUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
        gl.uniform1f(this.hardclipUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.hardclipUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.hardclipUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.hardclipUniforms.u_canvasHeight!, canvas.height)
        gl.uniform1f(this.hardclipUniforms.u_canvasWidth!, canvas.width)

        gl.bindVertexArray(this.buffers.hardclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.hardclipCount)
      }
    }

    gl.disable(gl.SCISSOR_TEST)
    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.coverageVAO) {
        gl.deleteVertexArray(this.buffers.coverageVAO)
      }
      if (this.buffers.snpCoverageVAO) {
        gl.deleteVertexArray(this.buffers.snpCoverageVAO)
      }
      if (this.buffers.gapVAO) {
        gl.deleteVertexArray(this.buffers.gapVAO)
      }
      if (this.buffers.mismatchVAO) {
        gl.deleteVertexArray(this.buffers.mismatchVAO)
      }
      if (this.buffers.insertionVAO) {
        gl.deleteVertexArray(this.buffers.insertionVAO)
      }
      if (this.buffers.softclipVAO) {
        gl.deleteVertexArray(this.buffers.softclipVAO)
      }
      if (this.buffers.hardclipVAO) {
        gl.deleteVertexArray(this.buffers.hardclipVAO)
      }
    }
    if (this.lineVAO) {
      gl.deleteVertexArray(this.lineVAO)
    }
    if (this.lineBuffer) {
      gl.deleteBuffer(this.lineBuffer)
    }
    gl.deleteProgram(this.readProgram)
    gl.deleteProgram(this.coverageProgram)
    gl.deleteProgram(this.snpCoverageProgram)
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.gapProgram)
    gl.deleteProgram(this.mismatchProgram)
    gl.deleteProgram(this.insertionProgram)
    gl.deleteProgram(this.softclipProgram)
    gl.deleteProgram(this.hardclipProgram)
  }
}
