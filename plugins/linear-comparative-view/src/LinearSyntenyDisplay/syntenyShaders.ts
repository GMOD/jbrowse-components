export const INSTANCE_BYTE_SIZE = 80
export const FILL_SEGMENTS = 16
export const EDGE_SEGMENTS = 4
export const FILL_VERTS_PER_INSTANCE = FILL_SEGMENTS * 6
export const EDGE_VERTS_PER_INSTANCE = 2 * EDGE_SEGMENTS * 6

const INSTANCE_STRUCT = /* wgsl */ `
struct Instance {
  x1: vec2f, x2: vec2f, x3: vec2f, x4: vec2f,
  color: vec4f,
  featureId: f32,
  isCurve: f32,
  queryTotalLength: f32,
  padTop: f32,
  padBottom: f32,
  _pad1: f32, _pad2: f32, _pad3: f32,
}
`

const UNIFORMS_STRUCT = /* wgsl */ `
struct Uniforms {
  resolution: vec2f,
  height: f32,
  _pad0: f32,
  adjOff0: vec2f,
  adjOff1: vec2f,
  scale0: f32,
  scale1: f32,
  maxOffScreenPx: f32,
  minAlignmentLength: f32,
  alpha: f32,
  instanceCount: u32,
  fillSegments: u32,
  edgeSegments: u32,
  hoveredFeatureId: f32,
  clickedFeatureId: f32,
  _pad1u: f32,
  _pad2u: f32,
}
`

const HP_DIFF = /* wgsl */ `
fn hpDiff(a: vec2f, b: vec2f) -> f32 {
  return (a.x - b.x) + (a.y - b.y);
}
`

const SCREEN_POSITIONS = /* wgsl */ `
  let screenX1 = hpDiff(inst.x1, uniforms.adjOff0) * uniforms.scale0 - inst.padTop * (uniforms.scale0 - 1.0);
  let screenX2 = hpDiff(inst.x2, uniforms.adjOff0) * uniforms.scale0 - inst.padTop * (uniforms.scale0 - 1.0);
  let screenX3 = hpDiff(inst.x3, uniforms.adjOff1) * uniforms.scale1 - inst.padBottom * (uniforms.scale1 - 1.0);
  let screenX4 = hpDiff(inst.x4, uniforms.adjOff1) * uniforms.scale1 - inst.padBottom * (uniforms.scale1 - 1.0);
`

const HERMITE_EDGES = /* wgsl */ `
fn hermiteEdges(screenX1: f32, screenX2: f32, screenX3: f32, screenX4: f32, t: f32, isCurve: f32) -> vec3f {
  var edge0: f32;
  var edge1: f32;
  var y: f32;
  if (isCurve > 0.5) {
    let s = t * t * (3.0 - 2.0 * t);
    edge0 = mix(screenX1, screenX4, s);
    edge1 = mix(screenX2, screenX3, s);
    y = uniforms.height * (1.5 * t * (1.0 - t) + t * t * t);
  } else {
    edge0 = mix(screenX1, screenX4, t);
    edge1 = mix(screenX2, screenX3, t);
    y = t * uniforms.height;
  }
  return vec3f(edge0, edge1, y);
}
`

const CULL_CHECK = /* wgsl */ `
fn isCulled(inst: Instance) -> bool {
  if (uniforms.minAlignmentLength > 0.0 && inst.queryTotalLength < uniforms.minAlignmentLength) {
    return true;
  }
  let topX1 = hpDiff(inst.x1, uniforms.adjOff0) * uniforms.scale0 - inst.padTop * (uniforms.scale0 - 1.0);
  let topX2 = hpDiff(inst.x2, uniforms.adjOff0) * uniforms.scale0 - inst.padTop * (uniforms.scale0 - 1.0);
  let botX3 = hpDiff(inst.x3, uniforms.adjOff1) * uniforms.scale1 - inst.padBottom * (uniforms.scale1 - 1.0);
  let botX4 = hpDiff(inst.x4, uniforms.adjOff1) * uniforms.scale1 - inst.padBottom * (uniforms.scale1 - 1.0);
  let topMinX = min(topX1, topX2);
  let topMaxX = max(topX1, topX2);
  let botMinX = min(botX3, botX4);
  let botMaxX = max(botX3, botX4);
  let mOff = uniforms.maxOffScreenPx;
  let rW = uniforms.resolution.x;
  return topMaxX < -mOff || topMinX > rW + mOff || botMaxX < -mOff || botMinX > rW + mOff;
}
`

