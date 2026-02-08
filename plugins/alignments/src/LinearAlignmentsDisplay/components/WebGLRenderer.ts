/**
 * WebGL Renderer for alignments display
 *
 * Handles pileup, arcs, and cloud rendering modes with shared coverage.
 * Manages shader compilation, buffer management, and rendering.
 * Data is uploaded once, then rendering only updates uniforms.
 *
 * High-precision position handling inspired by genome-spy
 * (https://github.com/genome-spy/genome-spy)
 *
 * The challenge: Float32 loses precision for large genomic positions (e.g., 200,000,000 bp).
 * The solution: 12-bit split approach where positions are split into:
 *   - High part: multiples of 4096 (captures large magnitude)
 *   - Low part: 0-4095 + fractional (captures fine detail)
 *
 * In the shader, high parts are subtracted separately from low parts, then combined.
 * This preserves precision because each subtraction involves similar-magnitude values.
 *
 * For smooth scrolling, the domain start must preserve fractional precision - otherwise
 * reads appear to "stick" at integer positions and snap when crossing boundaries.
 */

import { colord } from '@jbrowse/core/util/colord'

import { fillColor } from '../../shared/color.ts'
import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from '../model.ts'

/**
 * Split a position including its fractional part for smooth scrolling.
 *
 * Same as splitPosition but preserves the fractional component in the low part.
 * This is critical for the domain start position - without preserving fractional
 * precision, scrolling appears jerky as reads "stick" at integer bp boundaries
 * and then snap to new positions.
 *
 * Used for domain start which can have sub-bp scroll offsets.
 */
function splitPositionWithFrac(value: number): [number, number] {
  const intValue = Math.floor(value)
  const frac = value - intValue
  const loInt = intValue & 0xfff
  const hi = intValue - loInt
  const lo = loInt + frac
  return [hi, lo]
}

/**
 * High-precision GLSL functions for genomic coordinates.
 * Inspired by genome-spy (https://github.com/genome-spy/genome-spy)
 *
 * The 12-bit split approach:
 * - Split 32-bit position into high bits (multiples of 4096) and low bits (0-4095)
 * - Each part has fewer significant digits, reducing Float32 rounding errors
 * - Subtract domain high/low parts separately, then combine
 * - This preserves precision even for positions like 200,000,000 bp
 *
 * Note: domain.y (low part) may include a fractional component for smooth scrolling.
 * Read positions are integers, but the domain start can have sub-bp precision.
 */
const HP_GLSL_FUNCTIONS = `
// High-precision constants (12-bit split)
const uint HP_LOW_MASK = 0xFFFu;  // 4095 - mask for low 12 bits
const float HP_LOW_DIVISOR = 4096.0;

// Split a uint into high and low parts for precision
// High part is multiple of 4096, low part is 0-4095
vec2 hpSplitUint(uint value) {
  uint lo = value & HP_LOW_MASK;
  uint hi = value - lo;
  return vec2(float(hi), float(lo));
}

// Calculate normalized position (0-1) from split position and domain
// domain.xy = [domainStartHi, domainStartLo], domain.z = domainExtent
float hpScaleLinear(vec2 splitPos, vec3 domain) {
  float hi = splitPos.x - domain.x;  // High parts subtracted (similar magnitude)
  float lo = splitPos.y - domain.y;  // Low parts subtracted (both 0-4095)
  return (hi + lo) / domain.z;       // Combine and normalize
}

// Calculate clip-space X from split position and domain
float hpToClipX(vec2 splitPos, vec3 domain) {
  return hpScaleLinear(splitPos, domain) * 2.0 - 1.0;
}
`

// Vertex shader for reads
const READ_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in float a_y;
in float a_flags;
in float a_mapq;
in float a_insertSize;
in float a_pairOrientation;  // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
in float a_strand;           // -1=reverse, 0=unknown, 1=forward
in vec3 a_tagColor;          // per-read tag color (normalized 0-1 from Uint8)

uniform vec3 u_domainX;  // [domainStartHi, domainStartLo, domainExtent]
uniform uint u_regionStart;  // Base position for converting offsets to absolute
uniform vec2 u_rangeY;
uniform int u_colorScheme;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform int u_highlightedIndex;  // Feature index to highlight (-1 = none)
uniform float u_canvasWidth;

// Color uniforms - these match shared/color.ts and theme colors
uniform vec3 u_colorFwdStrand;    // #EC8B8B
uniform vec3 u_colorRevStrand;    // #8F8FD8
uniform vec3 u_colorNostrand;     // #c8c8c8 (lightgrey)
uniform vec3 u_colorPairLR;       // lightgrey
uniform vec3 u_colorPairRL;       // teal
uniform vec3 u_colorPairRR;       // #3a3a9d (dark blue)
uniform vec3 u_colorPairLL;       // green
uniform vec3 u_colorModificationFwd;  // #c8c8c8
uniform vec3 u_colorModificationRev;  // #c8dcc8

out vec4 v_color;

${HP_GLSL_FUNCTIONS}

// Color scheme 0: normal - grey base color (matches PileupRenderer default)
vec3 normalColor() {
  return u_colorNostrand;
}

// Color scheme 1: strand - red for forward, blue for reverse
// Matches colorByStrand in colorBy.ts
vec3 strandColor(float strand) {
  if (strand > 0.5) {
    return u_colorFwdStrand;  // forward
  } else if (strand < -0.5) {
    return u_colorRevStrand;  // reverse
  }
  return u_colorNostrand;  // unknown
}

// Color scheme 2: mapping quality - HSL based on MAPQ score
// Matches colorByMappingQuality: hsl(score, 50%, 50%)
vec3 mapqColor(float mapq) {
  // Convert HSL to RGB where H = mapq (0-255 mapped to 0-360), S=0.5, L=0.5
  float h = mapq / 360.0;  // MAPQ typically 0-60, but can be higher
  float s = 0.5;
  float l = 0.5;

  // HSL to RGB conversion
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  float m = l - c / 2.0;

  vec3 rgb;
  if (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);

  return rgb + m;
}

// Color scheme 3: insert size - HSL based on template_length/10
// Matches colorByInsertSize: hsl(abs(template_length)/10, 50%, 50%)
vec3 insertSizeColor(float insertSize) {
  float h = insertSize / 10.0 / 360.0;  // template_length/10 as hue
  float s = 0.5;
  float l = 0.5;

  // HSL to RGB conversion
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h * 6.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  float m = l - c / 2.0;

  vec3 rgb;
  if (hp < 1.0) rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);

  return rgb + m;
}

// Color scheme 4: first-of-pair strand (stranded RNA-seq simplified)
// Uses strand colors based on first-of-pair flag
vec3 firstOfPairColor(float flags, float strand) {
  bool isFirst = mod(floor(flags / 64.0), 2.0) > 0.5;  // flag 64 = first of pair
  float effectiveStrand = isFirst ? strand : -strand;
  if (effectiveStrand > 0.5) {
    return u_colorFwdStrand;
  } else if (effectiveStrand < -0.5) {
    return u_colorRevStrand;
  }
  return u_colorNostrand;
}

// Color scheme 5: pair orientation - LR/RL/RR/LL
// Matches colorByOrientation using fillColor values
vec3 pairOrientationColor(float pairOrientation) {
  int po = int(pairOrientation);
  if (po == 1) {
    return u_colorPairLR;   // LR - normal (lightgrey)
  } else if (po == 2) {
    return u_colorPairRL;   // RL - teal
  } else if (po == 3) {
    return u_colorPairRR;   // RR (FF) - #3a3a9d (dark blue)
  } else if (po == 4) {
    return u_colorPairLL;   // LL (RR) - green
  }
  return u_colorNostrand;   // unknown - grey
}

// Color scheme 6: insert size AND orientation combined
// Priority: abnormal orientation first, then insert size coloring
vec3 insertSizeAndOrientationColor(float insertSize, float pairOrientation) {
  int po = int(pairOrientation);
  // First check orientation - if not LR (normal), use orientation color
  if (po == 2) return u_colorPairRL;   // RL - teal
  if (po == 3) return u_colorPairRR;   // RR - dark blue
  if (po == 4) return u_colorPairLL;   // LL - green
  // For LR orientation or unknown, fall back to insert size coloring
  return insertSizeColor(insertSize);
}

// Color scheme 7: modifications/methylation mode
// Reverse strand reads get slightly green tint to distinguish from forward
// (helpful because C-G is flipped on reverse strand reads)
vec3 modificationsColor(float flags) {
  // Check flag 16 (0x10) for reverse strand
  bool isReverse = mod(floor(flags / 16.0), 2.0) > 0.5;
  if (isReverse) {
    return u_colorModificationRev;
  }
  return u_colorModificationFwd;
}

void main() {
  int vid = gl_VertexID % 9;

  // Convert offsets to absolute positions, then apply high-precision 12-bit split
  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);

  // Calculate Y position in pixels (constant height per row)
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = a_y * rowHeight - u_rangeY.x;  // subtract scroll offset
  float yBotPx = yTopPx + u_featureHeight;

  // Convert to clip space: top of pileup area is at y = pileupTop
  // Each pixel moves down by 2.0/canvasHeight in clip space
  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float syMid = (syTop + syBot) * 0.5;

  // Chevron width: 5px in clip space, only when zoomed in and feature tall enough
  float chevronClip = 5.0 / u_canvasWidth * 2.0;
  float domainExtent = u_domainX.z;
  float bpPerPx = domainExtent / u_canvasWidth;
  bool showChevron = bpPerPx < 10.0 && u_featureHeight > 5.0;

  float sx;
  float sy;
  if (vid < 6) {
    // Vertices 0-5: rectangle body (same as before)
    float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
    sx = mix(sx1, sx2, localX);
    sy = mix(syBot, syTop, localY);
  } else if (showChevron) {
    // Vertices 6-8: chevron triangle tip
    if (a_strand > 0.5) {
      // Forward strand: triangle on right
      if (vid == 6) { sx = sx2; sy = syTop; }
      else if (vid == 7) { sx = sx2; sy = syBot; }
      else { sx = sx2 + chevronClip; sy = syMid; }
    } else if (a_strand < -0.5) {
      // Reverse strand: triangle on left
      if (vid == 6) { sx = sx1; sy = syTop; }
      else if (vid == 7) { sx = sx1 - chevronClip; sy = syMid; }
      else { sx = sx1; sy = syBot; }
    } else {
      // No strand: degenerate triangle (invisible)
      sx = sx1; sy = syTop;
    }
  } else {
    // Chevrons disabled: degenerate triangle
    sx = sx1; sy = syTop;
  }

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  vec3 color;
  if (u_colorScheme == 0) color = normalColor();
  else if (u_colorScheme == 1) color = strandColor(a_strand);
  else if (u_colorScheme == 2) color = mapqColor(a_mapq);
  else if (u_colorScheme == 3) color = insertSizeColor(a_insertSize);
  else if (u_colorScheme == 4) color = firstOfPairColor(a_flags, a_strand);
  else if (u_colorScheme == 5) color = pairOrientationColor(a_pairOrientation);
  else if (u_colorScheme == 6) color = insertSizeAndOrientationColor(a_insertSize, a_pairOrientation);
  else if (u_colorScheme == 7) color = modificationsColor(a_flags);
  else if (u_colorScheme == 8) color = a_tagColor;
  else color = vec3(0.6);

  // Darken highlighted feature
  if (u_highlightedIndex >= 0 && gl_InstanceID == u_highlightedIndex) {
    color = color * 0.7;
  }

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
// Uses explicit position attribute for consistent positioning with other coverage elements
const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;    // position offset from regionStart
in float a_depth;       // normalized depth (0-1)

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_coverageHeight;  // height in pixels
uniform float u_coverageYOffset; // padding at top/bottom for scalebar labels
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
  float effectiveHeight = u_coverageHeight - 2.0 * u_coverageYOffset;
  float coverageBottom = 1.0 - ((u_coverageHeight - u_coverageYOffset) / u_canvasHeight) * 2.0;
  float barTop = coverageBottom + (a_depth * effectiveHeight / u_canvasHeight) * 2.0;
  float sy = mix(coverageBottom, barTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(u_colorCoverage, 1.0);
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
// Uses simple float offsets (relative to regionStart) - sufficient for coverage features
const SNP_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;       // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in float a_colorType;     // 1=A(green), 2=C(blue), 3=G(orange), 4=T(red)

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_coverageHeight;
uniform float u_coverageYOffset; // padding at top/bottom for scalebar labels
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
  float segmentBot = coverageBottom + (a_yOffset * effectiveHeight / u_canvasHeight) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * effectiveHeight / u_canvasHeight) * 2.0;
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

