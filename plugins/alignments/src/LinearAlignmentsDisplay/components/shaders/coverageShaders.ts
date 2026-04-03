import { GLSL_UBO_PREAMBLE, COV_DOMAIN_GLSL } from './uboCommon.ts'

export const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}
${COV_DOMAIN_GLSL}

// SYNC(wgsl/coverageShaders.ts): CovInst struct { position, depth }
in float a_position;    // position offset from regionStart
in float a_depth;       // normalized depth (0-1, against per-region max)

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = vis_range().y - vis_range().x;

  float x1 = (a_position - vis_range().x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + uf(19u) - vis_range().x) / domainWidth * 2.0 - 1.0;

  // SYNC(wgsl/coverageShaders.ts): min width enforcement 2.0/canvasWidth
  float minWidth = 2.0 / canvas_width();
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  // SYNC(wgsl/coverageShaders.ts): effectiveHeight, coverageBottom, depthScale formulas
  float effectiveHeight = cov_height() - 2.0 * cov_y_offset();
  float coverageBottom = 1.0 - ((cov_height() - cov_y_offset()) / canvas_height()) * 2.0;
  float barTop = coverageBottom + (a_depth * depth_scale() * effectiveHeight / canvas_height()) * 2.0;
  float sy = mix(coverageBottom, barTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  v_color = vec4(color3(80u), 1.0);
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

export const SNP_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}
${COV_DOMAIN_GLSL}

// SYNC(wgsl/coverageShaders.ts): SnpCovInst struct { position, y_offset, seg_height, color_type }
in float a_position;       // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in float a_colorType;     // 1=A(green), 2=C(blue), 3=G(orange), 4=T(red)

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = vis_range().y - vis_range().x;
  float x1 = (a_position - vis_range().x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + 1.0 - vis_range().x) / domainWidth * 2.0 - 1.0;

  float minWidth = 2.0 / canvas_width();
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  float effectiveHeight = cov_height() - 2.0 * cov_y_offset();
  float coverageBottom = 1.0 - ((cov_height() - cov_y_offset()) / canvas_height()) * 2.0;
  float segmentBot = coverageBottom + (a_yOffset * depth_scale() * effectiveHeight / canvas_height()) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * depth_scale() * effectiveHeight / canvas_height()) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);

  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(color3(53u), 1.0);
  } else if (colorIdx == 2) {
    v_color = vec4(color3(56u), 1.0);
  } else if (colorIdx == 3) {
    v_color = vec4(color3(59u), 1.0);
  } else {
    v_color = vec4(color3(62u), 1.0);
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

export const MOD_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}
${COV_DOMAIN_GLSL}

// SYNC(wgsl/coverageShaders.ts): ModCovInst struct { position, y_offset, seg_height, packed_color }
in float a_position;       // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in uint a_packedColor;    // RGBA packed as u32 (R in low byte)

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = vis_range().y - vis_range().x;
  float x1 = (a_position - vis_range().x) / domainWidth * 2.0 - 1.0;
  float x2 = (a_position + 1.0 - vis_range().x) / domainWidth * 2.0 - 1.0;

  float minWidth = 2.0 / canvas_width();
  if (x2 - x1 < minWidth) {
    float mid = (x1 + x2) * 0.5;
    x1 = mid - minWidth * 0.5;
    x2 = mid + minWidth * 0.5;
  }

  float sx = mix(x1, x2, localX);

  float effectiveHeight = cov_height() - 2.0 * cov_y_offset();
  float coverageBottom = 1.0 - ((cov_height() - cov_y_offset()) / canvas_height()) * 2.0;
  float segmentBot = coverageBottom + (a_yOffset * depth_scale() * effectiveHeight / canvas_height()) * 2.0;
  float segmentTop = segmentBot + (a_segmentHeight * depth_scale() * effectiveHeight / canvas_height()) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);
  // Unpack RGBA from u32
  float r = float(a_packedColor & 0xFFu) / 255.0;
  float g = float((a_packedColor >> 8u) & 0xFFu) / 255.0;
  float b = float((a_packedColor >> 16u) & 0xFFu) / 255.0;
  float a = float((a_packedColor >> 24u) & 0xFFu) / 255.0;
  v_color = vec4(r, g, b, a);
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