const DEGENERATE = /* wgsl */ `vec4f(0.0, 0.0, 0.0, 0.0)`

export const fillVertexShader = /* wgsl */ `
${INSTANCE_STRUCT}
${UNIFORMS_STRUCT}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) @interpolate(flat) featureId: f32,
  @location(2) dist: f32,
  @location(3) halfWidth: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${HP_DIFF}
${HERMITE_EDGES}
${CULL_CHECK}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];

  var out: VOut;
  out.color = inst.color;
  out.featureId = inst.featureId;
  out.dist = 0.0;
  out.halfWidth = 0.0;

  if (isCulled(inst)) {
    out.pos = ${DEGENERATE};
    return out;
  }

${SCREEN_POSITIONS}

  let segs = uniforms.fillSegments;
  let seg = vid / 6u;
  let vertInSeg = vid % 6u;

  let topDiff = screenX1 - screenX2;
  let botDiff = screenX4 - screenX3;

  var t0: f32;
  var t1: f32;

  if (topDiff * botDiff < 0.0) {
    let tCross = clamp(topDiff / (topDiff - botDiff), 0.01, 0.99);
    var nUpper = u32(round(f32(segs) * tCross));
    nUpper = clamp(nUpper, 1u, segs - 1u);

    if (seg < nUpper) {
      t0 = f32(seg) / f32(nUpper) * tCross;
      t1 = f32(seg + 1u) / f32(nUpper) * tCross;
    } else {
      let lSeg = seg - nUpper;
      let nLower = segs - nUpper;
      t0 = tCross + f32(lSeg) / f32(nLower) * (1.0 - tCross);
      t1 = tCross + f32(lSeg + 1u) / f32(nLower) * (1.0 - tCross);
    }
  } else {
    t0 = f32(seg) / f32(segs);
    t1 = f32(seg + 1u) / f32(segs);
  }

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

  let e = hermiteEdges(screenX1, screenX2, screenX3, screenX4, t, inst.isCurve);
  let centerX = (e.x + e.y) * 0.5;
  let halfWidth = abs(e.x - e.y) * 0.5;
  let dir = side * 2.0 - 1.0;
  let expandedHalfWidth = halfWidth + 0.5;
  let x = centerX + dir * expandedHalfWidth;

  let clipSpace = (vec2f(x, e.z) / uniforms.resolution) * 2.0 - 1.0;

  out.pos = vec4f(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  out.dist = dir * expandedHalfWidth;
  out.halfWidth = halfWidth;
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  var rgb = in.color.rgb;
  if (uniforms.hoveredFeatureId > 0.0 && abs(in.featureId - uniforms.hoveredFeatureId) < 0.5) {
    rgb = rgb * 0.7;
  }
  let coverage = saturate(in.halfWidth + 0.5 - abs(in.dist));
  return vec4f(rgb, in.color.a * uniforms.alpha * coverage);
}

@fragment
fn fs_picking(in: VOut) -> @location(0) vec4f {
  if (abs(in.dist) > in.halfWidth) { discard; }
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

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) dist: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${HP_DIFF}
${CULL_CHECK}

const STROKE_WIDTH = 1.0;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];
  var out: VOut;
  out.dist = 0.0;

  let isClicked = uniforms.clickedFeatureId > 0.0 && abs(inst.featureId - uniforms.clickedFeatureId) < 0.5;
  if (!isClicked || isCulled(inst)) {
    out.pos = ${DEGENERATE};
    return out;
  }

${SCREEN_POSITIONS}

  let segs = uniforms.edgeSegments;
  let vertsPerEdge = segs * 6u;
  let edgeIdx = vid / vertsPerEdge;
  let vidInEdge = vid % vertsPerEdge;
  let seg = vidInEdge / 6u;
  let vertInSeg = vidInEdge % 6u;

  let t0 = f32(seg) / f32(segs);
  let t1 = f32(seg + 1u) / f32(segs);

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
    y = uniforms.height * (1.5 * t * (1.0 - t) + t * t * t);
    let sPrime = 6.0 * t * (1.0 - t);
    let dy = uniforms.height * 1.5 * (1.0 - 2.0 * t * (1.0 - t));
    let dx = select(sPrime * (screenX4 - screenX1), sPrime * (screenX3 - screenX2), edgeIdx == 1u);
    tangent = vec2f(dx, dy);
  } else {
    edge0_x = mix(screenX1, screenX4, t);
    edge1_x = mix(screenX2, screenX3, t);
    y = t * uniforms.height;
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

  var pos = vec2f(edgeX, y) + normal * side * STROKE_WIDTH;
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