const SNP_COVERAGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Modification coverage vertex shader - renders colored stacked bars at exact positions
// Like SNP coverage but uses per-instance RGBA color instead of color type lookup
const MOD_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;       // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in vec4 a_color;          // RGBA color (normalized from Uint8)

uniform vec2 u_visibleRange;  // [domainStart, domainEnd] as offsets
uniform float u_coverageHeight;
uniform float u_coverageYOffset; // padding at top/bottom for scalebar labels
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
  float segmentBot = coverageBottom + (a_yOffset * effectiveHeight / u_canvasHeight) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * effectiveHeight / u_canvasHeight) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

const MOD_COVERAGE_FRAGMENT_SHADER = `#version 300 es
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
const NONCOV_HISTOGRAM_VERTEX_SHADER = `#version 300 es
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

const NONCOV_HISTOGRAM_FRAGMENT_SHADER = `#version 300 es
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
const INDICATOR_VERTEX_SHADER = `#version 300 es
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

const INDICATOR_FRAGMENT_SHADER = `#version 300 es
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

// Gap (deletion/skip) vertex shader - colored rectangles over reads
// Deletions are grey (#808080), skips are teal/blue (#97b8c9)
// Uses integer attributes for compact representation
const GAP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in uint a_y;          // pileup row
in uint a_type;       // 0=deletion, 1=skip

uniform vec2 u_domainX;  // [domainStart, domainEnd] as offsets
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform vec3 u_colorDeletion;
uniform vec3 u_colorSkip;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (float(a_position.x) - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (float(a_position.y) - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  // Gap fills the full feature height (like normal renderer)
  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Select color based on gap type
  v_color = a_type == 0u ? vec4(u_colorDeletion, 1.0) : vec4(u_colorSkip, 1.0);
}
`

const GAP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Mismatch vertex shader - colored rectangles for SNPs
// Uses integer attributes for compact representation
const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_base;       // ASCII character code (65='A', 67='C', 71='G', 84='T', etc.)

