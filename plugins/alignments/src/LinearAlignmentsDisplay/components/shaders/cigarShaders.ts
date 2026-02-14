import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from '../../model.ts'

// Gap (deletion/skip) vertex shader - colored rectangles over reads
// Deletions are dark grey (#404040), skips are teal/blue (#97b8c9)
// Uses integer attributes for compact representation
export const GAP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in uint a_y;          // pileup row
in uint a_type;       // 0=deletion, 1=skip

uniform vec2 u_bpRangeX;  // [bpStart, bpEnd] as offsets
uniform vec2 u_rangeY;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform vec3 u_colorDeletion;
uniform vec3 u_colorSkip;
uniform int u_eraseMode;  // 0=normal draw, 1=stencil pass (skip gaps at full height)

out vec4 v_color;

void main() {
  // In erase mode, collapse non-skip gaps to zero area
  if (u_eraseMode == 1 && a_type == 0u) {
    gl_Position = vec4(0.0);
    v_color = vec4(0.0);
    return;
  }

  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float regionLengthBp = u_bpRangeX.y - u_bpRangeX.x;
  float sx1 = (float(a_position.x) - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (float(a_position.y) - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = u_featureHeight + u_featureSpacing;
  float yTopPx = y * rowHeight - u_rangeY.x;
  float yBotPx = yTopPx + u_featureHeight;

  // In normal mode, skips render as a 1px line centered in the row
  // In erase mode, skips render at full feature height (for stencil mask)
  if (u_eraseMode == 0 && a_type == 1u) {
    float midPx = (yTopPx + yBotPx) * 0.5;
    yTopPx = midPx;
    yBotPx = midPx + 1.0;
  }

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

export const GAP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Mismatch vertex shader - colored rectangles for SNPs
// Uses integer attributes for compact representation
export const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_base;       // ASCII character code (65='A', 67='C', 71='G', 84='T', etc.)
in float a_frequency; // normalized 0-1, fraction of reads with this base at this position

uniform vec2 u_bpRangeX;  // [bpStart, bpEnd] as offsets
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
  float regionLengthBp = u_bpRangeX.y - u_bpRangeX.x;
  float pxPerBp = u_canvasWidth / regionLengthBp;
  float sx1 = (pos - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (pos + 1.0 - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;

  // When zoomed out, fade low-frequency SNPs to nothing.
  // High-frequency SNPs (>10% of reads) stay visible.
  float alpha = 1.0;
  if (pxPerBp < 1.0 && a_frequency < 0.1) {
    alpha = pxPerBp;
  }

  // Collapse to zero size when fully faded
  if (alpha <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

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
    color = vec3(0.5, 0.5, 0.5);
  }
  v_color = vec4(color, alpha);
}
`

export const MISMATCH_FRAGMENT_SHADER = `#version 300 es
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
export const INSERTION_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_length;     // insertion length

uniform vec2 u_bpRangeX;  // [bpStart, bpEnd] as offsets
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
  float regionLengthBp = u_bpRangeX.y - u_bpRangeX.x;
  float bpPerPx = regionLengthBp / u_canvasWidth;
  float pxPerBp = 1.0 / bpPerPx;

  // Center position in clip space
  float cxClip = (pos - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;

  bool isLongInsertion = a_length >= ${LONG_INSERTION_MIN_LENGTH}u;
  float insertionWidthPx = len * pxPerBp;
  bool canShowText = insertionWidthPx >= ${LONG_INSERTION_TEXT_THRESHOLD_PX}.0;
  bool isLargeInsertion = isLongInsertion && canShowText;

  float rectWidthPx;
  if (isLargeInsertion) {
    rectWidthPx = textWidthForNumber(a_length);
  } else if (isLongInsertion) {
    // Fade from 5px down to 0 as insertionWidthPx goes from threshold to 0
    rectWidthPx = min(5.0, insertionWidthPx / 3.0);
  } else {
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


  float sx = mix(sx1, sx2, localX);
  float sy = mix(y1, y2, localY);

  gl_Position = vec4(sx, sy, 0.0, 1.0);
  v_color = vec4(u_colorInsertion, 1.0);
}
`

export const INSERTION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Soft clip vertex shader - small colored bars
// Uses integer attributes for compact representation
export const SOFTCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;  // Position offset from regionStart
in uint a_y;         // pileup row
in uint a_length;    // clip length

uniform vec2 u_bpRangeX;
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
  float regionLengthBp = u_bpRangeX.y - u_bpRangeX.x;
  float bpPerPx = regionLengthBp / u_canvasWidth;

  // Soft clip bar width
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float x1 = pos - barWidthBp * 0.5;
  float x2 = pos + barWidthBp * 0.5;

  float sx1 = (x1 - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (x2 - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;

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

export const SOFTCLIP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Hard clip vertex shader - colored bars
// Uses integer attributes for compact representation
export const HARDCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;  // Position offset from regionStart
in uint a_y;         // pileup row
in uint a_length;    // clip length

uniform vec2 u_bpRangeX;
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
  float regionLengthBp = u_bpRangeX.y - u_bpRangeX.x;
  float bpPerPx = regionLengthBp / u_canvasWidth;

  // Hard clip bar width
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float x1 = pos - barWidthBp * 0.5;
  float x2 = pos + barWidthBp * 0.5;

  float sx1 = (x1 - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (x2 - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;

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

export const HARDCLIP_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`

// Modification vertex shader - colored rectangles with per-instance RGBA color
// Color and alpha are pre-computed on CPU (arbitrary modification types + probability)
export const MODIFICATION_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in vec4 a_color;      // RGBA color (normalized from Uint8)

uniform vec2 u_bpRangeX;  // [bpStart, bpEnd] as offsets
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
  float regionLengthBp = u_bpRangeX.y - u_bpRangeX.x;
  float sx1 = (pos - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (pos + 1.0 - u_bpRangeX.x) / regionLengthBp * 2.0 - 1.0;

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

export const MODIFICATION_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`
