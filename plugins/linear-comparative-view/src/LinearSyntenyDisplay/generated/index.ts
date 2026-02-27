// Hand-written GLSL ES 3.0 shaders for WebGL2 fallback
// Matches the WGSL shaders in syntenyShaders.ts
// Line rendering references:
// - https://mattdesl.svbtle.com/drawing-lines-is-hard (screen-space expansion)
// - https://blog.frost.kiwi/analytical-anti-aliasing/ (fwidth-based coverage)

export const FILL_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec4 a_inst0;
in vec4 a_inst1;
in vec4 a_inst2;
in vec4 a_inst3;

layout(std140) uniform Uniforms_block_1Vertex {
  vec2 resolution;
  float height;
  float adjOff0;
  float adjOff1;
  float scale0;
  float scale1;
  float maxOffScreenPx;
  float minAlignmentLength;
  float alpha;
  uint instanceCount;
  uint fillSegments;
  uint edgeSegments;
  float hoveredFeatureId;
  float clickedFeatureId;
  float _pad;
} u;

smooth out vec4 v_color;
flat out float v_featureId;
smooth out float v_dist;
smooth out float v_halfWidth;

vec3 hermiteEdges(float sX1, float sX2, float sX3, float sX4, float t, float isCurve) {
  float edge0, edge1, y;
  if (isCurve > 0.5) {
    float s = t * t * (3.0 - 2.0 * t);
    edge0 = mix(sX1, sX4, s);
    edge1 = mix(sX2, sX3, s);
    y = u.height * (1.5 * t * (1.0 - t) + t * t * t);
  } else {
    edge0 = mix(sX1, sX4, t);
    edge1 = mix(sX2, sX3, t);
    y = t * u.height;
  }
  return vec3(edge0, edge1, y);
}

