import { HP_GLSL_FUNCTIONS } from './utils.ts'

// Vertex shader for reads
export const READ_VERTEX_SHADER = `#version 300 es
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

export const READ_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = v_color;
}
`
