// Line rendering references:
// - https://mattdesl.svbtle.com/drawing-lines-is-hard (screen-space expansion)

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

// SYNC: must match Instance struct in WGSL (16 f32 fields * 4 bytes = 64)
export const INSTANCE_BYTE_SIZE = 64
// SYNC: must match Uniforms struct below
export const UNIFORM_BYTE_SIZE = 64
export const FILL_SEGMENTS = 16
export const EDGE_SEGMENTS = 4
// SYNC: 6 verts per segment must match WGSL switch (cases 0u..5u)
export const FILL_VERTS_PER_INSTANCE = FILL_SEGMENTS * 6
// SYNC: 2 edges (edgeIdx 0/1) and 6 verts per segment must match WGSL edge shader
export const EDGE_VERTS_PER_INSTANCE = 2 * EDGE_SEGMENTS * 6

// SYNC: field count * 4 bytes must equal INSTANCE_BYTE_SIZE above
const INSTANCE_STRUCT = /* wgsl */ `
struct Instance {
  x1: f32, x2: f32, x3: f32, x4: f32,
  color: u32, _pad0: u32, _pad1: u32, _pad2: u32,
  featureId: f32,
  isCurve: f32,
  queryTotalLength: f32,
  padTop: f32,
  padBottom: f32,
  _pad3: f32, _pad4: f32, _pad5: f32,
}
`

// SYNC: field order must match uniformF32/uniformU32 indices in GpuSyntenyRenderer
const UNIFORMS_STRUCT = /* wgsl */ `
struct Uniforms {
  resolution: vec2f,
  height: f32,
  adjOff0: f32,
  adjOff1: f32,
  scale0: f32,
  scale1: f32,
  maxOffScreenPx: f32,
  minAlignmentLength: f32,
  alpha: f32,
  hoveredFeatureId: f32,
  clickedFeatureId: f32,
  yTop: f32,
  _pad0: f32,
  _pad1: f32,
  _pad2: f32,
}
`

const SEGMENT_CONSTS = /* wgsl */ `
const FILL_SEGS: u32 = ${FILL_SEGMENTS}u;
const EDGE_SEGS: u32 = ${EDGE_SEGMENTS}u;
`

const SCREEN_POSITIONS = /* wgsl */ `
  let screenX1 = (inst.x1 - uniforms.adjOff0) * uniforms.scale0 - inst.padTop * (uniforms.scale0 - 1.0);
  let screenX2 = (inst.x2 - uniforms.adjOff0) * uniforms.scale0 - inst.padTop * (uniforms.scale0 - 1.0);
  let screenX3 = (inst.x3 - uniforms.adjOff1) * uniforms.scale1 - inst.padBottom * (uniforms.scale1 - 1.0);
  let screenX4 = (inst.x4 - uniforms.adjOff1) * uniforms.scale1 - inst.padBottom * (uniforms.scale1 - 1.0);
`

// True when the whole parallelogram is off-screen horizontally (both top
// and bottom edges cleared the canvas + margin) or below the minimum
// alignment length cutoff.
const CULL_CHECK = /* wgsl */ `
fn isCulled(
  inst: Instance,
  screenX1: f32, screenX2: f32, screenX3: f32, screenX4: f32,
) -> bool {
  if (uniforms.minAlignmentLength > 0.0 && inst.queryTotalLength < uniforms.minAlignmentLength) {
    return true;
  }
  let mOff = uniforms.maxOffScreenPx;
  let rW = uniforms.resolution.x;
  return max(screenX1, screenX2) < -mOff || min(screenX1, screenX2) > rW + mOff
      || max(screenX3, screenX4) < -mOff || min(screenX3, screenX4) > rW + mOff;
}
`

const HERMITE_EDGES = /* wgsl */ `
fn hermiteEdges(sX1: f32, sX2: f32, sX3: f32, sX4: f32, t: f32, isCurve: f32) -> vec3f {
  var edge0: f32;
  var edge1: f32;
  var y: f32;
  if (isCurve > 0.5) {
    let s = t * t * (3.0 - 2.0 * t);
    edge0 = mix(sX1, sX4, s);
    edge1 = mix(sX2, sX3, s);
    y = uniforms.yTop + uniforms.height * (1.5 * t * (1.0 - t) + t * t * t);
  } else {
    edge0 = mix(sX1, sX4, t);
    edge1 = mix(sX2, sX3, t);
    y = uniforms.yTop + t * uniforms.height;
  }
  return vec3f(edge0, edge1, y);
}
`

