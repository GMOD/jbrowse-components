import { HP_GLSL_FUNCTIONS } from './utils.ts'

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
in vec3 a_tagColor;
in float a_chainHasSupp;

uniform vec3 u_bpRangeX;
uniform uint u_regionStart;
uniform vec2 u_rangeY;
uniform int u_colorScheme;
uniform float u_featureHeight;
uniform float u_featureSpacing;
uniform float u_coverageOffset;
uniform float u_canvasHeight;
uniform int u_highlightedIndex;
uniform int u_highlightOnlyMode;
uniform float u_canvasWidth;
uniform int u_chainMode;

uniform vec3 u_colorFwdStrand;
uniform vec3 u_colorRevStrand;
uniform vec3 u_colorNostrand;
uniform vec3 u_colorPairLR;
uniform vec3 u_colorPairRL;
uniform vec3 u_colorPairRR;
uniform vec3 u_colorPairLL;
uniform vec3 u_colorModificationFwd;
uniform vec3 u_colorModificationRev;
uniform vec3 u_colorLongInsert;
uniform vec3 u_colorShortInsert;
uniform vec3 u_colorSupplementary;

uniform float u_insertSizeUpper;
uniform float u_insertSizeLower;

out vec4 v_color;
out vec2 v_localPos;       // 0-1 UV within the feature rectangle
out vec2 v_featureSizePx;  // feature width and height in pixels
out float v_edgeFlags;     // 0=normal, 1=suppress right, -1=suppress left, 2=chevron mode

${HP_GLSL_FUNCTIONS}

// Color scheme 0: normal
vec3 normalColor() {
  return u_colorPairLR;
}

// Color scheme 1: strand
vec3 strandColor(float strand) {
  if (strand > 0.5) return u_colorFwdStrand;
  if (strand < -0.5) return u_colorRevStrand;
  return u_colorNostrand;
}

