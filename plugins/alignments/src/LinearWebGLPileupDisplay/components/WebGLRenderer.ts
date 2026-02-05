/**
 * WebGL Renderer for pileup display
 *
 * Handles shader compilation, buffer management, and rendering.
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

uniform vec3 u_domainX;  // [domainStartHi, domainStartLo, domainExtent]
uniform uint u_regionStart;  // Base position for converting offsets to absolute
uniform vec2 u_rangeY;
uniform int u_colorScheme;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform int u_highlightedIndex;  // Feature index to highlight (-1 = none)

// Color uniforms - these match shared/color.ts and theme colors
uniform vec3 u_colorFwdStrand;    // #EC8B8B
uniform vec3 u_colorRevStrand;    // #8F8FD8
uniform vec3 u_colorNostrand;     // #c8c8c8 (lightgrey)
uniform vec3 u_colorPairLR;       // lightgrey
uniform vec3 u_colorPairRL;       // teal
uniform vec3 u_colorPairRR;       // #3a3a9d (dark blue)
uniform vec3 u_colorPairLL;       // green

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

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  // Convert offsets to absolute positions, then apply high-precision 12-bit split
  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_domainX);
  float sx2 = hpToClipX(splitEnd, u_domainX);
  float sx = mix(sx1, sx2, localX);

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
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);

  vec3 color;
  if (u_colorScheme == 0) color = normalColor();
  else if (u_colorScheme == 1) color = strandColor(a_strand);
  else if (u_colorScheme == 2) color = mapqColor(a_mapq);
  else if (u_colorScheme == 3) color = insertSizeColor(a_insertSize);
  else if (u_colorScheme == 4) color = firstOfPairColor(a_flags, a_strand);
  else if (u_colorScheme == 5) color = pairOrientationColor(a_pairOrientation);
  else if (u_colorScheme == 6) color = insertSizeAndOrientationColor(a_insertSize, a_pairOrientation);
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
// Position is computed from binIndex * binSize (offset-based from regionStart)
const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

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

  // Compute bin position as offset (binIndex * binSize)
  float binOffset = float(gl_InstanceID) * u_binSize;
  float domainWidth = u_visibleRange.y - u_visibleRange.x;

  float x1 = (binOffset - u_visibleRange.x) / domainWidth * 2.0 - 1.0;
  float x2 = (binOffset + u_binSize - u_visibleRange.x) / domainWidth * 2.0 - 1.0;

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

  // Y: bars grow DOWNWARD from top of canvas
  // Top of canvas is y=1.0 in clip space
  // segmentTop is at the top (y=1.0 - offset)
  // segmentBot is below (y=1.0 - offset - height)
  float segmentTop = 1.0 - (a_yOffset * u_noncovHeight / u_canvasHeight) * 2.0;
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
in uint a_base;       // 0=A, 1=C, 2=G, 3=T

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

  // Base colors from theme uniforms
  vec3 baseColors[4] = vec3[4](u_colorBaseA, u_colorBaseC, u_colorBaseG, u_colorBaseT);
  v_color = vec4(baseColors[a_base], 1.0);
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
// For large insertions (>=10bp): renders wider rectangle to contain text label
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

  // Determine if this is a large insertion (>=10bp) that should show text
  bool isLargeInsertion = a_length >= 10u && pxPerBp >= 0.1;

  // Calculate rectangle width in pixels
  float rectWidthPx;
  if (isLargeInsertion) {
    // Wide rectangle to contain text label
    rectWidthPx = textWidthForNumber(a_length);
  } else {
    // Thin 1px bar
    rectWidthPx = 1.0;
  }

  // Convert pixel width to clip space
  float onePixelClip = 2.0 / u_canvasWidth;
  float rectWidthClip = isLargeInsertion ? rectWidthPx * 2.0 / u_canvasWidth : onePixelClip;
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
    // Top tick (hide for large insertions, show when zoomed in enough for small)
    if (isLargeInsertion || pxPerBp < 0.5) {
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
    // Bottom tick (hide for large insertions, show when zoomed in enough for small)
    if (isLargeInsertion || pxPerBp < 0.5) {
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
}

// Default colors matching shared/color.ts fillColor values and theme
export const defaultColorPalette: ColorPalette = {
  // Read colors
  colorFwdStrand: [0.925, 0.545, 0.545], // #EC8B8B
  colorRevStrand: [0.561, 0.561, 0.847], // #8F8FD8
  colorNostrand: [0.784, 0.784, 0.784], // #c8c8c8
  colorPairLR: [0.827, 0.827, 0.827], // lightgrey (#d3d3d3)
  colorPairRL: [0.0, 0.502, 0.502], // teal
  colorPairRR: [0.227, 0.227, 0.616], // #3a3a9d
  colorPairLL: [0.0, 0.502, 0.0], // green
  // Base colors (MUI theme)
  colorBaseA: [0.298, 0.686, 0.314], // green (#4caf50)
  colorBaseC: [0.129, 0.588, 0.953], // blue (#2196f3)
  colorBaseG: [1.0, 0.596, 0.0], // orange (#ff9800)
  colorBaseT: [0.957, 0.263, 0.212], // red (#f44336)
  // Indel/clip colors (theme)
  colorInsertion: [0.502, 0.0, 0.502], // purple (#800080)
  colorDeletion: [0.502, 0.502, 0.502], // grey (#808080)
  colorSkip: [0.592, 0.722, 0.788], // teal/blue (#97b8c9)
  colorSoftclip: [0.0, 0.0, 1.0], // blue (#00f)
  colorHardclip: [1.0, 0.0, 0.0], // red (#f00)
  // Coverage color
  colorCoverage: [0.8, 0.8, 0.8], // light grey (#cccccc)
}

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
  // Canvas dimensions - passed in to avoid forced layout from reading clientWidth/clientHeight
  canvasWidth: number
  canvasHeight: number
  // Feature highlighting (-1 means no highlight)
  highlightedFeatureIndex: number
  // Selected feature for outline (-1 means no selection)
  selectedFeatureIndex: number
  // Optional color palette - uses defaultColorPalette if not provided
  colors?: Partial<ColorPalette>
}

interface GPUBuffers {
  // Reference point for all position offsets
  regionStart: number
  readVAO: WebGLVertexArrayObject
  readCount: number
  // CPU-side copies for selection outline drawing
  readPositions: Uint32Array
  readYs: Uint16Array
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

  private buffers: GPUBuffers | null = null
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
      // Color uniforms
      'u_colorFwdStrand',
      'u_colorRevStrand',
      'u_colorNostrand',
      'u_colorPairLR',
      'u_colorPairRL',
      'u_colorPairRR',
      'u_colorPairLL',
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
    const program = gl.createProgram()
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
    }

    if (data.numReads === 0) {
      this.buffers = null
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
    gl.bindVertexArray(null)

    this.buffers = {
      regionStart: data.regionStart,
      readVAO,
      readCount: data.numReads,
      readPositions: data.readPositions,
      readYs: data.readYs,
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
   * Position is computed in shader from index * binSize (offset-based)
   */
  uploadCoverageFromTypedArrays(data: {
    coverageDepths: Float32Array
    coverageMaxDepth: number
    coverageBinSize: number
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

    // Upload grey coverage bars (position computed from gl_InstanceID in shader)
    if (data.numCoverageBins > 0) {
      // Normalize depths
      const normalizedDepths = new Float32Array(data.coverageDepths.length)
      for (let i = 0; i < data.coverageDepths.length; i++) {
        normalizedDepths[i] =
          (data.coverageDepths[i] ?? 0) / data.coverageMaxDepth
      }

      const coverageVAO = gl.createVertexArray()
      gl.bindVertexArray(coverageVAO)
      // No position buffer needed - computed in shader from gl_InstanceID
      this.uploadBuffer(this.coverageProgram, 'a_depth', normalizedDepths, 1)
      gl.bindVertexArray(null)

      this.buffers.coverageVAO = coverageVAO
      this.buffers.coverageCount = data.numCoverageBins
      this.buffers.maxDepth = data.coverageMaxDepth
      this.buffers.binSize = data.coverageBinSize
      // regionStart is already set from uploadFromTypedArrays
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
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_SHORT, 0, 0)
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
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_BYTE, 0, 0)
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

    if (!this.buffers || this.buffers.readCount === 0) {
      return
    }

    // Convert domainX to offsets from regionStart for CIGAR features (simple float precision)
    const regionStart = this.buffers.regionStart
    const domainOffset: [number, number] = [
      state.domainX[0] - regionStart,
      state.domainX[1] - regionStart,
    ]

    // Get color palette - used by multiple shaders
    const colors = { ...defaultColorPalette, ...state.colors }

    // Compute high-precision split domain for reads (12-bit split approach).
    // Uses splitPositionWithFrac to preserve fractional scroll position - without this,
    // reads would "stick" at integer bp positions and snap when crossing boundaries.
    const [domainStartHi, domainStartLo] = splitPositionWithFrac(
      state.domainX[0],
    )
    const domainExtent = state.domainX[1] - state.domainX[0]

    // Draw coverage first (at top)
    const willDrawCoverage =
      state.showCoverage &&
      this.buffers.coverageVAO &&
      this.buffers.coverageCount > 0
    if (willDrawCoverage) {
      // Draw grey coverage bars - coverage uses offset-based positions
      gl.useProgram(this.coverageProgram)
      gl.uniform2f(
        this.coverageUniforms.u_visibleRange!,
        domainOffset[0],
        domainOffset[1],
      )
      gl.uniform1f(
        this.coverageUniforms.u_coverageHeight!,
        state.coverageHeight,
      )
      gl.uniform1f(
        this.coverageUniforms.u_coverageYOffset!,
        state.coverageYOffset,
      )
      gl.uniform1f(this.coverageUniforms.u_binSize!, this.buffers.binSize)
      gl.uniform1f(this.coverageUniforms.u_canvasHeight!, canvasHeight)
      gl.uniform1f(this.coverageUniforms.u_canvasWidth!, canvasWidth)
      // Coverage color uniform from theme
      gl.uniform3f(
        this.coverageUniforms.u_colorCoverage!,
        ...colors.colorCoverage,
      )

      gl.bindVertexArray(this.buffers.coverageVAO)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.coverageCount)

      // Draw SNP coverage on top (at exact 1bp positions, now as offsets)
      if (this.buffers.snpCoverageVAO && this.buffers.snpCoverageCount > 0) {
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
        // Base color uniforms from theme
        gl.uniform3f(
          this.snpCoverageUniforms.u_colorBaseA!,
          ...colors.colorBaseA,
        )
        gl.uniform3f(
          this.snpCoverageUniforms.u_colorBaseC!,
          ...colors.colorBaseC,
        )
        gl.uniform3f(
          this.snpCoverageUniforms.u_colorBaseG!,
          ...colors.colorBaseG,
        )
        gl.uniform3f(
          this.snpCoverageUniforms.u_colorBaseT!,
          ...colors.colorBaseT,
        )

        gl.bindVertexArray(this.buffers.snpCoverageVAO)
        gl.drawArraysInstanced(
          gl.TRIANGLES,
          0,
          6,
          this.buffers.snpCoverageCount,
        )
      }

      // Draw noncov (interbase) histogram - bars growing DOWN from top
      // Height is proportional to half the coverage height (like the original renderer)
      const noncovHeight = state.coverageHeight / 2
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
        // Indel/clip color uniforms from theme
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

      // Draw interbase indicators - triangles at significant positions
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
        // Indel/clip color uniforms from theme
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

    gl.bindVertexArray(this.buffers.readVAO)
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.buffers.readCount)

    // Draw CIGAR features if enabled
    if (state.showMismatches) {
      const bpPerPx = (state.domainX[1] - state.domainX[0]) / canvasWidth

      // Draw gaps (deletions) - always visible
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

      // Draw mismatches - only when zoomed in enough (< 50 bp/px)
      if (
        this.buffers.mismatchVAO &&
        this.buffers.mismatchCount > 0 &&
        bpPerPx < 50
      ) {
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

      // Draw insertions - only when zoomed in enough (< 100 bp/px)
      // Each insertion is 3 rectangles (bar + 2 ticks) = 18 vertices
      if (
        this.buffers.insertionVAO &&
        this.buffers.insertionCount > 0 &&
        bpPerPx < 100
      ) {
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

      // Draw soft clips - only when zoomed in enough (< 100 bp/px)
      if (
        this.buffers.softclipVAO &&
        this.buffers.softclipCount > 0 &&
        bpPerPx < 100
      ) {
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

      // Draw hard clips - only when zoomed in enough (< 100 bp/px)
      if (
        this.buffers.hardclipVAO &&
        this.buffers.hardclipCount > 0 &&
        bpPerPx < 100
      ) {
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

        // Draw rectangle outline
        gl.useProgram(this.lineProgram)
        gl.uniform4f(this.lineUniforms.u_color!, 0, 0, 0, 1) // Black outline

        const outlineData = new Float32Array([
          sx1,
          syTop,
          sx2,
          syTop,
          sx2,
          syBot,
          sx1,
          syBot,
          sx1,
          syTop, // Close the loop
        ])
        gl.bindVertexArray(this.lineVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
        gl.bufferData(gl.ARRAY_BUFFER, outlineData, gl.DYNAMIC_DRAW)
        gl.drawArrays(gl.LINE_STRIP, 0, 5)
      }
    }

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
  }
}