const DEGENERATE = /* wgsl */ `vec4f(0.0, 0.0, 0.0, 0.0)`

export const fillVertexShader = /* wgsl */ `
${INSTANCE_STRUCT}
${UNIFORMS_STRUCT}
${SEGMENT_CONSTS}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) @interpolate(flat) featureId: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${HERMITE_EDGES}
${CULL_CHECK}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];

  var out: VOut;
  out.color = unpack4x8unorm(inst.color);
  out.featureId = inst.featureId;

${SCREEN_POSITIONS}

  if (isCulled(inst, screenX1, screenX2, screenX3, screenX4)) {
    out.pos = ${DEGENERATE};
    return out;
  }

  let seg = vid / 6u;
  let vertInSeg = vid % 6u;

  // Top and bottom edges can cross when one side's parallelogram is
  // inverted relative to the other. Tessellate unevenly around the
  // crossing point so triangles don't overlap past the pinch.
  let topDiff = screenX1 - screenX2;
  let botDiff = screenX4 - screenX3;

  var t0: f32;
  var t1: f32;
  if (topDiff * botDiff < 0.0) {
    let tCross = clamp(topDiff / (topDiff - botDiff), 0.01, 0.99);
    var nUpper = u32(round(f32(FILL_SEGS) * tCross));
    nUpper = clamp(nUpper, 1u, FILL_SEGS - 1u);

    if (seg < nUpper) {
      t0 = f32(seg) / f32(nUpper) * tCross;
      t1 = f32(seg + 1u) / f32(nUpper) * tCross;
    } else {
      let lSeg = seg - nUpper;
      let nLower = FILL_SEGS - nUpper;
      t0 = tCross + f32(lSeg) / f32(nLower) * (1.0 - tCross);
      t1 = tCross + f32(lSeg + 1u) / f32(nLower) * (1.0 - tCross);
    }
  } else {
    t0 = f32(seg) / f32(FILL_SEGS);
    t1 = f32(seg + 1u) / f32(FILL_SEGS);
  }

  // Quad = 2 tris: (v0=t0 left, v1=t0 right, v2=t1 left) + (v3=t1 left, v4=t0 right, v5=t1 right)
  // side ∈ {0.0, 1.0} picks left/right edge; t ∈ {t0, t1} picks the segment endpoint.
  var t: f32;
  var side: f32;
  switch (vertInSeg) {
    case 0u: { t = t0; side = 0.0; }
    case 1u: { t = t0; side = 1.0; }
    case 2u: { t = t1; side = 0.0; }
    case 3u: { t = t1; side = 0.0; }
    case 4u: { t = t0; side = 1.0; }
    case 5u: { t = t1; side = 1.0; }
    default: { t = 0.0; side = 0.0; }
  }

  // Vertex sits exactly on the geometric edge — MSAA handles edge AA so
  // shared seams between adjacent CIGAR features meet crisply.
  let e = hermiteEdges(screenX1, screenX2, screenX3, screenX4, t, inst.isCurve);
  let edgeX = select(e.x, e.y, side > 0.5);
  let clipSpace = (vec2f(edgeX, e.z) / uniforms.resolution) * 2.0 - 1.0;

  out.pos = vec4f(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  var rgb = in.color.rgb;
  let isHovered = uniforms.hoveredFeatureId > 0.0 && abs(in.featureId - uniforms.hoveredFeatureId) < 0.5;
  let baseAlpha = in.color.a * uniforms.alpha;
  let finalAlpha = select(baseAlpha, min(baseAlpha * 5.0, 0.35), isHovered);
  if (isHovered) {
    rgb = rgb * 0.7;
  }
  return vec4f(rgb, finalAlpha);
}

@fragment
fn fs_picking(in: VOut) -> @location(0) vec4f {
  let id = u32(in.featureId);
  let r = f32(id & 0xFFu) / 255.0;
  let g = f32((id >> 8u) & 0xFFu) / 255.0;
  let b = f32((id >> 16u) & 0xFFu) / 255.0;
  return vec4f(r, g, b, 1.0);
}
`

