import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from '../../constants.ts'
import { GLSL_UBO_PREAMBLE, CIGAR_DOMAIN_GLSL, PILEUP_Y_GLSL } from './uboCommon.ts'

export const GAP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${CIGAR_DOMAIN_GLSL}
${PILEUP_Y_GLSL}

// SYNC(wgsl/cigarShaders.ts): GapInst struct { start_off, end_off, y, gap_type, frequency }
// SYNC(wgsl/cigarShaders.ts): gap types deletion=0, skip=1; skip renders as 1px centerline
in uvec2 a_position;  // [start, end] as uint offsets from regionStart
in uint a_y;          // pileup row
in uint a_type;       // 0=deletion, 1=skip
in float a_frequency; // normalized 0-1, fraction of reads with this gap at this position

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainLen = cigar_domain_len();
  float sx1 = (float(a_position.x) - cigar_domain().x) / domainLen * 2.0 - 1.0;
  float sx2 = (float(a_position.y) - cigar_domain().x) / domainLen * 2.0 - 1.0;
  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = y * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  if (a_type == 1u) {
    float midPx = (yTopPx + yBotPx) * 0.5;
    yTopPx = midPx;
    yBotPx = midPx + 1.0;
  }

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);

  // SYNC(wgsl/cigarShaders.ts): deletion sub-pixel alpha
  float alpha = 1.0;
  if (a_type == 0u) {
    float widthPx = (float(a_position.y) - float(a_position.x)) * canvas_width() / domainLen;
    if (widthPx < 1.0) {
      float base = widthPx * widthPx;
      alpha = base + a_frequency * (1.0 - base);
    }
  }
  if (alpha <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }
  v_color = a_type == 0u ? vec4(color3(68u), alpha) : vec4(color3(71u), 1.0);
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

export const MISMATCH_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${CIGAR_DOMAIN_GLSL}
${PILEUP_Y_GLSL}

