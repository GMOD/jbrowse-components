import { GLSL_UBO_PREAMBLE, HP_GLSL_UBO, PILEUP_Y_GLSL } from './uboCommon.ts'

export const READ_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${HP_GLSL_UBO}
${PILEUP_Y_GLSL}

// SYNC(wgsl/readShader.ts): field order must match ReadInst struct (17 fields)
in uvec2 a_position;  // segment [start, end] as uint offsets from regionStart
in uint a_y;
in uint a_flags;
in uint a_mapq;
in uint a_baseQuality;
in float a_insertSize;
in uint a_pairOrientation;  // 0=unknown, 1=LR, 2=RL, 3=RR, 4=LL
in int a_strand;             // -1=reverse, 0=unknown, 1=forward
in vec3 a_tagColor;
in uint a_chainHasSupp;     // 0=no supp, 1=has supp + primary fwd, 2=has supp + primary rev
in uint a_readIndex;         // parent read index for highlight matching
in uint a_edgeFlags;         // bit 0=first segment, bit 1=last segment
in uvec2 a_readSpan;         // full read [start, end] offsets for highlight overlay

out vec4 v_color;
out vec2 v_localPos;       // 0-1 UV within the feature rectangle
out vec2 v_featureSizePx;  // feature width and height in pixels
out float v_edgeFlags;     // 0=normal, 1=suppress right, -1=suppress left, 2=chevron mode

// SYNC(wgsl/readShader.ts): color schemes 0-9, flag bit checks (64=first-of-pair, 16=reverse), pair orientation codes (1=LR,2=RL,3=RR,4=LL)
vec3 strandColor(float strand) {
  if (strand > 0.5) return color3(32u);
  if (strand < -0.5) return color3(35u);
  return color3(38u);
}

// SYNC(wgsl/readShader.ts): MAPQ HSL formula h=mapq/360, s=0.5, l=0.5 with HSL->RGB conversion
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

vec3 insertSizeColor(float insertSize) {
  if (insertSize > uf(21u)) return color3(89u);
  if (insertSize < uf(22u)) return color3(92u);
  return color3(41u);
}

vec3 insertSizeGradientColor(float insertSize) {
  if (insertSize > uf(21u)) {
    float t = clamp((insertSize - uf(21u)) / uf(21u), 0.0, 1.0);
    return mix(color3(41u), color3(89u), t);
  }
  if (insertSize < uf(22u)) {
    float t = clamp((uf(22u) - insertSize) / uf(22u), 0.0, 1.0);
    return mix(color3(41u), color3(92u), t);
  }
  return color3(41u);
}

vec3 firstOfPairColor(float flags, float strand) {
  bool isFirst = mod(floor(flags / 64.0), 2.0) > 0.5;
  float effectiveStrand = isFirst ? strand : -strand;
  if (effectiveStrand > 0.5) {
    return color3(32u);
  } else if (effectiveStrand < -0.5) {
    return color3(35u);
  }
  return color3(38u);
}

vec3 pairOrientationColor(float pairOrientation) {
  int po = int(pairOrientation);
  if (po == 1) return color3(41u);
  if (po == 2) return color3(44u);
  if (po == 3) return color3(47u);
  if (po == 4) return color3(50u);
  return color3(38u);
}

vec3 insertSizeAndOrientationColor(float insertSize, float pairOrientation) {
  int po = int(pairOrientation);
  if (po == 2) return color3(44u);
  if (po == 3) return color3(47u);
  if (po == 4) return color3(50u);
  return insertSizeColor(insertSize);
}

vec3 modificationsColor(float flags) {
  bool isReverse = mod(floor(flags / 16.0), 2.0) > 0.5;
  if (isReverse) {
    return color3(86u);
  }
  return color3(83u);
}