export const edgeVertexShader = /* wgsl */ `
${INSTANCE_STRUCT}
${UNIFORMS_STRUCT}
${SEGMENT_CONSTS}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) dist: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${CULL_CHECK}

const STROKE_WIDTH = 1.0;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];
  var out: VOut;
  out.dist = 0.0;

  let isClicked = uniforms.clickedFeatureId > 0.0 && abs(inst.featureId - uniforms.clickedFeatureId) < 0.5;
  if (!isClicked) {
    out.pos = ${DEGENERATE};
    return out;
  }

${SCREEN_POSITIONS}

  if (isCulled(inst, screenX1, screenX2, screenX3, screenX4)) {
    out.pos = ${DEGENERATE};
    return out;
  }

  let vertsPerEdge = EDGE_SEGS * 6u;
  let edgeIdx = vid / vertsPerEdge;
  let vidInEdge = vid % vertsPerEdge;
  let seg = vidInEdge / 6u;
  let vertInSeg = vidInEdge % 6u;

  let t0 = f32(seg) / f32(EDGE_SEGS);
  let t1 = f32(seg + 1u) / f32(EDGE_SEGS);

  var t: f32;
  var side: f32;
  switch (vertInSeg) {
    case 0u: { t = t0; side = -1.0; }
    case 1u: { t = t0; side = 1.0; }
    case 2u: { t = t1; side = -1.0; }
    case 3u: { t = t1; side = -1.0; }
    case 4u: { t = t0; side = 1.0; }
    case 5u: { t = t1; side = 1.0; }
    default: { t = 0.0; side = 0.0; }
  }

  var edge0_x: f32;
  var edge1_x: f32;
  var y: f32;
  var tangent: vec2f;

  if (inst.isCurve > 0.5) {
    let s = t * t * (3.0 - 2.0 * t);
    edge0_x = mix(screenX1, screenX4, s);
    edge1_x = mix(screenX2, screenX3, s);
    y = uniforms.yTop + uniforms.height * (1.5 * t * (1.0 - t) + t * t * t);
    let sPrime = 6.0 * t * (1.0 - t);
    let dy = uniforms.height * 1.5 * (1.0 - 2.0 * t * (1.0 - t));
    let dx = select(sPrime * (screenX4 - screenX1), sPrime * (screenX3 - screenX2), edgeIdx == 1u);
    tangent = vec2f(dx, dy);
  } else {
    edge0_x = mix(screenX1, screenX4, t);
    edge1_x = mix(screenX2, screenX3, t);
    y = uniforms.yTop + t * uniforms.height;
    let dx = select(screenX4 - screenX1, screenX3 - screenX2, edgeIdx == 1u);
    tangent = vec2f(dx, uniforms.height);
  }

  let edgeX = select(edge0_x, edge1_x, edgeIdx == 1u);
  let tangentLen = length(tangent);
  var normal: vec2f;
  if (tangentLen > 0.001) {
    let rawNormal = vec2f(-tangent.y, tangent.x) / tangentLen;
    let outwardSign = select(1.0, -1.0, edgeIdx == 0u) * sign(screenX1 - screenX2);
    normal = rawNormal * outwardSign;
  } else {
    normal = vec2f(0.0, 1.0);
  }

  let pos = vec2f(edgeX, y) + normal * side * STROKE_WIDTH;
  out.dist = side * STROKE_WIDTH;
  let clipSpace = (pos / uniforms.resolution) * 2.0 - 1.0;
  out.pos = vec4f(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  let d = abs(in.dist);
  let aa = fwidth(in.dist);
  let halfW = STROKE_WIDTH * 0.5;
  let edgeAlpha = 1.0 - smoothstep(halfW - aa * 0.5, halfW + aa, d);
  return vec4f(0.0, 0.0, 0.0, edgeAlpha * 0.4);
}
`

export function interleaveInstances(data: SyntenyInstanceData) {
  const {
    x1,
    x2,
    x3,
    x4,
    colors,
    featureIds,
    isCurves,
    queryTotalLengths,
    padTops,
    padBottoms,
    instanceCount: n,
  } = data
  const buf = new ArrayBuffer(n * INSTANCE_BYTE_SIZE)
  const f = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  const stride = INSTANCE_BYTE_SIZE / 4

  for (let i = 0; i < n; i++) {
    const off = i * stride
    f[off] = x1[i]!
    f[off + 1] = x2[i]!
    f[off + 2] = x3[i]!
    f[off + 3] = x4[i]!
    u32[off + 4] = colors[i]!
    f[off + 8] = featureIds[i]!
    f[off + 9] = isCurves[i]!
    f[off + 10] = queryTotalLengths[i]!
    f[off + 11] = padTops[i]!
    f[off + 12] = padBottoms[i]!
  }
  return buf
}