uniform vec2 u_domainX;  // [domainStart, domainEnd] as offsets
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
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

  float pos = float(a_position);
  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (pos - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (pos + 1.0 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  // Calculate Y position in pixels (constant height per row)
  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // Map ASCII code to base color
  vec3 color;
  if (a_base == 65u || a_base == 97u) { // 'A' or 'a'
    color = u_colorBaseA;
  } else if (a_base == 67u || a_base == 99u) { // 'C' or 'c'
    color = u_colorBaseC;
  } else if (a_base == 71u || a_base == 103u) { // 'G' or 'g'
    color = u_colorBaseG;
  } else if (a_base == 84u || a_base == 116u) { // 'T' or 't'
    color = u_colorBaseT;
  } else {
    color = vec3(0.5, 0.5, 0.5); // grey for unknown bases (N, etc.)
  }
  v_color = vec4(color, 1.0);
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
// For small insertions: renders I-shape (main bar + top tick + bottom tick)
// For large insertions (>=LONG_INSERTION_MIN_LENGTH bp): renders wider rectangle to contain text label
// Thresholds imported from model.ts for consistency with component
// Uses integer attributes for compact representation
const INSERTION_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_length;     // insertion length

uniform vec2 u_domainX;  // [domainStart, domainEnd] as offsets
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Insertion color uniform from theme
uniform vec3 u_colorInsertion;

out vec4 v_color;

// Approximate text width in pixels for a number
// Returns width needed to display the number as text
float textWidthForNumber(uint num) {
  // Approximate character widths: ~6px per digit
  // Plus padding of 5px on each side = 10px total
  float charWidth = 6.0;
  float padding = 10.0;

  if (num < 10u) return charWidth + padding;        // 1 digit
  if (num < 100u) return charWidth * 2.0 + padding; // 2 digits
  if (num < 1000u) return charWidth * 3.0 + padding; // 3 digits
  if (num < 10000u) return charWidth * 4.0 + padding; // 4 digits
  return charWidth * 5.0 + padding; // 5+ digits
}

void main() {
  // Each insertion uses 18 vertices (3 rectangles x 6 vertices each)
  // Rectangle 0: main vertical bar (or wide box for large insertions)
  // Rectangle 1: top horizontal tick (hidden for large insertions)
  // Rectangle 2: bottom horizontal tick (hidden for large insertions)
  int rectIdx = gl_VertexID / 6;
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float len = float(a_length);
  float domainWidth = u_domainX.y - u_domainX.x;
  float bpPerPx = domainWidth / u_canvasWidth;
  float pxPerBp = 1.0 / bpPerPx;

  // Center position in clip space
  float cxClip = (pos - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Adaptive large insertion rendering:
  // - When zoomed in enough to read text: show wide box for text label
  // - When zoomed out: show small solid rectangle
  // Threshold based on insertion width in pixels (length * pxPerBp)
  // Uses constants from model.ts: LONG_INSERTION_MIN_LENGTH, LONG_INSERTION_TEXT_THRESHOLD_PX
  bool isLongInsertion = a_length >= ${LONG_INSERTION_MIN_LENGTH}u;
  float insertionWidthPx = len * pxPerBp;
  bool canShowText = insertionWidthPx >= ${LONG_INSERTION_TEXT_THRESHOLD_PX}.0;
  bool isLargeInsertion = isLongInsertion && canShowText;

  // Calculate rectangle width in pixels
  float rectWidthPx;
  if (isLargeInsertion) {
    // Wide rectangle to contain text label
    rectWidthPx = textWidthForNumber(a_length);
  } else if (isLongInsertion) {
    // Long insertion but zoomed out - show small solid rectangle (2px)
    rectWidthPx = 2.0;
  } else {
    // Small insertion - thin bar, subpixel when zoomed out
    // Clamp to max 1px so it doesn't become wide when zoomed in
    rectWidthPx = min(pxPerBp, 1.0);
  }

  // Convert pixel width to clip space
  float onePixelClip = 2.0 / u_canvasWidth;
  float rectWidthClip = rectWidthPx * 2.0 / u_canvasWidth;
  // Serifs: 3px wide, 1px tall lines
  float tickWidthClip = onePixelClip * 3.0;

  // Calculate Y position in pixels (constant height per row)
  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;

  float sx1, sx2, y1, y2;

  if (rectIdx == 0) {
    // Main rectangle (thin bar for small, wide box for large)
    sx1 = cxClip - rectWidthClip * 0.5;
    sx2 = cxClip + rectWidthClip * 0.5;
    y1 = syBot;
    y2 = syTop;
  } else if (rectIdx == 1) {
    // Top tick (only for small insertions when zoomed in)
    if (isLongInsertion || pxPerBp < 0.5) {
      // Hide tick by making it zero-size
      sx1 = cxClip;
      sx2 = cxClip;
      y1 = syTop;
      y2 = syTop;
    } else {
      sx1 = cxClip - tickWidthClip * 0.5;
      sx2 = cxClip + tickWidthClip * 0.5;
      float tickHeight = 1.0 / u_canvasHeight * 2.0;
      y1 = syTop;
      y2 = syTop + tickHeight;
    }
  } else {
    // Bottom tick (only for small insertions when zoomed in)
    if (isLongInsertion || pxPerBp < 0.5) {
      // Hide tick by making it zero-size
      sx1 = cxClip;
      sx2 = cxClip;
      y1 = syBot;
      y2 = syBot;
    } else {
      sx1 = cxClip - tickWidthClip * 0.5;
      sx2 = cxClip + tickWidthClip * 0.5;
      float tickHeight = 1.0 / u_canvasHeight * 2.0;
      y1 = syBot - tickHeight;
      y2 = syBot;
    }
  }

  // Ensure minimum width for long insertions (>=10bp) so they stay visible
  // Small insertions can be subpixel and vanish when zoomed out
  if (isLongInsertion && rectIdx == 0) {
    float minWidth = 2.0 / u_canvasWidth;
    if (sx2 - sx1 < minWidth) {
      float mid = (sx1 + sx2) * 0.5;
      sx1 = mid - minWidth * 0.5;
      sx2 = mid + minWidth * 0.5;
    }
  }

  float sx = mix(sx1, sx2, localX);
  float sy = mix(y1, y2, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(u_colorInsertion, 1.0);
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
// Uses integer attributes for compact representation
const SOFTCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;  // Position offset from regionStart
in uint a_y;         // pileup row
in uint a_length;    // clip length

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Softclip color uniform from theme
uniform vec3 u_colorSoftclip;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float domainWidth = u_domainX.y - u_domainX.x;
  float bpPerPx = domainWidth / u_canvasWidth;

  // Soft clip bar width
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float x1 = pos - barWidthBp * 0.5;
  float x2 = pos + barWidthBp * 0.5;

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

  // Calculate Y position in pixels (constant height per row)
  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(u_colorSoftclip, 1.0);
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

// Hard clip vertex shader - colored bars
// Uses integer attributes for compact representation
const HARDCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;  // Position offset from regionStart
in uint a_y;         // pileup row
in uint a_length;    // clip length

uniform vec2 u_domainX;
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform float u_canvasWidth;

// Hardclip color uniform from theme
uniform vec3 u_colorHardclip;

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float domainWidth = u_domainX.y - u_domainX.x;
  float bpPerPx = domainWidth / u_canvasWidth;

  // Hard clip bar width
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float x1 = pos - barWidthBp * 0.5;
  float x2 = pos + barWidthBp * 0.5;

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

  // Calculate Y position in pixels (constant height per row)
  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(u_colorHardclip, 1.0);
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

// Modification vertex shader - colored rectangles with per-instance RGBA color
// Color and alpha are pre-computed on CPU (arbitrary modification types + probability)
const MODIFICATION_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in vec4 a_color;      // RGBA color (normalized from Uint8)

uniform vec2 u_domainX;  // [domainStart, domainEnd] as offsets
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

  float pos = float(a_position);
  float domainWidth = u_domainX.y - u_domainX.x;
  float sx1 = (pos - u_domainX.x) / domainWidth * 2.0 - 1.0;
  float sx2 = (pos + 1.0 - u_domainX.x) / domainWidth * 2.0 - 1.0;

  // Ensure minimum width of 1 pixel
  float minWidth = 2.0 / u_canvasWidth;
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  float pileupTop = 1.0 - (u_coverageOffset / u_canvasHeight) * 2.0;
  float pxToClip = 2.0 / u_canvasHeight;
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = a_color;
}
`

const MODIFICATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// RGB color as [r, g, b] where each is 0-1
export type RGBColor = [number, number, number]

// Color palette for the renderer - matches shared/color.ts and theme
export interface ColorPalette {
  // Read/alignment colors from shared/color.ts
  colorFwdStrand: RGBColor // #EC8B8B
  colorRevStrand: RGBColor // #8F8FD8
  colorNostrand: RGBColor // #c8c8c8
  colorPairLR: RGBColor // lightgrey
  colorPairRL: RGBColor // teal
  colorPairRR: RGBColor // #3a3a9d
  colorPairLL: RGBColor // green
  // Theme colors for bases (A, C, G, T)
  colorBaseA: RGBColor // green (#4caf50)
  colorBaseC: RGBColor // blue (#2196f3)
  colorBaseG: RGBColor // orange (#ff9800)
  colorBaseT: RGBColor // red (#f44336)
  // Theme colors for indels/clips
  colorInsertion: RGBColor // purple (#800080)
  colorDeletion: RGBColor // grey (#808080)
  colorSkip: RGBColor // teal/blue (#97b8c9)
  colorSoftclip: RGBColor // blue (#00f)
  colorHardclip: RGBColor // red (#f00)
  // Coverage color
  colorCoverage: RGBColor // light grey
  // Modification mode read colors
  colorModificationFwd: RGBColor // #c8c8c8
  colorModificationRev: RGBColor // #c8dcc8 (slightly green)
}

// Default colors matching shared/color.ts fillColor values and theme
export const defaultColorPalette: ColorPalette = {
  // Read colors
  colorFwdStrand: [0.925, 0.545, 0.545], // #EC8B8B
  colorRevStrand: [0.561, 0.561, 0.847], // #8F8FD8
  colorNostrand: [0.784, 0.784, 0.784], // #c8c8c8
  colorPairLR: [0.827, 0.827, 0.827], // lightgrey (#d3d3d3)
  colorPairRL: [0, 0.502, 0.502], // teal
  colorPairRR: [0.227, 0.227, 0.616], // #3a3a9d
  colorPairLL: [0, 0.502, 0], // green
  // Base colors (MUI theme)
  colorBaseA: [0.298, 0.686, 0.314], // green (#4caf50)
  colorBaseC: [0.129, 0.588, 0.953], // blue (#2196f3)
  colorBaseG: [1, 0.596, 0], // orange (#ff9800)
  colorBaseT: [0.957, 0.263, 0.212], // red (#f44336)
  // Indel/clip colors (theme)
  colorInsertion: [0.502, 0, 0.502], // purple (#800080)
  colorDeletion: [0.502, 0.502, 0.502], // grey (#808080)
  colorSkip: [0.592, 0.722, 0.788], // teal/blue (#97b8c9)
  colorSoftclip: [0, 0, 1], // blue (#00f)
  colorHardclip: [1, 0, 0], // red (#f00)
  // Coverage color
  colorCoverage: [0.8, 0.8, 0.8], // light grey (#cccccc)
  // Modification mode read colors
  colorModificationFwd: [0.784, 0.784, 0.784], // #c8c8c8
  colorModificationRev: [0.784, 0.863, 0.784], // #c8dcc8
}

// ---- Arc shader constants ----
const ARC_CURVE_SEGMENTS = 64
const NUM_ARC_COLORS = 8
const NUM_LINE_COLORS = 2

function cssColorToRgb(color: string): RGBColor {
  const { r, g, b } = colord(color).toRgb()
  return [r / 255, g / 255, b / 255]
}

const arcColorPalette: RGBColor[] = [
  cssColorToRgb(fillColor.color_pair_lr),
  cssColorToRgb(fillColor.color_longinsert),
  cssColorToRgb(fillColor.color_shortinsert),
  cssColorToRgb(fillColor.color_interchrom),
  cssColorToRgb(fillColor.color_pair_ll),
  cssColorToRgb(fillColor.color_pair_rr),
  cssColorToRgb(fillColor.color_pair_rl),
  cssColorToRgb(fillColor.color_longread_rev_fwd),
]

const arcLineColorPalette: RGBColor[] = [
  cssColorToRgb(fillColor.color_interchrom),
  cssColorToRgb(fillColor.color_longinsert),
]

const ARC_VERTEX_SHADER = `#version 300 es
precision highp float;
in float a_t;
in float a_side;
in float a_x1;
in float a_x2;
in float a_colorType;
in float a_isArc;

uniform float u_domainStartOffset;
uniform float u_domainExtent;
uniform float u_canvasWidth;
uniform float u_canvasHeight;
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
  float pxPerBp = u_canvasWidth / u_domainExtent;
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
  float screenX = (x_bp - u_domainStartOffset) * pxPerBp;
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

const ARC_FRAGMENT_SHADER = `#version 300 es
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

const ARC_LINE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;
in uint a_position;
in float a_y;
in float a_colorType;
uniform vec3 u_domainX;
uniform uint u_regionStart;
uniform float u_canvasHeight;
uniform float u_coverageOffset;
uniform vec3 u_arcLineColors[${NUM_LINE_COLORS}];
out vec4 v_color;

${HP_GLSL_FUNCTIONS}

void main() {
  uint absPos = a_position + u_regionStart;
  vec2 splitPos = hpSplitUint(absPos);
  float sx = hpToClipX(splitPos, u_domainX);
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

const ARC_LINE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// ---- Cloud shader constants ----
const CLOUD_VERTEX_SHADER = `#version 300 es
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

const CLOUD_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

export interface RenderState {
  domainX: [number, number] // absolute genomic positions
  rangeY: [number, number]
  colorScheme: number
  featureHeight: number
  featureSpacing: number
  showCoverage: boolean
  coverageHeight: number
  coverageYOffset: number // padding at top/bottom of coverage area for scalebar labels
  showMismatches: boolean
  showInterbaseCounts: boolean
  showInterbaseIndicators: boolean
  showModifications: boolean
  // Canvas dimensions - passed in to avoid forced layout from reading clientWidth/clientHeight
  canvasWidth: number
  canvasHeight: number
  // Feature highlighting (-1 means no highlight)
  highlightedFeatureIndex: number
  // Selected feature for outline (-1 means no selection)
  selectedFeatureIndex: number
  // Optional color palette - uses defaultColorPalette if not provided
  colors?: Partial<ColorPalette>
  // Rendering mode - 'pileup' (default), 'arcs', or 'cloud'
  renderingMode?: 'pileup' | 'arcs' | 'cloud'
  // Arcs-specific
  arcLineWidth?: number
  // Cloud-specific
  cloudColorScheme?: number
}

interface GPUBuffers {
  // Reference point for all position offsets
  regionStart: number
  readVAO: WebGLVertexArrayObject
  readCount: number
  // CPU-side copies for selection outline drawing
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  coverageVAO: WebGLVertexArrayObject | null
  coverageCount: number
  maxDepth: number
  binSize: number
  // SNP coverage (exact positions)
  snpCoverageVAO: WebGLVertexArrayObject | null
  snpCoverageCount: number
  // Noncov histogram (insertion/softclip/hardclip counts)
  noncovHistogramVAO: WebGLVertexArrayObject | null
  noncovHistogramCount: number
  noncovMaxCount: number
  // Interbase indicators (triangles)
  indicatorVAO: WebGLVertexArrayObject | null
  indicatorCount: number
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
  modificationVAO: WebGLVertexArrayObject | null
  modificationCount: number
  modCoverageVAO: WebGLVertexArrayObject | null
  modCoverageCount: number
  // Arcs mode
  arcVAO: WebGLVertexArrayObject | null
  arcCount: number
  arcLineVAO: WebGLVertexArrayObject | null
  arcLineCount: number
  // Cloud mode
  cloudVAO: WebGLVertexArrayObject | null
  cloudCount: number
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement

  private readProgram: WebGLProgram
  private coverageProgram: WebGLProgram
  private snpCoverageProgram: WebGLProgram
  private noncovHistogramProgram: WebGLProgram
  private indicatorProgram: WebGLProgram
  private lineProgram: WebGLProgram
  private gapProgram: WebGLProgram
  private mismatchProgram: WebGLProgram
  private insertionProgram: WebGLProgram
  private softclipProgram: WebGLProgram
  private hardclipProgram: WebGLProgram
  private modificationProgram: WebGLProgram
  private modCoverageProgram: WebGLProgram

  private buffers: GPUBuffers | null = null
  private glBuffers: WebGLBuffer[] = []
  private lineVAO: WebGLVertexArrayObject | null = null
  private lineBuffer: WebGLBuffer | null = null

  private readUniforms: Record<string, WebGLUniformLocation | null> = {}
  private coverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private snpCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}
  private noncovHistogramUniforms: Record<string, WebGLUniformLocation | null> =
    {}
  private indicatorUniforms: Record<string, WebGLUniformLocation | null> = {}
  private lineUniforms: Record<string, WebGLUniformLocation | null> = {}
  private gapUniforms: Record<string, WebGLUniformLocation | null> = {}
  private mismatchUniforms: Record<string, WebGLUniformLocation | null> = {}
  private insertionUniforms: Record<string, WebGLUniformLocation | null> = {}
  private softclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  private hardclipUniforms: Record<string, WebGLUniformLocation | null> = {}
  private modificationUniforms: Record<string, WebGLUniformLocation | null> = {}
  private modCoverageUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Arcs mode
  private arcProgram: WebGLProgram | null = null
  private arcLineProgram: WebGLProgram | null = null
  private arcTemplateBuffer: WebGLBuffer | null = null
  private arcInstanceBuffers: WebGLBuffer[] = []
  private arcUniforms: Record<string, WebGLUniformLocation | null> = {}
  private arcLineUniforms: Record<string, WebGLUniformLocation | null> = {}

  // Cloud mode
  private cloudProgram: WebGLProgram | null = null
  private cloudGLBuffers: WebGLBuffer[] = []
  private cloudUniforms: Record<string, WebGLUniformLocation | null> = {}

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

    this.noncovHistogramProgram = this.createProgram(
      NONCOV_HISTOGRAM_VERTEX_SHADER,
      NONCOV_HISTOGRAM_FRAGMENT_SHADER,
    )

    this.indicatorProgram = this.createProgram(
      INDICATOR_VERTEX_SHADER,
      INDICATOR_FRAGMENT_SHADER,
    )

    this.lineProgram = this.createProgram(
      LINE_VERTEX_SHADER,
      LINE_FRAGMENT_SHADER,
    )
    this.gapProgram = this.createProgram(GAP_VERTEX_SHADER, GAP_FRAGMENT_SHADER)
    this.mismatchProgram = this.createProgram(
      MISMATCH_VERTEX_SHADER,
      MISMATCH_FRAGMENT_SHADER,
    )
    this.insertionProgram = this.createProgram(
      INSERTION_VERTEX_SHADER,
      INSERTION_FRAGMENT_SHADER,
    )
    this.softclipProgram = this.createProgram(
      SOFTCLIP_VERTEX_SHADER,
      SOFTCLIP_FRAGMENT_SHADER,
    )
    this.hardclipProgram = this.createProgram(
      HARDCLIP_VERTEX_SHADER,
      HARDCLIP_FRAGMENT_SHADER,
    )
    this.modificationProgram = this.createProgram(
      MODIFICATION_VERTEX_SHADER,
      MODIFICATION_FRAGMENT_SHADER,
    )
    this.modCoverageProgram = this.createProgram(
      MOD_COVERAGE_VERTEX_SHADER,
      MOD_COVERAGE_FRAGMENT_SHADER,
    )

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
      'u_regionStart',
      'u_rangeY',
      'u_colorScheme',
      'u_featureHeight',
      'u_featureSpacing',
      'u_coverageOffset',
      'u_canvasHeight',
      'u_highlightedIndex',
      'u_canvasWidth',
      // Color uniforms
      'u_colorFwdStrand',
      'u_colorRevStrand',
      'u_colorNostrand',
      'u_colorPairLR',
      'u_colorPairRL',
      'u_colorPairRR',
      'u_colorPairLL',
      'u_colorModificationFwd',
      'u_colorModificationRev',
    ])

    this.cacheUniforms(this.coverageProgram, this.coverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_binSize',
      'u_canvasHeight',
      'u_canvasWidth',
      'u_colorCoverage',
    ])

    // Base color uniforms for SNP/mismatch shaders
    const baseColorUniforms = [
      'u_colorBaseA',
      'u_colorBaseC',
      'u_colorBaseG',
      'u_colorBaseT',
    ]
    // Indel/clip color uniforms
    const indelColorUniforms = [
      'u_colorInsertion',
      'u_colorSoftclip',
      'u_colorHardclip',
    ]

    this.cacheUniforms(this.snpCoverageProgram, this.snpCoverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_canvasHeight',
      'u_canvasWidth',
      ...baseColorUniforms,
    ])

    this.cacheUniforms(
      this.noncovHistogramProgram,
      this.noncovHistogramUniforms,
      [
        'u_visibleRange',
        'u_noncovHeight',
        'u_canvasHeight',
        'u_canvasWidth',
        ...indelColorUniforms,
      ],
    )

    this.cacheUniforms(this.indicatorProgram, this.indicatorUniforms, [
      'u_visibleRange',
      'u_canvasHeight',
      'u_canvasWidth',
      ...indelColorUniforms,
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
    this.cacheUniforms(this.gapProgram, this.gapUniforms, [
      ...cigarUniforms,
      'u_colorDeletion',
      'u_colorSkip',
    ])
    this.cacheUniforms(this.mismatchProgram, this.mismatchUniforms, [
      ...cigarUniformsWithWidth,
      ...baseColorUniforms,
    ])
    this.cacheUniforms(this.insertionProgram, this.insertionUniforms, [
      ...cigarUniformsWithWidth,
      'u_colorInsertion',
    ])
    this.cacheUniforms(this.softclipProgram, this.softclipUniforms, [
      ...cigarUniformsWithWidth,
      'u_colorSoftclip',
    ])
    this.cacheUniforms(this.hardclipProgram, this.hardclipUniforms, [
      ...cigarUniformsWithWidth,
      'u_colorHardclip',
    ])
    this.cacheUniforms(this.modificationProgram, this.modificationUniforms, [
      ...cigarUniformsWithWidth,
    ])
    this.cacheUniforms(this.modCoverageProgram, this.modCoverageUniforms, [
      'u_visibleRange',
      'u_coverageHeight',
      'u_coverageYOffset',
      'u_canvasHeight',
      'u_canvasWidth',
    ])

    // Arcs programs
    this.arcProgram = this.createProgram(ARC_VERTEX_SHADER, ARC_FRAGMENT_SHADER)
    this.arcLineProgram = this.createProgram(
      ARC_LINE_VERTEX_SHADER,
      ARC_LINE_FRAGMENT_SHADER,
    )

    this.cacheUniforms(this.arcProgram, this.arcUniforms, [
      'u_domainStartOffset',
      'u_domainExtent',
      'u_canvasWidth',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_lineWidthPx',
      'u_gradientHue',
    ])
    for (let i = 0; i < NUM_ARC_COLORS; i++) {
      this.arcUniforms[`u_arcColors[${i}]`] = gl.getUniformLocation(
        this.arcProgram,
        `u_arcColors[${i}]`,
      )
    }

    this.cacheUniforms(this.arcLineProgram, this.arcLineUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_canvasHeight',
      'u_coverageOffset',
    ])
    for (let i = 0; i < NUM_LINE_COLORS; i++) {
      this.arcLineUniforms[`u_arcLineColors[${i}]`] = gl.getUniformLocation(
        this.arcLineProgram,
        `u_arcLineColors[${i}]`,
      )
    }

    // Arc template buffer (shared triangle strip for instanced curves)
    const numArcVertices = (ARC_CURVE_SEGMENTS + 1) * 2
    const templateData = new Float32Array(numArcVertices * 2)
    for (let i = 0; i <= ARC_CURVE_SEGMENTS; i++) {
      const t = i / ARC_CURVE_SEGMENTS
      const base = i * 4
      templateData[base + 0] = t
      templateData[base + 1] = 1
      templateData[base + 2] = t
      templateData[base + 3] = -1
    }
    this.arcTemplateBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, templateData, gl.STATIC_DRAW)

    // Cloud program
    this.cloudProgram = this.createProgram(
      CLOUD_VERTEX_SHADER,
      CLOUD_FRAGMENT_SHADER,
    )
    this.cacheUniforms(this.cloudProgram, this.cloudUniforms, [
      'u_domainX',
      'u_regionStart',
      'u_featureHeight',
      'u_canvasHeight',
      'u_coverageOffset',
      'u_colorScheme',
    ])

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
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource)
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.detachShader(program, vs)
    gl.detachShader(program, fs)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
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

  /**
   * Upload reads from pre-computed typed arrays (from RPC worker)
   * Positions are offsets from regionStart for Float32 precision
   */
  uploadFromTypedArrays(data: {
    regionStart: number
    readPositions: Uint32Array // offsets from regionStart
    readYs: Uint16Array
    readFlags: Uint16Array
    readMapqs: Uint8Array
    readInsertSizes: Float32Array
    readPairOrientations: Uint8Array
    readStrands: Int8Array
    readTagColors: Uint8Array // RGB per read (3 bytes each), for tag coloring
    numReads: number
    maxY: number
  }) {
    const gl = this.gl
    // Save old buffers reference, then null out to prevent render() from
    // drawing with stale data while we delete and recreate GL resources
    const oldBuffers = this.buffers
    this.buffers = null

    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    // Clean up old VAOs
    if (oldBuffers) {
      gl.deleteVertexArray(oldBuffers.readVAO)
      if (oldBuffers.coverageVAO) {
        gl.deleteVertexArray(oldBuffers.coverageVAO)
      }
      if (oldBuffers.snpCoverageVAO) {
        gl.deleteVertexArray(oldBuffers.snpCoverageVAO)
      }
      if (oldBuffers.noncovHistogramVAO) {
        gl.deleteVertexArray(oldBuffers.noncovHistogramVAO)
      }
      if (oldBuffers.indicatorVAO) {
        gl.deleteVertexArray(oldBuffers.indicatorVAO)
      }
      if (oldBuffers.gapVAO) {
        gl.deleteVertexArray(oldBuffers.gapVAO)
      }
      if (oldBuffers.mismatchVAO) {
        gl.deleteVertexArray(oldBuffers.mismatchVAO)
      }
      if (oldBuffers.insertionVAO) {
        gl.deleteVertexArray(oldBuffers.insertionVAO)
      }
      if (oldBuffers.softclipVAO) {
        gl.deleteVertexArray(oldBuffers.softclipVAO)
      }
      if (oldBuffers.hardclipVAO) {
        gl.deleteVertexArray(oldBuffers.hardclipVAO)
      }
      if (oldBuffers.modificationVAO) {
        gl.deleteVertexArray(oldBuffers.modificationVAO)
      }
      if (oldBuffers.modCoverageVAO) {
        gl.deleteVertexArray(oldBuffers.modCoverageVAO)
      }
      if (oldBuffers.arcVAO) {
        gl.deleteVertexArray(oldBuffers.arcVAO)
      }
      if (oldBuffers.arcLineVAO) {
        gl.deleteVertexArray(oldBuffers.arcLineVAO)
      }
      if (oldBuffers.cloudVAO) {
        gl.deleteVertexArray(oldBuffers.cloudVAO)
      }
    }
    // Clean up arc instance buffers
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []
    // Clean up cloud buffers
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.cloudGLBuffers = []

    if (data.numReads === 0) {
      // Create a minimal buffers object so arcs/cloud modes can attach their data
      const emptyVAO = gl.createVertexArray()
      gl.bindVertexArray(emptyVAO)
      gl.bindVertexArray(null)
      this.buffers = {
        regionStart: data.regionStart,
        readVAO: emptyVAO,
        readCount: 0,
        readPositions: data.readPositions,
        readYs: data.readYs,
        readStrands: data.readStrands,
        coverageVAO: null,
        coverageCount: 0,
        maxDepth: 0,
        binSize: 1,
        snpCoverageVAO: null,
        snpCoverageCount: 0,
        noncovHistogramVAO: null,
        noncovHistogramCount: 0,
        noncovMaxCount: 0,
        indicatorVAO: null,
        indicatorCount: 0,
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
        modificationVAO: null,
        modificationCount: 0,
        modCoverageVAO: null,
        modCoverageCount: 0,
        arcVAO: null,
        arcCount: 0,
        arcLineVAO: null,
        arcLineCount: 0,
        cloudVAO: null,
        cloudCount: 0,
      }
      return
    }

    // Read VAO - use integer positions for high-precision rendering
    const readVAO = gl.createVertexArray()
    gl.bindVertexArray(readVAO)
    // Upload positions as unsigned integers for high-precision (12-bit split in shader)
    this.uploadUintBuffer(this.readProgram, 'a_position', data.readPositions, 2)
    this.uploadBuffer(this.readProgram, 'a_y', new Float32Array(data.readYs), 1)
    this.uploadBuffer(
      this.readProgram,
      'a_flags',
      new Float32Array(data.readFlags),
      1,
    )
    this.uploadBuffer(
      this.readProgram,
      'a_mapq',
      new Float32Array(data.readMapqs),
      1,
    )
    this.uploadBuffer(this.readProgram, 'a_insertSize', data.readInsertSizes, 1)
    this.uploadBuffer(
      this.readProgram,
      'a_pairOrientation',
      new Float32Array(data.readPairOrientations),
      1,
    )
    this.uploadBuffer(
      this.readProgram,
      'a_strand',
      new Float32Array(data.readStrands),
      1,
    )
    // Only upload tag colors if data is available; otherwise set a constant
    // attribute value to avoid "attribs only supply 0" WebGL warning
    if (data.readTagColors.length > 0) {
      this.uploadNormalizedByteBuffer(
        this.readProgram,
        'a_tagColor',
        data.readTagColors,
        3,
      )
    } else {
      const loc = gl.getAttribLocation(this.readProgram, 'a_tagColor')
      if (loc >= 0) {
        gl.disableVertexAttribArray(loc)
        gl.vertexAttrib3f(loc, 0, 0, 0)
      }
    }
    gl.bindVertexArray(null)

    this.buffers = {
      regionStart: data.regionStart,
      readVAO,
      readCount: data.numReads,
      readPositions: data.readPositions,
      readYs: data.readYs,
      readStrands: data.readStrands,
      coverageVAO: null,
      coverageCount: 0,
      maxDepth: 0,
      binSize: 1,
      snpCoverageVAO: null,
      snpCoverageCount: 0,
      noncovHistogramVAO: null,
      noncovHistogramCount: 0,
      noncovMaxCount: 0,
      indicatorVAO: null,
      indicatorCount: 0,
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
      modificationVAO: null,
      modificationCount: 0,
      modCoverageVAO: null,
      modCoverageCount: 0,
      arcVAO: null,
      arcCount: 0,
      arcLineVAO: null,
      arcLineCount: 0,
      cloudVAO: null,
      cloudCount: 0,
    }
  }

  /**
   * Upload CIGAR data from pre-computed typed arrays (from RPC worker)
   * Accepts optimized integer types and converts to float for GPU
   */
  uploadCigarFromTypedArrays(data: {
    gapPositions: Uint32Array
    gapYs: Uint16Array
    gapTypes: Uint8Array
    numGaps: number
    mismatchPositions: Uint32Array
    mismatchYs: Uint16Array
    mismatchBases: Uint8Array
    numMismatches: number
    insertionPositions: Uint32Array
    insertionYs: Uint16Array
    insertionLengths: Uint16Array
    numInsertions: number
    softclipPositions: Uint32Array
    softclipYs: Uint16Array
    softclipLengths: Uint16Array
    numSoftclips: number
    hardclipPositions: Uint32Array
    hardclipYs: Uint16Array
    hardclipLengths: Uint16Array
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

    // Upload gaps - use integer buffers directly (no Float32 conversion)
    if (data.numGaps > 0) {
      const gapVAO = gl.createVertexArray()
      gl.bindVertexArray(gapVAO)
      this.uploadUintBuffer(this.gapProgram, 'a_position', data.gapPositions, 2)
      this.uploadUint16Buffer(this.gapProgram, 'a_y', data.gapYs, 1)
      this.uploadUint8Buffer(this.gapProgram, 'a_type', data.gapTypes, 1)
      gl.bindVertexArray(null)

      this.buffers.gapVAO = gapVAO
      this.buffers.gapCount = data.numGaps
    } else {
      this.buffers.gapCount = 0
    }

    // Upload mismatches - use integer buffers directly
    if (data.numMismatches > 0) {
      const mismatchVAO = gl.createVertexArray()
      gl.bindVertexArray(mismatchVAO)
      this.uploadUintBuffer(
        this.mismatchProgram,
        'a_position',
        data.mismatchPositions,
        1,
      )
      this.uploadUint16Buffer(this.mismatchProgram, 'a_y', data.mismatchYs, 1)
      this.uploadUint8Buffer(
        this.mismatchProgram,
        'a_base',
        data.mismatchBases,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.mismatchVAO = mismatchVAO
      this.buffers.mismatchCount = data.numMismatches
    } else {
      this.buffers.mismatchCount = 0
    }

    // Upload insertions - use integer buffers directly
    if (data.numInsertions > 0) {
      const insertionVAO = gl.createVertexArray()
      gl.bindVertexArray(insertionVAO)
      this.uploadUintBuffer(
        this.insertionProgram,
        'a_position',
        data.insertionPositions,
        1,
      )
      this.uploadUint16Buffer(this.insertionProgram, 'a_y', data.insertionYs, 1)
      this.uploadUint16Buffer(
        this.insertionProgram,
        'a_length',
        data.insertionLengths,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.insertionVAO = insertionVAO
      this.buffers.insertionCount = data.numInsertions
    } else {
      this.buffers.insertionCount = 0
    }

    // Upload soft clips - use integer buffers directly
    if (data.numSoftclips > 0) {
      const softclipVAO = gl.createVertexArray()
      gl.bindVertexArray(softclipVAO)
      this.uploadUintBuffer(
        this.softclipProgram,
        'a_position',
        data.softclipPositions,
        1,
      )
      this.uploadUint16Buffer(this.softclipProgram, 'a_y', data.softclipYs, 1)
      this.uploadUint16Buffer(
        this.softclipProgram,
        'a_length',
        data.softclipLengths,
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.softclipVAO = softclipVAO
      this.buffers.softclipCount = data.numSoftclips
    } else {
      this.buffers.softclipCount = 0
    }

    // Upload hard clips - use integer buffers directly
    if (data.numHardclips > 0) {
      const hardclipVAO = gl.createVertexArray()
      gl.bindVertexArray(hardclipVAO)
      this.uploadUintBuffer(
        this.hardclipProgram,
        'a_position',
        data.hardclipPositions,
        1,
      )
      this.uploadUint16Buffer(this.hardclipProgram, 'a_y', data.hardclipYs, 1)
      this.uploadUint16Buffer(
        this.hardclipProgram,
        'a_length',
        data.hardclipLengths,
        1,
      )
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
  /**
   * Upload coverage data from pre-computed typed arrays
   * Positions are offsets from regionStart
   */
  uploadCoverageFromTypedArrays(data: {
    coverageDepths: Float32Array
    coverageMaxDepth: number
    coverageBinSize: number
    coverageStartOffset: number // offset from regionStart where coverage begins
    numCoverageBins: number
    snpPositions: Uint32Array // offsets from regionStart
    snpYOffsets: Float32Array
    snpHeights: Float32Array
    snpColorTypes: Uint8Array
    numSnpSegments: number
    // Noncov (interbase) coverage data
    noncovPositions: Uint32Array
    noncovYOffsets: Float32Array
    noncovHeights: Float32Array
    noncovColorTypes: Uint8Array
    noncovMaxCount: number
    numNoncovSegments: number
    // Indicator data
    indicatorPositions: Uint32Array
    indicatorColorTypes: Uint8Array
    numIndicators: number
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
    if (this.buffers.noncovHistogramVAO) {
      gl.deleteVertexArray(this.buffers.noncovHistogramVAO)
    }
    if (this.buffers.indicatorVAO) {
      gl.deleteVertexArray(this.buffers.indicatorVAO)
    }

    // Upload grey coverage bars with explicit positions
    if (data.numCoverageBins > 0) {
      // Generate position array (offsets from regionStart)
      // coverageStartOffset indicates where coverage begins relative to regionStart
      // (can be negative if features extend before regionStart)
      const positions = new Float32Array(data.numCoverageBins)
      for (let i = 0; i < data.numCoverageBins; i++) {
        positions[i] = data.coverageStartOffset + i * data.coverageBinSize
      }

      // Normalize depths
      const normalizedDepths = new Float32Array(data.coverageDepths.length)
      for (let i = 0; i < data.coverageDepths.length; i++) {
        normalizedDepths[i] =
          (data.coverageDepths[i] ?? 0) / data.coverageMaxDepth
      }

      const coverageVAO = gl.createVertexArray()
      gl.bindVertexArray(coverageVAO)
      this.uploadBuffer(this.coverageProgram, 'a_position', positions, 1)
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

    // Upload SNP coverage - convert Uint32Array positions and Uint8Array colors to Float32 for GPU
    if (data.numSnpSegments > 0) {
      const snpCoverageVAO = gl.createVertexArray()
      gl.bindVertexArray(snpCoverageVAO)
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_position',
        new Float32Array(data.snpPositions),
        1,
      )
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_yOffset',
        data.snpYOffsets,
        1,
      )
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_segmentHeight',
        data.snpHeights,
        1,
      )
      this.uploadBuffer(
        this.snpCoverageProgram,
        'a_colorType',
        new Float32Array(data.snpColorTypes),
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.snpCoverageVAO = snpCoverageVAO
      this.buffers.snpCoverageCount = data.numSnpSegments
    } else {
      this.buffers.snpCoverageVAO = null
      this.buffers.snpCoverageCount = 0
    }

    // Upload noncov (interbase) histogram - insertion/softclip/hardclip counts
    if (data.numNoncovSegments > 0) {
      const noncovHistogramVAO = gl.createVertexArray()
      gl.bindVertexArray(noncovHistogramVAO)
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_position',
        new Float32Array(data.noncovPositions),
        1,
      )
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_yOffset',
        data.noncovYOffsets,
        1,
      )
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_segmentHeight',
        data.noncovHeights,
        1,
      )
      this.uploadBuffer(
        this.noncovHistogramProgram,
        'a_colorType',
        new Float32Array(data.noncovColorTypes),
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.noncovHistogramVAO = noncovHistogramVAO
      this.buffers.noncovHistogramCount = data.numNoncovSegments
      this.buffers.noncovMaxCount = data.noncovMaxCount
    } else {
      this.buffers.noncovHistogramVAO = null
      this.buffers.noncovHistogramCount = 0
      this.buffers.noncovMaxCount = 0
    }

    // Upload interbase indicators - triangles at significant positions
    if (data.numIndicators > 0) {
      const indicatorVAO = gl.createVertexArray()
      gl.bindVertexArray(indicatorVAO)
      this.uploadBuffer(
        this.indicatorProgram,
        'a_position',
        new Float32Array(data.indicatorPositions),
        1,
      )
      this.uploadBuffer(
        this.indicatorProgram,
        'a_colorType',
        new Float32Array(data.indicatorColorTypes),
        1,
      )
      gl.bindVertexArray(null)

      this.buffers.indicatorVAO = indicatorVAO
      this.buffers.indicatorCount = data.numIndicators
    } else {
      this.buffers.indicatorVAO = null
      this.buffers.indicatorCount = 0
    }
  }

  uploadModificationsFromTypedArrays(data: {
    modificationPositions: Uint32Array
    modificationYs: Uint16Array
    modificationColors: Uint8Array // RGBA packed, 4 bytes per modification
    numModifications: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    if (this.buffers.modificationVAO) {
      gl.deleteVertexArray(this.buffers.modificationVAO)
      this.buffers.modificationVAO = null
    }

    if (data.numModifications > 0) {
      const modificationVAO = gl.createVertexArray()
      gl.bindVertexArray(modificationVAO)
      this.uploadUintBuffer(
        this.modificationProgram,
        'a_position',
        data.modificationPositions,
        1,
      )
      this.uploadUint16Buffer(
        this.modificationProgram,
        'a_y',
        data.modificationYs,
        1,
      )
      // Upload RGBA color as normalized unsigned bytes (gl.UNSIGNED_BYTE with normalize=true)
      this.uploadNormalizedUint8Buffer(
        this.modificationProgram,
        'a_color',
        data.modificationColors,
        4,
      )
      gl.bindVertexArray(null)

      this.buffers.modificationVAO = modificationVAO
      this.buffers.modificationCount = data.numModifications
    } else {
      this.buffers.modificationCount = 0
    }
  }

  uploadModCoverageFromTypedArrays(data: {
    modCovPositions: Uint32Array
    modCovYOffsets: Float32Array
    modCovHeights: Float32Array
    modCovColors: Uint8Array // packed RGBA, 4 bytes per segment
    numModCovSegments: number
  }) {
    const gl = this.gl

    if (!this.buffers) {
      return
    }

    if (this.buffers.modCoverageVAO) {
      gl.deleteVertexArray(this.buffers.modCoverageVAO)
      this.buffers.modCoverageVAO = null
    }

    if (data.numModCovSegments > 0) {
      const modCoverageVAO = gl.createVertexArray()
      gl.bindVertexArray(modCoverageVAO)
      this.uploadBuffer(
        this.modCoverageProgram,
        'a_position',
        new Float32Array(data.modCovPositions),
        1,
      )
      this.uploadBuffer(
        this.modCoverageProgram,
        'a_yOffset',
        data.modCovYOffsets,
        1,
      )
      this.uploadBuffer(
        this.modCoverageProgram,
        'a_segmentHeight',
        data.modCovHeights,
        1,
      )
      this.uploadNormalizedUint8Buffer(
        this.modCoverageProgram,
        'a_color',
        data.modCovColors,
        4,
      )
      gl.bindVertexArray(null)

      this.buffers.modCoverageVAO = modCoverageVAO
      this.buffers.modCoverageCount = data.numModCovSegments
    } else {
      this.buffers.modCoverageCount = 0
    }
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
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload unsigned integer buffer for high-precision position attributes
   * Uses vertexAttribIPointer to pass integers directly to shader
   */
  private uploadUintBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint16Array as unsigned short integer attribute
   */
  private uploadUint16Buffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint16Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_SHORT, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint8Array as normalized float attribute (0-255 → 0.0-1.0)
   * Used for per-instance color data stored as bytes
   */
  private uploadNormalizedByteBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint8Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, size, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint8Array as unsigned byte integer attribute
   */
  private uploadUint8Buffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint8Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_BYTE, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Upload Uint8Array as normalized float attribute (0-255 -> 0.0-1.0)
   * Used for RGBA colors where shader receives vec4 in 0-1 range
   */
  private uploadNormalizedUint8Buffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint8Array,
    size: number,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }

    const buffer = gl.createBuffer()
    this.glBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    // normalize=true converts Uint8 0-255 to float 0.0-1.0
    gl.vertexAttribPointer(loc, size, gl.UNSIGNED_BYTE, true, 0, 0)
    gl.vertexAttribDivisor(loc, 1)
  }

  /**
   * Ensure a buffers object exists (needed for arcs/cloud modes that don't have pileup data)
   */
  ensureBuffers(regionStart: number) {
    if (this.buffers) {
      return
    }
    const gl = this.gl
    const emptyVAO = gl.createVertexArray()
    gl.bindVertexArray(emptyVAO)
    gl.bindVertexArray(null)
    this.buffers = {
      regionStart,
      readVAO: emptyVAO,
      readCount: 0,
      readPositions: new Uint32Array(0),
      readYs: new Uint16Array(0),
      readStrands: new Int8Array(0),
      coverageVAO: null,
      coverageCount: 0,
      maxDepth: 0,
      binSize: 1,
      snpCoverageVAO: null,
      snpCoverageCount: 0,
      noncovHistogramVAO: null,
      noncovHistogramCount: 0,
      noncovMaxCount: 0,
      indicatorVAO: null,
      indicatorCount: 0,
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
      modificationVAO: null,
      modificationCount: 0,
      modCoverageVAO: null,
      modCoverageCount: 0,
      arcVAO: null,
      arcCount: 0,
      arcLineVAO: null,
      arcLineCount: 0,
      cloudVAO: null,
      cloudCount: 0,
    }
  }

  /**
   * Upload arcs data from pre-computed typed arrays (from RPC worker)
   */
  uploadArcsFromTypedArrays(data: {
    regionStart: number
    arcX1: Float32Array
    arcX2: Float32Array
    arcColorTypes: Float32Array
    arcIsArc: Uint8Array
    numArcs: number
    linePositions: Uint32Array
    lineYs: Float32Array
    lineColorTypes: Float32Array
    numLines: number
  }) {
    const gl = this.gl
    this.ensureBuffers(data.regionStart)

    if (!this.buffers || !this.arcProgram || !this.arcLineProgram) {
      return
    }

    // Clean up old arcs VAOs
    if (this.buffers.arcVAO) {
      gl.deleteVertexArray(this.buffers.arcVAO)
      this.buffers.arcVAO = null
    }
    if (this.buffers.arcLineVAO) {
      gl.deleteVertexArray(this.buffers.arcLineVAO)
      this.buffers.arcLineVAO = null
    }
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    this.arcInstanceBuffers = []

    if (data.numArcs > 0) {
      const arcVAO = gl.createVertexArray()
      gl.bindVertexArray(arcVAO)

      const stride = 2 * 4 // 2 floats * 4 bytes

      // Per-vertex: template t values
      const tLoc = gl.getAttribLocation(this.arcProgram, 'a_t')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
      gl.enableVertexAttribArray(tLoc)
      gl.vertexAttribPointer(tLoc, 1, gl.FLOAT, false, stride, 0)

      // Per-vertex: side (-1 or +1)
      const sideLoc = gl.getAttribLocation(this.arcProgram, 'a_side')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.arcTemplateBuffer)
      gl.enableVertexAttribArray(sideLoc)
      gl.vertexAttribPointer(sideLoc, 1, gl.FLOAT, false, stride, 4)

      // Per-instance: a_x1
      const x1Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x1Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcX1, gl.STATIC_DRAW)
      const x1Loc = gl.getAttribLocation(this.arcProgram, 'a_x1')
      gl.enableVertexAttribArray(x1Loc)
      gl.vertexAttribPointer(x1Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x1Loc, 1)
      this.arcInstanceBuffers.push(x1Buf)

      // Per-instance: a_x2
      const x2Buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, x2Buf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcX2, gl.STATIC_DRAW)
      const x2Loc = gl.getAttribLocation(this.arcProgram, 'a_x2')
      gl.enableVertexAttribArray(x2Loc)
      gl.vertexAttribPointer(x2Loc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(x2Loc, 1)
      this.arcInstanceBuffers.push(x2Buf)

      // Per-instance: a_colorType
      const colorBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.arcColorTypes, gl.STATIC_DRAW)
      const colorLoc = gl.getAttribLocation(this.arcProgram, 'a_colorType')
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(colorLoc, 1)
      this.arcInstanceBuffers.push(colorBuf)

      // Per-instance: a_isArc (Uint8 → float)
      const isArcFloat = new Float32Array(data.arcIsArc.length)
      for (let i = 0; i < data.arcIsArc.length; i++) {
        isArcFloat[i] = data.arcIsArc[i]!
      }
      const isArcBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, isArcBuf)
      gl.bufferData(gl.ARRAY_BUFFER, isArcFloat, gl.STATIC_DRAW)
      const isArcLoc = gl.getAttribLocation(this.arcProgram, 'a_isArc')
      gl.enableVertexAttribArray(isArcLoc)
      gl.vertexAttribPointer(isArcLoc, 1, gl.FLOAT, false, 0, 0)
      gl.vertexAttribDivisor(isArcLoc, 1)
      this.arcInstanceBuffers.push(isArcBuf)

      gl.bindVertexArray(null)
      this.buffers.arcVAO = arcVAO
      this.buffers.arcCount = data.numArcs
    } else {
      this.buffers.arcCount = 0
    }

    // Lines for inter-chromosomal / long-range connections
    if (data.numLines > 0) {
      const arcLineVAO = gl.createVertexArray()
      gl.bindVertexArray(arcLineVAO)

      const posLoc = gl.getAttribLocation(this.arcLineProgram, 'a_position')
      const posBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.linePositions, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(posLoc)
      gl.vertexAttribIPointer(posLoc, 1, gl.UNSIGNED_INT, 0, 0)
      this.arcInstanceBuffers.push(posBuf)

      const yLoc = gl.getAttribLocation(this.arcLineProgram, 'a_y')
      const yBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, yBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineYs, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(yLoc)
      gl.vertexAttribPointer(yLoc, 1, gl.FLOAT, false, 0, 0)
      this.arcInstanceBuffers.push(yBuf)

      const colorLoc = gl.getAttribLocation(this.arcLineProgram, 'a_colorType')
      const colorBuf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf)
      gl.bufferData(gl.ARRAY_BUFFER, data.lineColorTypes, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 1, gl.FLOAT, false, 0, 0)
      this.arcInstanceBuffers.push(colorBuf)

      gl.bindVertexArray(null)
      this.buffers.arcLineVAO = arcLineVAO
      this.buffers.arcLineCount = data.numLines
    } else {
      this.buffers.arcLineCount = 0
    }
  }

  /**
   * Upload cloud data from pre-computed typed arrays (from RPC worker)
   */
  uploadCloudFromTypedArrays(data: {
    regionStart: number
    chainPositions: Uint32Array
    chainYs: Float32Array
    chainFlags: Uint16Array
    chainColorTypes: Uint8Array
    numChains: number
  }) {
    const gl = this.gl
    this.ensureBuffers(data.regionStart)

    if (!this.buffers || !this.cloudProgram) {
      return
    }

    // Clean up old cloud VAO
    if (this.buffers.cloudVAO) {
      gl.deleteVertexArray(this.buffers.cloudVAO)
      this.buffers.cloudVAO = null
    }
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    this.cloudGLBuffers = []

    if (data.numChains === 0) {
      this.buffers.cloudCount = 0
      return
    }

    const cloudVAO = gl.createVertexArray()
    gl.bindVertexArray(cloudVAO)

    this.uploadCloudBuffer(
      this.cloudProgram,
      'a_position',
      data.chainPositions,
      2,
      true,
    )
    this.uploadCloudBuffer(this.cloudProgram, 'a_y', data.chainYs, 1, false)
    this.uploadCloudBuffer(
      this.cloudProgram,
      'a_flags',
      new Float32Array(data.chainFlags),
      1,
      false,
    )
    this.uploadCloudBuffer(
      this.cloudProgram,
      'a_colorType',
      new Float32Array(data.chainColorTypes),
      1,
      false,
    )

    gl.bindVertexArray(null)
    this.buffers.cloudVAO = cloudVAO
    this.buffers.cloudCount = data.numChains
  }

  private uploadCloudBuffer(
    program: WebGLProgram,
    attrib: string,
    data: Uint32Array | Float32Array,
    size: number,
    isUint: boolean,
  ) {
    const gl = this.gl
    const loc = gl.getAttribLocation(program, attrib)
    if (loc < 0) {
      return
    }
    const buffer = gl.createBuffer()
    this.cloudGLBuffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    if (isUint) {
      gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, 0, 0)
    } else {
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    }
    gl.vertexAttribDivisor(loc, 1)
  }

  render(state: RenderState) {
    const gl = this.gl
    const canvas = this.canvas

    // Use passed-in dimensions to avoid forced layout from reading clientWidth/clientHeight
    const { canvasWidth, canvasHeight } = state

    // Handle resize - only update canvas buffer size if dimensions changed
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.buffers) {
      return
    }

    // Common preamble for all rendering modes
    const regionStart = this.buffers.regionStart
    const domainOffset: [number, number] = [
      state.domainX[0] - regionStart,
      state.domainX[1] - regionStart,
    ]
    const colors = { ...defaultColorPalette, ...state.colors }

    // Draw coverage first (at top) — shared across all modes
    this.renderCoverage(state, domainOffset, colors)

    const mode = state.renderingMode ?? 'pileup'

    // Dispatch to mode-specific rendering
    if (mode === 'arcs') {
      this.renderArcs(state)
    } else if (mode === 'cloud') {
      this.renderCloud(state)
    } else {
      this.renderPileup(state, domainOffset, colors)
    }
  }

  private renderPileup(
    state: RenderState,
    domainOffset: [number, number],
    colors: ColorPalette,
  ) {
    const gl = this.gl
    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const regionStart = this.buffers.regionStart

    // Compute high-precision split domain for reads (12-bit split approach).
    // Uses splitPositionWithFrac to preserve fractional scroll position - without this,
    // reads would "stick" at integer bp positions and snap when crossing boundaries.
    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    // Draw reads
    const coverageOffset = state.showCoverage ? state.coverageHeight : 0

    // Enable scissor test to clip pileup to area below coverage
    gl.enable(gl.SCISSOR_TEST)
    gl.scissor(0, 0, canvasWidth, canvasHeight - coverageOffset)

    gl.useProgram(this.readProgram)
    // Use high-precision split domain for reads (vec3: hi, lo, extent)
    gl.uniform3f(
      this.readUniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    // Pass regionStart so shader can convert offsets to absolute positions (must be integer)
    gl.uniform1ui(this.readUniforms.u_regionStart!, Math.floor(regionStart))
    gl.uniform2f(this.readUniforms.u_rangeY!, state.rangeY[0], state.rangeY[1])
    gl.uniform1i(this.readUniforms.u_colorScheme!, state.colorScheme)
    gl.uniform1f(this.readUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.readUniforms.u_featureSpacing!, state.featureSpacing)
    gl.uniform1f(this.readUniforms.u_coverageOffset!, coverageOffset)
    gl.uniform1f(this.readUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.readUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform1i(
      this.readUniforms.u_highlightedIndex!,
      state.highlightedFeatureIndex,
    )

    // Set color uniforms for read shapes
    gl.uniform3f(this.readUniforms.u_colorFwdStrand!, ...colors.colorFwdStrand)
    gl.uniform3f(this.readUniforms.u_colorRevStrand!, ...colors.colorRevStrand)
    gl.uniform3f(this.readUniforms.u_colorNostrand!, ...colors.colorNostrand)
    gl.uniform3f(this.readUniforms.u_colorPairLR!, ...colors.colorPairLR)
    gl.uniform3f(this.readUniforms.u_colorPairRL!, ...colors.colorPairRL)
    gl.uniform3f(this.readUniforms.u_colorPairRR!, ...colors.colorPairRR)
    gl.uniform3f(this.readUniforms.u_colorPairLL!, ...colors.colorPairLL)
    gl.uniform3f(
      this.readUniforms.u_colorModificationFwd!,
      ...colors.colorModificationFwd,
    )
    gl.uniform3f(
      this.readUniforms.u_colorModificationRev!,
      ...colors.colorModificationRev,
    )

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 9, this.buffers.readCount)

    // Draw CIGAR features if enabled (suppress when showing modifications overlay)
    if (state.showMismatches && !state.showModifications) {
      // Draw gaps (deletions)
      if (this.buffers.gapVAO && this.buffers.gapCount > 0) {
        gl.useProgram(this.gapProgram)
        gl.uniform2f(
          this.gapUniforms.u_domainX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.gapUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(this.gapUniforms.u_featureHeight!, state.featureHeight)
        gl.uniform1f(this.gapUniforms.u_featureSpacing!, state.featureSpacing)
        gl.uniform1f(this.gapUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.gapUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform3f(
          this.gapUniforms.u_colorDeletion!,
          colors.colorDeletion[0],
          colors.colorDeletion[1],
          colors.colorDeletion[2],
        )
        gl.uniform3f(
          this.gapUniforms.u_colorSkip!,
          colors.colorSkip[0],
          colors.colorSkip[1],
          colors.colorSkip[2],
        )

        gl.bindVertexArray(this.buffers.gapVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.gapCount)
      }

      // Draw mismatches
      if (this.buffers.mismatchVAO && this.buffers.mismatchCount > 0) {
        gl.useProgram(this.mismatchProgram)
        gl.uniform2f(
          this.mismatchUniforms.u_domainX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.mismatchUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.mismatchUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.mismatchUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.mismatchUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.mismatchUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.mismatchUniforms.u_canvasWidth!, canvasWidth)
        // Base color uniforms from theme
        gl.uniform3f(this.mismatchUniforms.u_colorBaseA!, ...colors.colorBaseA)
        gl.uniform3f(this.mismatchUniforms.u_colorBaseC!, ...colors.colorBaseC)
        gl.uniform3f(this.mismatchUniforms.u_colorBaseG!, ...colors.colorBaseG)
        gl.uniform3f(this.mismatchUniforms.u_colorBaseT!, ...colors.colorBaseT)

        gl.bindVertexArray(this.buffers.mismatchVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.mismatchCount)
      }

      // Draw insertions
      // Each insertion is 3 rectangles (bar + 2 ticks) = 18 vertices
      if (this.buffers.insertionVAO && this.buffers.insertionCount > 0) {
        gl.useProgram(this.insertionProgram)
        gl.uniform2f(
          this.insertionUniforms.u_domainX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.insertionUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.insertionUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.insertionUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.insertionUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.insertionUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.insertionUniforms.u_canvasWidth!, canvasWidth)
        // Insertion color uniform from theme
        gl.uniform3f(
          this.insertionUniforms.u_colorInsertion!,
          ...colors.colorInsertion,
        )

        gl.bindVertexArray(this.buffers.insertionVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, this.buffers.insertionCount)
      }

      // Draw soft clips
      if (this.buffers.softclipVAO && this.buffers.softclipCount > 0) {
        gl.useProgram(this.softclipProgram)
        gl.uniform2f(
          this.softclipUniforms.u_domainX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.softclipUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.softclipUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.softclipUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.softclipUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.softclipUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.softclipUniforms.u_canvasWidth!, canvasWidth)
        // Softclip color uniform from theme
        gl.uniform3f(
          this.softclipUniforms.u_colorSoftclip!,
          ...colors.colorSoftclip,
        )

        gl.bindVertexArray(this.buffers.softclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.softclipCount)
      }

      // Draw hard clips
      if (this.buffers.hardclipVAO && this.buffers.hardclipCount > 0) {
        gl.useProgram(this.hardclipProgram)
        gl.uniform2f(
          this.hardclipUniforms.u_domainX!,
          domainOffset[0],
          domainOffset[1],
        )
        gl.uniform2f(
          this.hardclipUniforms.u_rangeY!,
          state.rangeY[0],
          state.rangeY[1],
        )
        gl.uniform1f(
          this.hardclipUniforms.u_featureHeight!,
          state.featureHeight,
        )
        gl.uniform1f(
          this.hardclipUniforms.u_featureSpacing!,
          state.featureSpacing,
        )
        gl.uniform1f(this.hardclipUniforms.u_coverageOffset!, coverageOffset)
        gl.uniform1f(this.hardclipUniforms.u_canvasHeight!, canvasHeight)
        gl.uniform1f(this.hardclipUniforms.u_canvasWidth!, canvasWidth)
        // Hardclip color uniform from theme
        gl.uniform3f(
          this.hardclipUniforms.u_colorHardclip!,
          ...colors.colorHardclip,
        )

        gl.bindVertexArray(this.buffers.hardclipVAO)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.hardclipCount)
      }
    }

    // Draw modifications (on top of reads and mismatches)
    if (
      state.showModifications &&
      this.buffers.modificationVAO &&
      this.buffers.modificationCount > 0
    ) {
      gl.useProgram(this.modificationProgram)
      gl.uniform2f(
        this.modificationUniforms.u_domainX!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform2f(
        this.modificationUniforms.u_rangeY!,
        state.rangeY[0],
        state.rangeY[1],
      )
      gl.uniform1f(
        this.modificationUniforms.u_featureHeight!,
        state.featureHeight,
      )
      gl.uniform1f(
        this.modificationUniforms.u_featureSpacing!,
        state.featureSpacing,
      )
      gl.uniform1f(this.modificationUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.modificationUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.modificationUniforms.u_canvasWidth!, canvasWidth)

      gl.bindVertexArray(this.buffers.modificationVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.modificationCount)
    }

    gl.disable(gl.SCISSOR_TEST)

    // Draw selection outline if a feature is selected
    if (
      state.selectedFeatureIndex >= 0 &&
      state.selectedFeatureIndex < this.buffers.readCount
    ) {
      const idx = state.selectedFeatureIndex
      const startOffset = this.buffers.readPositions[idx * 2]
      const endOffset = this.buffers.readPositions[idx * 2 + 1]
      const y = this.buffers.readYs[idx]

      if (
        startOffset !== undefined &&
        endOffset !== undefined &&
        y !== undefined
      ) {
        // Convert to absolute positions
        const absStart = startOffset + regionStart
        const absEnd = endOffset + regionStart

        // Convert to clip-space X using high-precision split
        const splitStart = [
          Math.floor(absStart) - (Math.floor(absStart) & 0xfff),
          Math.floor(absStart) & 0xfff,
        ]
        const splitEnd = [
          Math.floor(absEnd) - (Math.floor(absEnd) & 0xfff),
          Math.floor(absEnd) & 0xfff,
        ]

        const sx1 =
          ((splitStart[0]! - domainStartHi + splitStart[1]! - domainStartLo) /
            domainExtent) *
            2 -
          1
        const sx2 =
          ((splitEnd[0]! - domainStartHi + splitEnd[1]! - domainStartLo) /
            domainExtent) *
            2 -
          1

        // Convert Y to clip-space
        const rowHeight = state.featureHeight + state.featureSpacing
        const yTopPx = y * rowHeight - state.rangeY[0]
        const yBotPx = yTopPx + state.featureHeight
        const pileupTop = 1 - (coverageOffset / canvasHeight) * 2
        const pxToClip = 2 / canvasHeight
        const syTop = pileupTop - yTopPx * pxToClip
        const syBot = pileupTop - yBotPx * pxToClip

        // Draw outline (chevron shape when zoomed in, rectangle otherwise)
        gl.useProgram(this.lineProgram)
        gl.uniform4f(this.lineUniforms.u_color!, 0, 0, 0, 1) // Black outline

        const bpPerPx = domainExtent / canvasWidth
        const strand = this.buffers.readStrands[idx]
        const showChevron = bpPerPx < 10 && state.featureHeight > 5
        const chevronClip = (5 / canvasWidth) * 2
        const syMid = (syTop + syBot) / 2

        let outlineData: Float32Array
        if (showChevron && strand === 1) {
          // Forward: chevron on right
          outlineData = new Float32Array([
            sx1,
            syTop,
            sx2,
            syTop,
            sx2 + chevronClip,
            syMid,
            sx2,
            syBot,
            sx1,
            syBot,
            sx1,
            syTop,
          ])
        } else if (showChevron && strand === -1) {
          // Reverse: chevron on left
          outlineData = new Float32Array([
            sx1,
            syTop,
            sx2,
            syTop,
            sx2,
            syBot,
            sx1,
            syBot,
            sx1 - chevronClip,
            syMid,
            sx1,
            syTop,
          ])
        } else {
          outlineData = new Float32Array([
            sx1,
            syTop,
            sx2,
            syTop,
            sx2,
            syBot,
            sx1,
            syBot,
            sx1,
            syTop,
          ])
        }

        gl.bindVertexArray(this.lineVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, outlineData, gl.DYNAMIC_DRAW)
        gl.drawArrays(gl.LINE_STRIP, 0, outlineData.length / 2)
      }
    }

    gl.bindVertexArray(null)
  }

  private renderCoverage(
    state: RenderState,
    domainOffset: [number, number],
    colors: ColorPalette,
  ) {
    const gl = this.gl
    if (!this.buffers) {
      return
    }
    const { canvasWidth, canvasHeight } = state

    const willDrawCoverage =
      state.showCoverage &&
      this.buffers.coverageVAO &&
      this.buffers.coverageCount > 0
    if (!willDrawCoverage) {
      return
    }

    // Draw grey coverage bars - coverage uses offset-based positions
    gl.useProgram(this.coverageProgram)
    gl.uniform2f(
      this.coverageUniforms.u_visibleRange!,
      domainOffset[0],
      domainOffset[1],
    )
    gl.uniform1f(this.coverageUniforms.u_coverageHeight!, state.coverageHeight)
    gl.uniform1f(
      this.coverageUniforms.u_coverageYOffset!,
      state.coverageYOffset,
    )
    gl.uniform1f(this.coverageUniforms.u_binSize!, this.buffers.binSize)
    gl.uniform1f(this.coverageUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(this.coverageUniforms.u_canvasWidth!, canvasWidth)
    gl.uniform3f(
      this.coverageUniforms.u_colorCoverage!,
      ...colors.colorCoverage,
    )

    gl.bindVertexArray(this.buffers.coverageVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.coverageCount)

    // Draw modification coverage bars OR SNP coverage bars (not both)
    if (
      state.showModifications &&
      this.buffers.modCoverageVAO &&
      this.buffers.modCoverageCount > 0
    ) {
      gl.useProgram(this.modCoverageProgram)
      gl.uniform2f(
        this.modCoverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.modCoverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.modCoverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(this.modCoverageUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.modCoverageUniforms.u_canvasWidth!, canvasWidth)

      gl.bindVertexArray(this.buffers.modCoverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.modCoverageCount)
    } else if (
      this.buffers.snpCoverageVAO &&
      this.buffers.snpCoverageCount > 0
    ) {
      gl.useProgram(this.snpCoverageProgram)
      gl.uniform2f(
        this.snpCoverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.snpCoverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.snpCoverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(this.snpCoverageUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.snpCoverageUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseA!, ...colors.colorBaseA)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseC!, ...colors.colorBaseC)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseG!, ...colors.colorBaseG)
      gl.uniform3f(this.snpCoverageUniforms.u_colorBaseT!, ...colors.colorBaseT)

      gl.bindVertexArray(this.buffers.snpCoverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.snpCoverageCount)
    }

    // Draw noncov (interbase) histogram - bars growing DOWN from top
    // Height is 1/4 of coverage height to keep it compact
    const noncovHeight = state.coverageHeight / 4
    if (
      state.showInterbaseCounts &&
      this.buffers.noncovHistogramVAO &&
      this.buffers.noncovHistogramCount > 0
    ) {
      gl.useProgram(this.noncovHistogramProgram)
      gl.uniform2f(
        this.noncovHistogramUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(this.noncovHistogramUniforms.u_noncovHeight!, noncovHeight)
      gl.uniform1f(this.noncovHistogramUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.noncovHistogramUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(
        this.noncovHistogramUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )
      gl.uniform3f(
        this.noncovHistogramUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )
      gl.uniform3f(
        this.noncovHistogramUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(this.buffers.noncovHistogramVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLES,
        0,
        6,
        this.buffers.noncovHistogramCount,
      )
    }

    // Draw interbase indicators - triangles at top of coverage area
    if (
      state.showInterbaseIndicators &&
      this.buffers.indicatorVAO &&
      this.buffers.indicatorCount > 0
    ) {
      gl.useProgram(this.indicatorProgram)
      gl.uniform2f(
        this.indicatorUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(this.indicatorUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.indicatorUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform3f(
        this.indicatorUniforms.u_colorInsertion!,
        ...colors.colorInsertion,
      )
      gl.uniform3f(
        this.indicatorUniforms.u_colorSoftclip!,
        ...colors.colorSoftclip,
      )
      gl.uniform3f(
        this.indicatorUniforms.u_colorHardclip!,
        ...colors.colorHardclip,
      )

      gl.bindVertexArray(this.buffers.indicatorVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.buffers.indicatorCount)
    }

    // Draw separator line at bottom of coverage area
    const lineY = 1 - (state.coverageHeight / canvasHeight) * 2
    gl.useProgram(this.lineProgram)
    gl.uniform4f(this.lineUniforms.u_color!, 0.7, 0.7, 0.7, 1)

    const lineData = new Float32Array([-1, lineY, 1, lineY])
    gl.bindVertexArray(this.lineVAO)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, lineData, gl.DYNAMIC_DRAW)
    gl.drawArrays(gl.LINES, 0, 2)
  }

  private renderArcs(state: RenderState) {
    const gl = this.gl
    if (!this.buffers || !this.arcProgram || !this.arcLineProgram) {
      return
    }

    const { canvasWidth, canvasHeight } = state
    const lineWidth = state.arcLineWidth ?? 1

    // Draw arcs using instanced triangle strip rendering
    if (this.buffers.arcVAO && this.buffers.arcCount > 0) {
      gl.useProgram(this.arcProgram)

      const domainStartOffset = state.domainX[0] - this.buffers.regionStart
      const domainExtent = state.domainX[1] - state.domainX[0]

      const coverageOffset = state.showCoverage ? state.coverageHeight : 0
      gl.uniform1f(this.arcUniforms.u_domainStartOffset!, domainStartOffset)
      gl.uniform1f(this.arcUniforms.u_domainExtent!, domainExtent)
      gl.uniform1f(this.arcUniforms.u_canvasWidth!, canvasWidth)
      gl.uniform1f(this.arcUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.arcUniforms.u_coverageOffset!, coverageOffset)
      gl.uniform1f(this.arcUniforms.u_lineWidthPx!, lineWidth)
      gl.uniform1f(this.arcUniforms.u_gradientHue!, 0)

      for (let i = 0; i < NUM_ARC_COLORS; i++) {
        const c = arcColorPalette[i]!
        gl.uniform3f(this.arcUniforms[`u_arcColors[${i}]`]!, c[0], c[1], c[2])
      }

      gl.bindVertexArray(this.buffers.arcVAO)
      gl.drawArraysInstanced(
        gl.TRIANGLE_STRIP,
        0,
        (ARC_CURVE_SEGMENTS + 1) * 2,
        this.buffers.arcCount,
      )
    }

    // Draw vertical lines for inter-chromosomal / long-range
    if (this.buffers.arcLineVAO && this.buffers.arcLineCount > 0) {
      gl.useProgram(this.arcLineProgram)

      const [domainStartHi, domainStartLo] = splitPositionWithFrac(
        state.domainX[0],
      )
      const domainExtent = state.domainX[1] - state.domainX[0]

      gl.uniform3f(
        this.arcLineUniforms.u_domainX!,
        domainStartHi,
        domainStartLo,
        domainExtent,
      )
      gl.uniform1ui(
        this.arcLineUniforms.u_regionStart!,
        Math.floor(this.buffers.regionStart),
      )
      gl.uniform1f(this.arcLineUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(
        this.arcLineUniforms.u_coverageOffset!,
        state.showCoverage ? state.coverageHeight : 0,
      )

      for (let i = 0; i < NUM_LINE_COLORS; i++) {
        const c = arcLineColorPalette[i]!
        gl.uniform3f(
          this.arcLineUniforms[`u_arcLineColors[${i}]`]!,
          c[0],
          c[1],
          c[2],
        )
      }

      gl.lineWidth(lineWidth)
      gl.bindVertexArray(this.buffers.arcLineVAO)
      gl.drawArrays(gl.LINES, 0, this.buffers.arcLineCount * 2)
    }

    gl.bindVertexArray(null)
  }

  private renderCloud(state: RenderState) {
    const gl = this.gl
    if (!this.buffers || !this.cloudProgram) {
      return
    }

    if (!this.buffers.cloudVAO || this.buffers.cloudCount === 0) {
      return
    }

    const { canvasHeight } = state

    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    gl.useProgram(this.cloudProgram)
    gl.uniform3f(
      this.cloudUniforms.u_domainX!,
      domainStartHi,
      domainStartLo,
      domainExtent,
    )
    gl.uniform1ui(
      this.cloudUniforms.u_regionStart!,
      Math.floor(this.buffers.regionStart),
    )
    gl.uniform1f(this.cloudUniforms.u_featureHeight!, state.featureHeight)
    gl.uniform1f(this.cloudUniforms.u_canvasHeight!, canvasHeight)
    gl.uniform1f(
      this.cloudUniforms.u_coverageOffset!,
      state.showCoverage ? state.coverageHeight : 0,
    )
    gl.uniform1i(this.cloudUniforms.u_colorScheme!, state.cloudColorScheme ?? 0)

    gl.bindVertexArray(this.buffers.cloudVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.cloudCount)
    gl.bindVertexArray(null)
  }

  destroy() {
    const gl = this.gl
    for (const buf of this.glBuffers) {
      gl.deleteBuffer(buf)
    }
    this.glBuffers = []
    if (this.buffers) {
      gl.deleteVertexArray(this.buffers.readVAO)
      if (this.buffers.coverageVAO) {
        gl.deleteVertexArray(this.buffers.coverageVAO)
      }
      if (this.buffers.snpCoverageVAO) {
        gl.deleteVertexArray(this.buffers.snpCoverageVAO)
      }
      if (this.buffers.noncovHistogramVAO) {
        gl.deleteVertexArray(this.buffers.noncovHistogramVAO)
      }
      if (this.buffers.indicatorVAO) {
        gl.deleteVertexArray(this.buffers.indicatorVAO)
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
      if (this.buffers.modificationVAO) {
        gl.deleteVertexArray(this.buffers.modificationVAO)
      }
      if (this.buffers.modCoverageVAO) {
        gl.deleteVertexArray(this.buffers.modCoverageVAO)
      }
      if (this.buffers.arcVAO) {
        gl.deleteVertexArray(this.buffers.arcVAO)
      }
      if (this.buffers.arcLineVAO) {
        gl.deleteVertexArray(this.buffers.arcLineVAO)
      }
      if (this.buffers.cloudVAO) {
        gl.deleteVertexArray(this.buffers.cloudVAO)
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
    gl.deleteProgram(this.noncovHistogramProgram)
    gl.deleteProgram(this.indicatorProgram)
    gl.deleteProgram(this.lineProgram)
    gl.deleteProgram(this.gapProgram)
    gl.deleteProgram(this.mismatchProgram)
    gl.deleteProgram(this.insertionProgram)
    gl.deleteProgram(this.softclipProgram)
    gl.deleteProgram(this.hardclipProgram)
    gl.deleteProgram(this.modificationProgram)
    gl.deleteProgram(this.modCoverageProgram)
    // Arcs cleanup
    for (const buf of this.arcInstanceBuffers) {
      gl.deleteBuffer(buf)
    }
    if (this.arcTemplateBuffer) {
      gl.deleteBuffer(this.arcTemplateBuffer)
    }
    if (this.arcProgram) {
      gl.deleteProgram(this.arcProgram)
    }
    if (this.arcLineProgram) {
      gl.deleteProgram(this.arcLineProgram)
    }
    // Cloud cleanup
    for (const buf of this.cloudGLBuffers) {
      gl.deleteBuffer(buf)
    }
    if (this.cloudProgram) {
      gl.deleteProgram(this.cloudProgram)
    }
  }
}