void main() {
  // Cast integer attributes to float for arithmetic
  float fy = float(a_y);
  float fflags = float(a_flags);
  float fmapq = float(a_mapq);
  float fbaseQuality = float(a_baseQuality);
  float fpairOrientation = float(a_pairOrientation);
  float fstrand = float(a_strand);
  float fchainHasSupp = float(a_chainHasSupp);

  if (ui(13) == 1) {
    if (ui(12) < 0 || int(a_readIndex) != ui(12)) {
      gl_Position = vec4(0.0);
      v_color = vec4(0.0);
      return;
    }
  }

  int vid = gl_VertexID % 9;

  uint absStart = a_position.x + region_start();
  uint absEnd = a_position.y + region_start();
  vec2 splitStart = hp_split_uint(absStart);
  vec2 splitEnd = hp_split_uint(absEnd);
  float sx1 = hp_to_clip_x(splitStart, bp_range());
  float sx2 = hp_to_clip_x(splitEnd, bp_range());

  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = fy * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float syMid = (syTop + syBot) * 0.5;

  // SYNC(wgsl/readShader.ts): chevron 8px wide, featureHeight>=3.0 threshold, alt calculation
  float chevronClip = 8.0 / canvas_width() * 2.0;
  float regionLengthBp = bp_range().z;
  float bpPerPx = regionLengthBp / canvas_width();
  bool showChevron = (ui(14) == 1 || bpPerPx < 10.0) && feature_height() >= 3.0;

  float featureWidthPx = (sx2 - sx1) * canvas_width() * 0.5;
  v_featureSizePx = vec2(featureWidthPx, feature_height());

  float sx;
  float sy;
  float localX;
  float localY;
  float edgeFlags = 0.0;
  if (ui(13) == 1) {
    uint hlAbsStart = a_readSpan.x + region_start();
    uint hlAbsEnd = a_readSpan.y + region_start();
    float hlSx1 = hp_to_clip_x(hp_split_uint(hlAbsStart), bp_range());
    float hlSx2 = hp_to_clip_x(hp_split_uint(hlAbsEnd), bp_range());
    localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
    sx = mix(hlSx1, hlSx2, localX);
    sy = mix(syBot, syTop, localY);
    if (vid >= 6) { sx = hlSx1; sy = syTop; localX = 0.5; localY = 0.5; }
  } else if (vid < 6) {
    localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
    localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;
    sx = mix(sx1, sx2, localX);
    sy = mix(syBot, syTop, localY);
    bool isLastSeg = (a_edgeFlags & 2u) != 0u;
    bool isFirstSeg = (a_edgeFlags & 1u) != 0u;
    if (showChevron && fstrand > 0.5 && isLastSeg) {
      edgeFlags = 1.0;
    } else if (showChevron && fstrand < -0.5 && isFirstSeg) {
      edgeFlags = -1.0;
    }
  } else if (showChevron) {
    bool isLastSeg = (a_edgeFlags & 2u) != 0u;
    bool isFirstSeg = (a_edgeFlags & 1u) != 0u;
    bool drawFwdChevron = fstrand > 0.5 && isLastSeg;
    bool drawRevChevron = fstrand < -0.5 && isFirstSeg;
    edgeFlags = 2.0;
    float chevronWidthPx = 8.0;
    float halfH = feature_height() * 0.5;
    float altPx = chevronWidthPx * feature_height() / sqrt(halfH * halfH + chevronWidthPx * chevronWidthPx);
    if (drawFwdChevron) {
      if (vid == 6) { sx = sx2; sy = syTop; localX = 0.0; localY = altPx; }
      else if (vid == 7) { sx = sx2; sy = syBot; localX = altPx; localY = 0.0; }
      else { sx = sx2 + chevronClip; sy = syMid; localX = 0.0; localY = 0.0; }
    } else if (drawRevChevron) {
      if (vid == 6) { sx = sx1; sy = syTop; localX = 0.0; localY = altPx; }
      else if (vid == 7) { sx = sx1 - chevronClip; sy = syMid; localX = 0.0; localY = 0.0; }
      else { sx = sx1; sy = syBot; localX = altPx; localY = 0.0; }
    } else {
      localX = 999.0; localY = 999.0;
      sx = sx1; sy = syTop;
    }
  } else {
    localX = 0.5;
    localY = 0.5;
    sx = sx1; sy = syTop;
  }

  v_localPos = vec2(localX, localY);
  v_edgeFlags = edgeFlags;
  gl_Position = vec4(sx, sy, 0.0, 1.0);

  // SYNC(wgsl/readShader.ts): highlight-only dark overlay vec4(0,0,0,0.4), no chevrons
  if (ui(13) == 1) {
    v_color = vec4(0.0, 0.0, 0.0, 0.4);
    return;
  }

  vec3 color;
  bool isPaired = mod(fflags, 2.0) > 0.5;
  if (ui(14) == 1 && fchainHasSupp > 0.5 && isPaired) {
    color = color3(95u);
  } else if (ui(14) == 1 && fchainHasSupp > 0.5) {
    float primaryStrand = fchainHasSupp > 1.5 ? -1.0 : 1.0;
    float effectiveStrand = ui(29) == 1
      ? fstrand * primaryStrand
      : fstrand;
    color = strandColor(effectiveStrand);
  } else if (mod(floor(fflags / 8.0), 2.0) > 0.5 && (ui(11) == 0 || ui(11) == 3 || ui(11) == 5 || ui(11) == 6 || ui(11) == 10)) {
    color = color3(134u);
  } else if (ui(11) == 0) color = color3(41u);
  else if (ui(11) == 1) color = strandColor(fstrand);
  else if (ui(11) == 2) color = mapqColor(fmapq);
  else if (ui(11) == 3) color = insertSizeColor(a_insertSize);
  else if (ui(11) == 4) color = firstOfPairColor(fflags, fstrand);
  else if (ui(11) == 5) color = pairOrientationColor(fpairOrientation);
  else if (ui(11) == 6) color = insertSizeAndOrientationColor(a_insertSize, fpairOrientation);
  else if (ui(11) == 7) color = modificationsColor(fflags);
  else if (ui(11) == 8) {
    if (a_tagColor.r != 0.0 || a_tagColor.g != 0.0 || a_tagColor.b != 0.0) {
      color = a_tagColor;
    } else {
      color = color3(41u);
    }
  }
  else if (ui(11) == 9) color = mapqColor(fbaseQuality);
  else if (ui(11) == 10) color = insertSizeGradientColor(a_insertSize);
  else color = color3(41u);

  v_color = vec4(color, 1.0);
}
`

export const READ_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}

in vec4 v_color;
in vec2 v_localPos;
in vec2 v_featureSizePx;
in float v_edgeFlags;
out vec4 fragColor;
void main() {
  if (ui(15) == 1) {
    float edgeDist;
    if (v_edgeFlags > 1.5) {
      edgeDist = min(v_localPos.x, v_localPos.y);
    } else {
      float dx_left = v_localPos.x * v_featureSizePx.x;
      float dx_right = (1.0 - v_localPos.x) * v_featureSizePx.x;
      if (v_edgeFlags > 0.5) { dx_right = 999.0; }
      if (v_edgeFlags < -0.5) { dx_left = 999.0; }
      float dy = min(v_localPos.y, 1.0 - v_localPos.y) * v_featureSizePx.y;
      edgeDist = min(min(dx_left, dx_right), dy);
    }

    // SYNC(wgsl/readShader.ts): edge threshold 1.0px, darkening 0.7, size threshold 2.0px
    if (edgeDist < 1.0 && v_featureSizePx.x > 2.0 && v_featureSizePx.y > 2.0) {
      fragColor = vec4(v_color.rgb * 0.7, v_color.a);
      return;
    }
  }
  fragColor = v_color;
}
`