// Color scheme 2: mapping quality - hsl(mapq, 50%, 50%)
vec3 mapqColor(float mapq) {
  float h = mapq / 360.0;
  float s = 0.5;
  float l = 0.5;

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

// Color scheme 3: insert size
vec3 insertSizeColor(float insertSize) {
  if (insertSize > u_insertSizeUpper) return u_colorLongInsert;
  if (insertSize < u_insertSizeLower) return u_colorShortInsert;
  return u_colorPairLR;
}

// Color scheme 4: first-of-pair strand
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

// Color scheme 5: pair orientation
vec3 pairOrientationColor(float pairOrientation) {
  int po = int(pairOrientation);
  if (po == 1) return u_colorPairLR;   // LR
  if (po == 2) return u_colorPairRL;   // RL
  if (po == 3) return u_colorPairRR;   // RR
  if (po == 4) return u_colorPairLL;   // LL
  return u_colorNostrand;
}

// Color scheme 6: insert size + orientation
vec3 insertSizeAndOrientationColor(float insertSize, float pairOrientation) {
  int po = int(pairOrientation);
  if (po == 2) return u_colorPairRL;
  if (po == 3) return u_colorPairRR;
  if (po == 4) return u_colorPairLL;
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
  // In highlight-only mode, discard all non-highlighted instances
  if (u_highlightOnlyMode == 1) {
    if (u_highlightedIndex < 0 || gl_InstanceID != u_highlightedIndex) {
      gl_Position = vec4(0.0);
      v_color = vec4(0.0);
      return;
    }
  }

  int vid = gl_VertexID % 9;

  uint absStart = a_position.x + u_regionStart;
  uint absEnd = a_position.y + u_regionStart;
  vec2 splitStart = hpSplitUint(absStart);
  vec2 splitEnd = hpSplitUint(absEnd);
  float sx1 = hpToClipX(splitStart, u_bpRangeX);
  float sx2 = hpToClipX(splitEnd, u_bpRangeX);

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

  // Chevron width: 8px in clip space
  float chevronClip = 8.0 / u_canvasWidth * 2.0;
  float regionLengthBp = u_bpRangeX.z;
  float bpPerPx = regionLengthBp / u_canvasWidth;
  bool showChevron = (u_chainMode == 1 || bpPerPx < 10.0) && u_featureHeight >= 3.0;

  // Feature size in pixels for stroke edge detection
  float featureWidthPx = (sx2 - sx1) * u_canvasWidth * 0.5;
  v_featureSizePx = vec2(featureWidthPx, u_featureHeight);

  float sx;
  float sy;
  float localX;
  float localY;
  float edgeFlags = 0.0;
  if (u_highlightOnlyMode == 1) {
    // Highlight overlay: simple rectangle, no chevrons
    localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
    sx = mix(sx1, sx2, localX);
    sy = mix(syBot, syTop, localY);
    // Collapse chevron vertices to rectangle corner
    if (vid >= 6) { sx = sx1; sy = syTop; localX = 0.5; localY = 0.5; }
  } else if (vid < 6) {
    // Vertices 0-5: rectangle body
    localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
    sx = mix(sx1, sx2, localX);
    sy = mix(syBot, syTop, localY);
    // Suppress stroke on the edge shared with the chevron
    if (showChevron && a_strand > 0.5) {
      edgeFlags = 1.0;   // suppress right edge
    } else if (showChevron && a_strand < -0.5) {
      edgeFlags = -1.0;  // suppress left edge
    }
  } else if (showChevron) {
    // Vertices 6-8: chevron triangle
    // Compute perpendicular distance from each vertex to the outer edges
    // so the fragment shader can stroke the slanted edges
    edgeFlags = 2.0;
    float chevronWidthPx = 8.0;
    float halfH = u_featureHeight * 0.5;
    float altPx = chevronWidthPx * u_featureHeight / sqrt(halfH * halfH + chevronWidthPx * chevronWidthPx);
    if (a_strand > 0.5) {
      // Forward: vid6=top-right, vid7=bottom-right, vid8=tip
      // Edge A = vid6→vid8 (top outer), Edge B = vid7→vid8 (bottom outer)
      if (vid == 6) { sx = sx2; sy = syTop; localX = 0.0; localY = altPx; }
      else if (vid == 7) { sx = sx2; sy = syBot; localX = altPx; localY = 0.0; }
      else { sx = sx2 + chevronClip; sy = syMid; localX = 0.0; localY = 0.0; }
    } else if (a_strand < -0.5) {
      // Reverse: vid6=top-left, vid7=tip, vid8=bottom-left
      // Edge A = vid6→vid7 (top outer), Edge B = vid7→vid8 (bottom outer)
      if (vid == 6) { sx = sx1; sy = syTop; localX = 0.0; localY = altPx; }
      else if (vid == 7) { sx = sx1 - chevronClip; sy = syMid; localX = 0.0; localY = 0.0; }
      else { sx = sx1; sy = syBot; localX = altPx; localY = 0.0; }
    } else {
      // No strand: degenerate triangle (invisible)
      localX = 999.0; localY = 999.0;
      sx = sx1; sy = syTop;
    }
  } else {
    // Chevrons disabled: degenerate triangle
    localX = 0.5;
    localY = 0.5;
    sx = sx1; sy = syTop;
  }

  v_localPos = vec2(localX, localY);
  v_edgeFlags = edgeFlags;
  gl_Position = vec4(sx, sy, 0.0, 1.0);

  if (u_highlightOnlyMode == 1) {
    v_color = vec4(0.0, 0.0, 0.0, 0.4);
    return;
  }

  vec3 color;
  // In chain mode, supplementary chains override all color schemes
  if (u_chainMode == 1 && a_chainHasSupp > 0.5) {
    color = u_colorSupplementary;
  } else if (u_colorScheme == 0) color = normalColor();
  else if (u_colorScheme == 1) color = strandColor(a_strand);
  else if (u_colorScheme == 2) color = mapqColor(a_mapq);
  else if (u_colorScheme == 3) color = insertSizeColor(a_insertSize);
  else if (u_colorScheme == 4) color = firstOfPairColor(a_flags, a_strand);
  else if (u_colorScheme == 5) color = pairOrientationColor(a_pairOrientation);
  else if (u_colorScheme == 6) color = insertSizeAndOrientationColor(a_insertSize, a_pairOrientation);
  else if (u_colorScheme == 7) color = modificationsColor(a_flags);
  else if (u_colorScheme == 8) color = a_tagColor;
  else color = vec3(0.6);

  v_color = vec4(color, 1.0);
}
`

export const READ_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_localPos;
in vec2 v_featureSizePx;
in float v_edgeFlags;
uniform int u_showStroke;
out vec4 fragColor;
void main() {
  if (u_showStroke == 1) {
    float edgeDist;
    if (v_edgeFlags > 1.5) {
      // Chevron mode: v_localPos contains pixel distances to outer edges
      edgeDist = min(v_localPos.x, v_localPos.y);
    } else {
      // Rectangle mode: v_localPos is 0-1 UV
      float dx_left = v_localPos.x * v_featureSizePx.x;
      float dx_right = (1.0 - v_localPos.x) * v_featureSizePx.x;
      // Suppress stroke on edge shared with chevron
      if (v_edgeFlags > 0.5) { dx_right = 999.0; }
      if (v_edgeFlags < -0.5) { dx_left = 999.0; }
      float dy = min(v_localPos.y, 1.0 - v_localPos.y) * v_featureSizePx.y;
      edgeDist = min(min(dx_left, dx_right), dy);
    }

    if (edgeDist < 1.0 && v_featureSizePx.x > 4.0 && v_featureSizePx.y > 4.0) {
      fragColor = vec4(v_color.rgb * 0.7, v_color.a);
      return;
    }
  }
  fragColor = v_color;
}
`