export const NONCOV_HISTOGRAM_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}
${COV_DOMAIN_GLSL}

// SYNC(wgsl/coverageShaders.ts): NoncovInst struct { position, y_offset, seg_height, color_type }
in float a_position;      // position offset from regionStart
in float a_yOffset;       // cumulative height below this segment (normalized 0-1)
in float a_segmentHeight; // height of this segment (normalized 0-1)
in float a_colorType;     // 1=insertion, 2=softclip, 3=hardclip

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float domainWidth = vis_range().y - vis_range().x;

  float cx = (a_position - vis_range().x) / domainWidth * 2.0 - 1.0;

  float barWidthClip = 1.0 / canvas_width() * 2.0;
  float x1 = cx - barWidthClip * 0.5;
  float x2 = cx + barWidthClip * 0.5;

  float sx = mix(x1, x2, localX);

  float indicatorOffsetClip = 4.5 / canvas_height() * 2.0;
  float segmentTop = 1.0 - indicatorOffsetClip - (a_yOffset * uf(20u) / canvas_height()) * 2.0;
  float segmentBot = segmentTop - (a_segmentHeight * uf(20u) / canvas_height()) * 2.0;
  float sy = mix(segmentBot, segmentTop, localY);

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);

  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(color3(65u), 1.0);
  } else if (colorIdx == 2) {
    v_color = vec4(color3(74u), 1.0);
  } else {
    v_color = vec4(color3(77u), 1.0);
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

export const INDICATOR_VERTEX_SHADER = `#version 300 es
precision highp float;

${GLSL_UBO_PREAMBLE}
${COV_DOMAIN_GLSL}

// SYNC(wgsl/coverageShaders.ts): IndicatorInst struct { position, color_type }
in float a_position;   // position offset from regionStart
in float a_colorType;  // 1=insertion, 2=softclip, 3=hardclip (dominant type)

out vec4 v_color;
out vec3 v_bary;

void main() {
  int vid = gl_VertexID % 3;

  float domainWidth = vis_range().y - vis_range().x;
  float cx = (a_position - vis_range().x) / domainWidth * 2.0 - 1.0;

  // SYNC(wgsl/coverageShaders.ts): indicator triangle 7px wide, 4.5px tall
  float triangleWidth = 7.0 / canvas_width() * 2.0;
  float triangleHeight = 4.5 / canvas_height() * 2.0;

  float sx, sy;
  if (vid == 0) {
    sx = cx - triangleWidth * 0.5;
    sy = 1.0;
    v_bary = vec3(1.0, 0.0, 0.0);
  } else if (vid == 1) {
    sx = cx + triangleWidth * 0.5;
    sy = 1.0;
    v_bary = vec3(0.0, 1.0, 0.0);
  } else {
    sx = cx;
    sy = 1.0 - triangleHeight;
    v_bary = vec3(0.0, 0.0, 1.0);
  }

  gl_Position = vec4(flip_x(sx), sy, 0.0, 1.0);

  int colorIdx = int(a_colorType);
  if (colorIdx == 1) {
    v_color = vec4(color3(65u), 1.0);
  } else if (colorIdx == 2) {
    v_color = vec4(color3(74u), 1.0);
  } else {
    v_color = vec4(color3(77u), 1.0);
  }
}
`

export const INDICATOR_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 v_color;
in vec3 v_bary;
out vec4 fragColor;
void main() {
  float altPx = 3.7;
  float dLeft = v_bary.y * altPx;
  float dRight = v_bary.x * altPx;
  float aa = smoothstep(0.0, 1.0, min(dLeft, dRight));
  fragColor = vec4(v_color.rgb, v_color.a * aa);
}
`

