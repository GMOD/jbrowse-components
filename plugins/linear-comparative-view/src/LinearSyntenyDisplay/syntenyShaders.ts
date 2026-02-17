export const INSTANCE_BYTE_SIZE = 80
export const FILL_SEGMENTS = 16
export const EDGE_SEGMENTS = 8
export const FILL_VERTS_PER_INSTANCE = FILL_SEGMENTS * 6
export const EDGE_VERTS_PER_INSTANCE = (EDGE_SEGMENTS + 1) * 2

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

const FS_PICKING = /* wgsl */ `
@fragment
fn fs_picking(in: VOut) -> @location(0) vec4f {
  let id = u32(in.featureId);
  let r = f32(id & 0xFFu) / 255.0;
  let g = f32((id >> 8u) & 0xFFu) / 255.0;
  let b = f32((id >> 16u) & 0xFFu) / 255.0;
  return vec4f(r, g, b, 1.0);
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
  let x = centerX + (side * 2.0 - 1.0) * halfWidth;

  let clipSpace = (vec2f(x, e.z) / uniforms.resolution) * 2.0 - 1.0;

  out.pos = vec4f(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  return vec4f(in.color.rgb, in.color.a * uniforms.alpha);
}

${FS_PICKING}
`

export const edgeVertexShader = /* wgsl */ `
${INSTANCE_STRUCT}
${UNIFORMS_STRUCT}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) dist: f32,
  @location(2) @interpolate(flat) featureId: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${HP_DIFF}
${CULL_CHECK}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];

  let segs = uniforms.edgeSegments;
  let segIdx = vid / 2u;
  let sideIdx = vid % 2u;
  let t = f32(segIdx) / f32(segs);
  let side = select(1.0, -1.0, sideIdx == 1u);

  var out: VOut;
  out.color = inst.color;
  out.featureId = inst.featureId;
  out.dist = side;

  if (isCulled(inst)) {
    out.pos = ${DEGENERATE};
    return out;
  }

${SCREEN_POSITIONS}

  let topDiff = screenX1 - screenX2;
  let botDiff = screenX4 - screenX3;

  if (topDiff * botDiff < 0.0) {
    out.pos = vec4f(2.0, 2.0, 2.0, 1.0);
    return out;
  }

  let sideStep = step(0.0, side);

  var pos: vec2f;
  var tangent: vec2f;

  if (inst.isCurve > 0.5) {
    let s = t * t * (3.0 - 2.0 * t);
    let edge0_x = mix(screenX1, screenX4, s);
    let edge1_x = mix(screenX2, screenX3, s);

    let centerX = (edge0_x + edge1_x) * 0.5;
    let halfWidth = abs(edge0_x - edge1_x) * 0.5;

    let px = centerX + (sideStep * 2.0 - 1.0) * halfWidth;
    let py = uniforms.height * (1.5 * t * (1.0 - t) + t * t * t);
    pos = vec2f(px, py);

    let sPrime = 6.0 * t * (1.0 - t);
    let edge0_dx = sPrime * (screenX4 - screenX1);
    let edge1_dx = sPrime * (screenX3 - screenX2);
    let centerDx = (edge0_dx + edge1_dx) * 0.5;
    let halfWidthDx = abs(edge0_dx - edge1_dx) * 0.5 * sign(edge0_x - edge1_x);

    let dx = centerDx + (sideStep * 2.0 - 1.0) * halfWidthDx;
    let dy = uniforms.height * 1.5 * (1.0 - 2.0 * t * (1.0 - t));
    tangent = vec2f(dx, dy);
  } else {
    let edge0_x = mix(screenX1, screenX4, t);
    let edge1_x = mix(screenX2, screenX3, t);

    let centerX = (edge0_x + edge1_x) * 0.5;
    let halfWidth = abs(edge0_x - edge1_x) * 0.5;

    let px = centerX + (sideStep * 2.0 - 1.0) * halfWidth;
    pos = vec2f(px, t * uniforms.height);

    let edge0_dx = screenX4 - screenX1;
    let edge1_dx = screenX3 - screenX2;
    let dx = (edge0_dx + edge1_dx) * 0.5 + (sideStep * 2.0 - 1.0) * abs(edge0_dx - edge1_dx) * 0.5;
    tangent = vec2f(dx, uniforms.height);
  }

  let tangentLen = length(tangent);
  var normal: vec2f;
  if (tangentLen > 0.001) {
    normal = vec2f(-tangent.y, tangent.x) / tangentLen;
  } else {
    normal = vec2f(0.0, 1.0);
  }

  pos += normal * side;

  let clipSpace = (pos / uniforms.resolution) * 2.0 - 1.0;
  out.pos = vec4f(clipSpace.x, -clipSpace.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  let halfWidth = 0.5;
  let d = abs(in.dist);
  let aa = fwidth(in.dist);
  let edgeAlpha = 1.0 - smoothstep(halfWidth - aa * 0.5, halfWidth + aa, d);
  return vec4f(in.color.rgb, in.color.a * uniforms.alpha * edgeAlpha);
}
`