// SYNC(wgsl/cigarShaders.ts): MismatchInst struct { position, y, base, frequency }
// SYNC(wgsl/cigarShaders.ts): base ASCII codes A=65/97, C=67/99, G=71/103, T=84/116
in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_base;       // ASCII character code (65='A', 67='C', 71='G', 84='T', etc.)
in float a_frequency; // normalized 0-1, fraction of reads with this base at this position

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float regionLengthBp = cigar_domain_len();
  float pxPerBp = canvas_width() / regionLengthBp;

  float px1 = (pos - cigar_domain().x) / regionLengthBp * canvas_width();
  float px2 = (pos + 1.0 - cigar_domain().x) / regionLengthBp * canvas_width();
  px1 = floor(px1);
  px2 = max(px1 + 1.0, floor(px2));
  float sx1 = px1 / canvas_width() * 2.0 - 1.0;
  float sx2 = px2 / canvas_width() * 2.0 - 1.0;

  // SYNC(wgsl/cigarShaders.ts): mismatch sub-pixel alpha
  float alpha = 1.0;
  if (pxPerBp < 1.0) {
    alpha = pxPerBp + a_frequency * (1.0 - pxPerBp);
  }

  if (alpha <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = y * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);

  vec3 color;
  if (a_base == 65u || a_base == 97u) {
    color = color3(53u);
  } else if (a_base == 67u || a_base == 99u) {
    color = color3(56u);
  } else if (a_base == 71u || a_base == 103u) {
    color = color3(59u);
  } else if (a_base == 84u || a_base == 116u) {
    color = color3(62u);
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

export const INSERTION_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${CIGAR_DOMAIN_GLSL}
${PILEUP_Y_GLSL}

// SYNC(wgsl/cigarShaders.ts): InsertionInst struct { position, y, length, frequency }
in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_length;     // insertion length
in float a_frequency; // normalized 0-1, fraction of reads with insertion at this position

out vec4 v_color;

// SYNC: must match textWidthForNumber() and insertionBarWidth() in constants.ts
float textWidthForNumber(uint num) {
  float charWidth = 6.0;
  float padding = 10.0;

  if (num < 10u) return charWidth + padding;
  if (num < 100u) return charWidth * 2.0 + padding;
  if (num < 1000u) return charWidth * 3.0 + padding;
  if (num < 10000u) return charWidth * 4.0 + padding;
  return charWidth * 5.0 + padding;
}

void main() {
  int rectIdx = gl_VertexID / 6;
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float len = float(a_length);
  float regionLengthBp = cigar_domain_len();
  float bpPerPx = regionLengthBp / canvas_width();
  float pxPerBp = 1.0 / bpPerPx;

  float cxClip = (pos - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;

  bool isLongInsertion = a_length >= ${LONG_INSERTION_MIN_LENGTH}u;
  float insertionWidthPx = len * pxPerBp;
  bool canShowText = insertionWidthPx >= ${LONG_INSERTION_TEXT_THRESHOLD_PX}.0;
  bool isLargeInsertion = isLongInsertion && canShowText;

  float rectWidthPx;
  if (isLargeInsertion) {
    rectWidthPx = textWidthForNumber(a_length);
  } else if (isLongInsertion) {
    rectWidthPx = min(5.0, insertionWidthPx / 3.0);
  } else {
    rectWidthPx = 1.0;
  }

  float onePixelClip = 2.0 / canvas_width();
  float rectWidthClip = rectWidthPx * 2.0 / canvas_width();
  // SYNC(wgsl/cigarShaders.ts): serif 3px wide, text width = 6px/digit + 10px padding
  float tickWidthClip = onePixelClip * 3.0;

  float y = float(a_y);
  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = y * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;

  float sx1, sx2, y1, y2;

  if (rectIdx == 0) {
    sx1 = cxClip - rectWidthClip * 0.5;
    sx2 = cxClip + rectWidthClip * 0.5;
    y1 = syBot;
    y2 = syTop;
  } else if (rectIdx == 1) {
    if (isLongInsertion || pxPerBp < ${INSERTION_SERIF_MIN_PX_PER_BP}.0) {
      sx1 = cxClip;
      sx2 = cxClip;
      y1 = syTop;
      y2 = syTop;
    } else {
      sx1 = cxClip - tickWidthClip * 0.5;
      sx2 = cxClip + tickWidthClip * 0.5;
      float tickHeight = 1.0 / canvas_height() * 2.0;
      y1 = syTop;
      y2 = syTop + tickHeight;
    }
  } else {
    if (isLongInsertion || pxPerBp < ${INSERTION_SERIF_MIN_PX_PER_BP}.0) {
      sx1 = cxClip;
      sx2 = cxClip;
      y1 = syBot;
      y2 = syBot;
    } else {
      sx1 = cxClip - tickWidthClip * 0.5;
      sx2 = cxClip + tickWidthClip * 0.5;
      float tickHeight = 1.0 / canvas_height() * 2.0;
      y1 = syBot - tickHeight;
      y2 = syBot;
    }
  }


  float sx = mix(sx1, sx2, localX);
  float sy = mix(y1, y2, localY);

  float alpha = 1.0;
  if (!isLongInsertion && pxPerBp < 1.0) {
    float base = pxPerBp * pxPerBp;
    alpha = base + a_frequency * (1.0 - base);
  }

  if (alpha <= 0.0) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    v_color = vec4(0.0);
    return;
  }

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  v_color = vec4(color3(65u), alpha);
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

export const SOFTCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${CIGAR_DOMAIN_GLSL}
${PILEUP_Y_GLSL}

// SYNC(wgsl/cigarShaders.ts): ClipInst struct { position, y, length, frequency }
in uint a_position;  // Position offset from regionStart
in uint a_y;         // pileup row
in uint a_length;    // clip length
in float a_frequency; // normalized 0-1

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float regionLengthBp = cigar_domain_len();
  float pxPerBp = canvas_width() / regionLengthBp;

  float alpha = 1.0;
  if (pxPerBp < 1.0) {
    alpha = pxPerBp + a_frequency * (1.0 - pxPerBp);
  }
  if (alpha <= 0.0) {
    gl_Position = vec4(0.0);
    v_color = vec4(0.0);
    return;
  }

  float bpPerPx = 1.0 / pxPerBp;
  // SYNC(wgsl/cigarShaders.ts): bar width = max(bpPerPx, min(2*bpPerPx, 1.0))
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float x1 = pos - barWidthBp * 0.5;
  float x2 = pos + barWidthBp * 0.5;

  float sx1 = (x1 - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (x2 - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;

  float minWidth = 2.0 / canvas_width();
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = y * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  v_color = vec4(color3(74u), alpha);
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

export const HARDCLIP_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${CIGAR_DOMAIN_GLSL}
${PILEUP_Y_GLSL}

// SYNC(wgsl/cigarShaders.ts): ClipInst struct { position, y, length, frequency }
in uint a_position;  // Position offset from regionStart
in uint a_y;         // pileup row
in uint a_length;    // clip length
in float a_frequency; // normalized 0-1

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float regionLengthBp = cigar_domain_len();
  float pxPerBp = canvas_width() / regionLengthBp;

  float alpha = 1.0;
  if (pxPerBp < 1.0) {
    alpha = pxPerBp + a_frequency * (1.0 - pxPerBp);
  }
  if (alpha <= 0.0) {
    gl_Position = vec4(0.0);
    v_color = vec4(0.0);
    return;
  }

  float bpPerPx = 1.0 / pxPerBp;
  // SYNC(wgsl/cigarShaders.ts): bar width = max(bpPerPx, min(2*bpPerPx, 1.0))
  float barWidthBp = max(bpPerPx, min(2.0 * bpPerPx, 1.0));

  float x1 = pos - barWidthBp * 0.5;
  float x2 = pos + barWidthBp * 0.5;

  float sx1 = (x1 - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (x2 - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;

  float minWidth = 2.0 / canvas_width();
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = y * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  v_color = vec4(color3(77u), alpha);
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

export const MODIFICATION_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

${GLSL_UBO_PREAMBLE}
${CIGAR_DOMAIN_GLSL}
${PILEUP_Y_GLSL}

// SYNC(wgsl/cigarShaders.ts): ModInst struct { position, y, packed_color, _pad }
in uint a_position;   // Position offset from regionStart
in uint a_y;          // pileup row
in uint a_packedColor; // RGBA packed as u32 (R in low byte)

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float pos = float(a_position);
  float regionLengthBp = cigar_domain_len();
  float sx1 = (pos - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;
  float sx2 = (pos + 1.0 - cigar_domain().x) / regionLengthBp * 2.0 - 1.0;

  float minWidth = 2.0 / canvas_width();
  if (sx2 - sx1 < minWidth) {
    float mid = (sx1 + sx2) * 0.5;
    sx1 = mid - minWidth * 0.5;
    sx2 = mid + minWidth * 0.5;
  }

  float sx = mix(sx1, sx2, localX);

  float y = float(a_y);
  float rowHeight = feature_height() + feature_spacing();
  float yTopPx = y * rowHeight - range_y0();
  float yBotPx = yTopPx + feature_height();

  float pileupTop = 1.0 - (coverage_offset() / canvas_height()) * 2.0;
  float pxToClip = 2.0 / canvas_height();
  float syTop = pileupTop - yTopPx * pxToClip;
  float syBot = pileupTop - yBotPx * pxToClip;
  float sy = mix(syBot, syTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  // Unpack RGBA from u32
  float r = float(a_packedColor & 0xFFu) / 255.0;
  float g = float((a_packedColor >> 8u) & 0xFFu) / 255.0;
  float b = float((a_packedColor >> 16u) & 0xFFu) / 255.0;
  float a = float((a_packedColor >> 24u) & 0xFFu) / 255.0;
  v_color = vec4(r, g, b, a);
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