bool isCulled(float x1, float x2, float x3, float x4, float padTop, float padBottom, float queryTotalLength) {
  if (u.minAlignmentLength > 0.0 && queryTotalLength < u.minAlignmentLength) {
    return true;
  }
  float topX1 = (x1 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float topX2 = (x2 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float botX3 = (x3 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);
  float botX4 = (x4 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);
  float mOff = u.maxOffScreenPx;
  float rW = u.resolution.x;
  return max(topX1, topX2) < -mOff || min(topX1, topX2) > rW + mOff
      || max(botX3, botX4) < -mOff || min(botX3, botX4) > rW + mOff;
}

void main() {
  float x1 = a_inst0.x, x2 = a_inst0.y, x3 = a_inst0.z, x4 = a_inst0.w;
  vec4 color = a_inst1;
  float featureId = a_inst2.x, isCurve = a_inst2.y;
  float queryTotalLength = a_inst2.z, padTop = a_inst2.w, padBottom = a_inst3.x;

  v_color = color;
  v_featureId = featureId;
  v_dist = 0.0;
  v_halfWidth = 0.0;

  if (isCulled(x1, x2, x3, x4, padTop, padBottom, queryTotalLength)) {
    gl_Position = vec4(0.0);
    return;
  }

  float screenX1 = (x1 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float screenX2 = (x2 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float screenX3 = (x3 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);
  float screenX4 = (x4 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);

  uint vid = uint(gl_VertexID);
  uint segs = u.fillSegments;
  uint seg = vid / 6u;
  uint vertInSeg = vid % 6u;
  float topDiff = screenX1 - screenX2;
  float botDiff = screenX4 - screenX3;

  float t0, t1;
  if (topDiff * botDiff < 0.0) {
    float tCross = clamp(topDiff / (topDiff - botDiff), 0.01, 0.99);
    uint nUpper = clamp(uint(round(float(segs) * tCross)), 1u, segs - 1u);
    if (seg < nUpper) {
      t0 = float(seg) / float(nUpper) * tCross;
      t1 = float(seg + 1u) / float(nUpper) * tCross;
    } else {
      uint lSeg = seg - nUpper;
      uint nLower = segs - nUpper;
      t0 = tCross + float(lSeg) / float(nLower) * (1.0 - tCross);
      t1 = tCross + float(lSeg + 1u) / float(nLower) * (1.0 - tCross);
    }
  } else {
    t0 = float(seg) / float(segs);
    t1 = float(seg + 1u) / float(segs);
  }

  float t, side;
  switch (vertInSeg) {
    case 0u: t = t0; side = 0.0; break;
    case 1u: t = t0; side = 1.0; break;
    case 2u: t = t1; side = 0.0; break;
    case 3u: t = t1; side = 0.0; break;
    case 4u: t = t0; side = 1.0; break;
    case 5u: t = t1; side = 1.0; break;
    default: t = 0.0; side = 0.0; break;
  }

  vec3 e0 = hermiteEdges(screenX1, screenX2, screenX3, screenX4, t0, isCurve);
  vec3 e1 = hermiteEdges(screenX1, screenX2, screenX3, screenX4, t1, isCurve);
  vec2 center0 = vec2((e0.x + e0.y) * 0.5, e0.z);
  vec2 center1 = vec2((e1.x + e1.y) * 0.5, e1.z);
  vec2 tangent = center1 - center0;
  float tangentLen = length(tangent);
  vec2 normal = tangentLen > 0.001
    ? vec2(-tangent.y, tangent.x) / tangentLen
    : vec2(1.0, 0.0);

  vec3 e = abs(t - t1) < abs(t - t0) ? e1 : e0;
  float centerX = (e.x + e.y) * 0.5;
  float rawHalfWidthX = abs(e.x - e.y) * 0.5;
  float perpHW = max(rawHalfWidthX * abs(normal.x), 0.5);
  float dir = side * 2.0 - 1.0;
  float expandedPerpHW = perpHW + 0.5;

  vec2 pos = vec2(centerX, e.z) + dir * expandedPerpHW * normal;
  vec2 clipSpace = pos / u.resolution * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  v_dist = dir * expandedPerpHW;
  v_halfWidth = perpHW;
}
`

export const FILL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

layout(std140) uniform Uniforms_block_0Fragment {
  vec2 resolution;
  float height;
  float adjOff0;
  float adjOff1;
  float scale0;
  float scale1;
  float maxOffScreenPx;
  float minAlignmentLength;
  float alpha;
  uint instanceCount;
  uint fillSegments;
  uint edgeSegments;
  float hoveredFeatureId;
  float clickedFeatureId;
  float _pad;
} u;

smooth in vec4 v_color;
flat in float v_featureId;
smooth in float v_dist;
smooth in float v_halfWidth;
out vec4 fragColor;

void main() {
  float aa = fwidth(v_dist);
  float coverage = clamp((v_halfWidth - abs(v_dist) + 0.5 * aa) / aa, 0.0, 1.0);
  vec3 rgb = v_color.rgb;
  bool isHovered = u.hoveredFeatureId > 0.0 && abs(v_featureId - u.hoveredFeatureId) < 0.5;
  float baseAlpha = v_color.a * u.alpha;
  float finalAlpha = isHovered ? min(baseAlpha * 5.0, 0.35) : baseAlpha;
  if (isHovered) {
    rgb *= 0.7;
  }
  fragColor = vec4(rgb, finalAlpha * coverage);
}
`

export const FILL_FRAGMENT_SHADER_PICKING = `#version 300 es
precision highp float;

smooth in vec4 v_color;
flat in float v_featureId;
smooth in float v_dist;
smooth in float v_halfWidth;
out vec4 fragColor;

void main() {
  if (abs(v_dist) > v_halfWidth) {
    discard;
  }
  uint id = uint(v_featureId);
  fragColor = vec4(
    float(id & 0xFFu) / 255.0,
    float((id >> 8u) & 0xFFu) / 255.0,
    float((id >> 16u) & 0xFFu) / 255.0,
    1.0
  );
}
`

export const EDGE_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

in vec4 a_inst0;
in vec4 a_inst1;
in vec4 a_inst2;
in vec4 a_inst3;

layout(std140) uniform Uniforms_block_1Vertex {
  vec2 resolution;
  float height;
  float adjOff0;
  float adjOff1;
  float scale0;
  float scale1;
  float maxOffScreenPx;
  float minAlignmentLength;
  float alpha;
  uint instanceCount;
  uint fillSegments;
  uint edgeSegments;
  float hoveredFeatureId;
  float clickedFeatureId;
  float _pad;
} u;

smooth out float v_dist;

const float STROKE_WIDTH = 1.0;

bool isCulled(float x1, float x2, float x3, float x4, float padTop, float padBottom, float queryTotalLength) {
  if (u.minAlignmentLength > 0.0 && queryTotalLength < u.minAlignmentLength) {
    return true;
  }
  float topX1 = (x1 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float topX2 = (x2 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float botX3 = (x3 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);
  float botX4 = (x4 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);
  float mOff = u.maxOffScreenPx;
  float rW = u.resolution.x;
  return max(topX1, topX2) < -mOff || min(topX1, topX2) > rW + mOff
      || max(botX3, botX4) < -mOff || min(botX3, botX4) > rW + mOff;
}

void main() {
  float x1 = a_inst0.x, x2 = a_inst0.y, x3 = a_inst0.z, x4 = a_inst0.w;
  float featureId = a_inst2.x, isCurve = a_inst2.y;
  float queryTotalLength = a_inst2.z, padTop = a_inst2.w, padBottom = a_inst3.x;

  v_dist = 0.0;

  bool isClicked = u.clickedFeatureId > 0.0 && abs(featureId - u.clickedFeatureId) < 0.5;
  if (!isClicked || isCulled(x1, x2, x3, x4, padTop, padBottom, queryTotalLength)) {
    gl_Position = vec4(0.0);
    return;
  }

  float screenX1 = (x1 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float screenX2 = (x2 - u.adjOff0) * u.scale0 - padTop * (u.scale0 - 1.0);
  float screenX3 = (x3 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);
  float screenX4 = (x4 - u.adjOff1) * u.scale1 - padBottom * (u.scale1 - 1.0);

  uint vid = uint(gl_VertexID);
  uint segs = u.edgeSegments;
  uint vertsPerEdge = segs * 6u;
  uint edgeIdx = vid / vertsPerEdge;
  uint vidInEdge = vid % vertsPerEdge;
  uint seg = vidInEdge / 6u;
  uint vertInSeg = vidInEdge % 6u;
  float t0 = float(seg) / float(segs);
  float t1 = float(seg + 1u) / float(segs);

  float t, side;
  switch (vertInSeg) {
    case 0u: t = t0; side = -1.0; break;
    case 1u: t = t0; side =  1.0; break;
    case 2u: t = t1; side = -1.0; break;
    case 3u: t = t1; side = -1.0; break;
    case 4u: t = t0; side =  1.0; break;
    case 5u: t = t1; side =  1.0; break;
    default: t = 0.0; side = 0.0; break;
  }

  float edge0_x, edge1_x, y;
  vec2 tangent;

  if (isCurve > 0.5) {
    float s = t * t * (3.0 - 2.0 * t);
    edge0_x = mix(screenX1, screenX4, s);
    edge1_x = mix(screenX2, screenX3, s);
    y = u.height * (1.5 * t * (1.0 - t) + t * t * t);
    float sPrime = 6.0 * t * (1.0 - t);
    float dy = u.height * 1.5 * (1.0 - 2.0 * t * (1.0 - t));
    float dx = edgeIdx == 1u ? sPrime * (screenX3 - screenX2) : sPrime * (screenX4 - screenX1);
    tangent = vec2(dx, dy);
  } else {
    edge0_x = mix(screenX1, screenX4, t);
    edge1_x = mix(screenX2, screenX3, t);
    y = t * u.height;
    float dx = edgeIdx == 1u ? screenX3 - screenX2 : screenX4 - screenX1;
    tangent = vec2(dx, u.height);
  }

  float edgeX = edgeIdx == 1u ? edge1_x : edge0_x;
  float tangentLen = length(tangent);
  vec2 normal;
  if (tangentLen > 0.001) {
    vec2 rawNormal = vec2(-tangent.y, tangent.x) / tangentLen;
    float outwardSign = (edgeIdx == 0u ? -1.0 : 1.0) * sign(screenX1 - screenX2);
    normal = rawNormal * outwardSign;
  } else {
    normal = vec2(0.0, 1.0);
  }

  vec2 pos = vec2(edgeX, y) + normal * side * STROKE_WIDTH;
  v_dist = side * STROKE_WIDTH;
  vec2 clipSpace = pos / u.resolution * 2.0 - 1.0;
  gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
}
`

export const EDGE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

smooth in float v_dist;
out vec4 fragColor;

const float STROKE_WIDTH = 1.0;

void main() {
  float d = abs(v_dist);
  float aa = fwidth(v_dist);
  float halfW = STROKE_WIDTH * 0.5;
  float edgeAlpha = 1.0 - smoothstep(halfW - aa * 0.5, halfW + aa, d);
  fragColor = vec4(0.0, 0.0, 0.0, edgeAlpha * 0.4);
}
`
