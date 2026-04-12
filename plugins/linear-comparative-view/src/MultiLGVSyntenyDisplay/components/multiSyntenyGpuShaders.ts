import {
  HP_GLSL_CORE,
  HP_WGSL_CORE,
  PICKING_FS_WGSL,
} from '@jbrowse/alignments-core'

// SYNC: instance struct field order must match InstanceBuilder usage
// in multiSyntenyGpuData.ts. 32 bytes per instance.
export const INSTANCE_BYTE_SIZE = 32

// Coverage bin: 12 bytes per bin (position: f32, minDepth: f32, maxDepth: f32)
export const COVERAGE_BIN_BYTE_SIZE = 12

// SYNC: uniform field order must match fillSyntenyUniforms() in multiSyntenyGpuUtils.ts
export const UNIFORM_BYTE_SIZE = 112

// Shared GLSL uniform block used by both synteny and coverage shaders
const UNIFORMS_GLSL = `
// SYNC: field order must match fillSyntenyUniforms() in multiSyntenyGpuUtils.ts
layout(std140) uniform Uniforms {
  float resolutionX;
  float resolutionY;
  float rowHeight;
  float coverageHeight;       // height in pixels for coverage area (0 = no coverage)
  float bpRangeHi;
  float bpRangeLo;
  float bpRangeLen;
  float regionScreenLeft;
  float regionScreenWidth;
  float hpZero;               // must be 0.0 at runtime — compiler guard
  float rowPadding;
  float coverageYOffset;      // padding at top/bottom for scalebar labels
  float depthScale;           // maxDepth / nicedMax correction
  float coverageR;            // coverage bar color RGB (from theme)
  float coverageG;
  float coverageB;
  float baseAR; float baseAG; float baseAB;
  float baseCR; float baseCG; float baseCB;
  float baseGR; float baseGG; float baseGB;
  float baseTR; float baseTG; float baseTB;
} u;
`

export const FILL_VERTEX_SHADER = `#version 300 es
precision highp float;
precision highp int;

// Per-instance data (divisor = 1)
in uvec4 a_data0;  // (startBp, endBp, genomeRow, featureId)
in uint a_color;   // packed ABGR uint32

${UNIFORMS_GLSL}

smooth out vec4 v_color;
flat out float v_featureId;

${HP_GLSL_CORE}

void main() {
  uint startBp = a_data0.x;
  uint endBp = a_data0.y;
  uint genomeRow = a_data0.z;

  vec2 splitStart = hpSplitUint(startBp);
  vec2 splitEnd = hpSplitUint(endBp);

  vec3 bpRange = vec3(u.bpRangeHi, u.bpRangeLo, u.bpRangeLen);
  float t1 = hpScaleLinear(splitStart, bpRange, u.hpZero);
  float t2 = hpScaleLinear(splitEnd, bpRange, u.hpZero);

  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;

  // Ensure minimum 1px width so sub-pixel features don't flicker during pan/zoom
  px2 = max(px2, px1 + 1.0);

  // Cull off-screen features
  if (px2 < 0.0 || px1 > u.resolutionX) {
    gl_Position = vec4(0.0);
    return;
  }

  // Clamp to left edge
  px1 = max(px1, 0.0);

  float pad = u.rowPadding;
  float y1 = u.coverageHeight + float(genomeRow) * u.rowHeight + pad;
  float y2 = y1 + u.rowHeight - pad * 2.0;

  uint vid = uint(gl_VertexID) % 6u;
  float x, y;
  switch (vid) {
    case 0u: x = px1; y = y1; break;
    case 1u: x = px2; y = y1; break;
    case 2u: x = px1; y = y2; break;
    case 3u: x = px1; y = y2; break;
    case 4u: x = px2; y = y1; break;
    case 5u: x = px2; y = y2; break;
    default: x = 0.0; y = 0.0; break;
  }

  vec2 clipPos = vec2(x, y) / vec2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
  v_color = vec4(
    float(a_color & 0xFFu),
    float((a_color >> 8u) & 0xFFu),
    float((a_color >> 16u) & 0xFFu),
    float(a_color >> 24u)
  ) / 255.0;
  v_featureId = float(a_data0.w);
}
`

// Coverage vertex shader - renders min/max band bars in the coverage area.
// Each instance is one coverage bin with (position, minDepth, maxDepth) attributes.
// When zoomed in (no downsampling), minDepth == 0 and maxDepth == depth,
// producing bars from baseline to depth (same as before).
// When downsampled, the band from minDepth to maxDepth preserves peaks and valleys.
// SYNC: attribute layout matches coverage buffer in multiSyntenyGpuData.ts
export const COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

in float a_position;    // bin position offset from region start (bp)
in float a_minDepth;    // normalized min depth in bin (0-1)
in float a_maxDepth;    // normalized max depth in bin (0-1)

${UNIFORMS_GLSL}

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float blockStart = u.bpRangeHi + u.bpRangeLo;
  float t1 = (a_position - blockStart) / u.bpRangeLen;
  float t2 = (a_position + 1.0 - blockStart) / u.bpRangeLen;
  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;

  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > u.resolutionX) {
    gl_Position = vec4(0.0);
    return;
  }

  float sx = mix(px1, px2, localX);

  float effectiveHeight = u.coverageHeight - 2.0 * u.coverageYOffset;
  float coverageBottom = u.coverageHeight - u.coverageYOffset;
  float bandBottom = coverageBottom - a_minDepth * u.depthScale * effectiveHeight;
  float bandTop = coverageBottom - a_maxDepth * u.depthScale * effectiveHeight;
  float sy = mix(bandBottom, bandTop, localY);

  vec2 clipPos = vec2(sx, sy) / vec2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
  v_color = vec4(u.coverageR, u.coverageG, u.coverageB, 1.0);
}
`

// --- WGSL shaders for WebGPU ---

// SYNC: struct Instance field order must match InstanceBuilder usage
const INSTANCE_STRUCT_WGSL = `
struct Instance {
  startBp: u32,
  endBp: u32,
  genomeRow: u32,
  featureId: u32,
  color: u32,
  _pad0: u32, _pad1: u32, _pad2: u32,
}
`

// SYNC: struct Uniforms field order must match fillSyntenyUniforms() in multiSyntenyGpuUtils.ts
const UNIFORMS_STRUCT_WGSL = `
struct Uniforms {
  resolutionX: f32,
  resolutionY: f32,
  rowHeight: f32,
  coverageHeight: f32,
  bpRangeHi: f32,
  bpRangeLo: f32,
  bpRangeLen: f32,
  regionScreenLeft: f32,
  regionScreenWidth: f32,
  hpZero: f32,
  rowPadding: f32,
  coverageYOffset: f32,
  depthScale: f32,
  coverageR: f32,
  coverageG: f32,
  coverageB: f32,
  baseAR: f32, baseAG: f32, baseAB: f32,
  baseCR: f32, baseCG: f32, baseCB: f32,
  baseGR: f32, baseGG: f32, baseGB: f32,
  baseTR: f32, baseTG: f32, baseTB: f32,
}
`

export const WGSL_FILL_SHADER = `
${INSTANCE_STRUCT_WGSL}
${UNIFORMS_STRUCT_WGSL}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
  @location(1) @interpolate(flat) featureId: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<Instance>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

${HP_WGSL_CORE}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VOut {
  let inst = instances[iid];
  var out: VOut;
  out.color = unpack4x8unorm(inst.color);
  out.featureId = f32(inst.featureId);

  let splitStart = hp_split_uint(inst.startBp);
  let splitEnd = hp_split_uint(inst.endBp);

  let bpRange = vec3f(uniforms.bpRangeHi, uniforms.bpRangeLo, uniforms.bpRangeLen);
  let t1 = hp_scale_linear(splitStart, bpRange, uniforms.hpZero);
  let t2 = hp_scale_linear(splitEnd, bpRange, uniforms.hpZero);

  var px1 = uniforms.regionScreenLeft + t1 * uniforms.regionScreenWidth;
  var px2 = uniforms.regionScreenLeft + t2 * uniforms.regionScreenWidth;

  // Ensure minimum 1px width so sub-pixel features don't flicker during pan/zoom
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > uniforms.resolutionX) {
    out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  px1 = max(px1, 0.0);

  let pad = uniforms.rowPadding;
  let y1 = uniforms.coverageHeight + f32(inst.genomeRow) * uniforms.rowHeight + pad;
  let y2 = y1 + uniforms.rowHeight - pad * 2.0;

  let v = vid % 6u;
  let x = select(px2, px1, v == 0u || v == 2u || v == 3u);
  let y = select(y2, y1, v == 0u || v == 1u || v == 4u);

  let clipPos = vec2f(x, y) / vec2f(uniforms.resolutionX, uniforms.resolutionY) * 2.0 - 1.0;
  out.pos = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: VOut) -> @location(0) vec4f {
  return in.color;
}

${PICKING_FS_WGSL}
`

// WGSL coverage shader - min/max band rendering
export const WGSL_COVERAGE_SHADER = `
${UNIFORMS_STRUCT_WGSL}

struct CovBin {
  position: f32,
  minDepth: f32,
  maxDepth: f32,
}

struct CovVOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<storage, read> bins: array<CovBin>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> CovVOut {
  let bin = bins[iid];
  var out: CovVOut;
  out.color = vec4f(uniforms.coverageR, uniforms.coverageG, uniforms.coverageB, 1.0);

  let v = vid % 6u;
  let localX = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let localY = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let blockStart = uniforms.bpRangeHi + uniforms.bpRangeLo;
  let t1 = (bin.position - blockStart) / uniforms.bpRangeLen;
  let t2 = (bin.position + 1.0 - blockStart) / uniforms.bpRangeLen;
  var px1 = uniforms.regionScreenLeft + t1 * uniforms.regionScreenWidth;
  var px2 = uniforms.regionScreenLeft + t2 * uniforms.regionScreenWidth;
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > uniforms.resolutionX) {
    out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  let sx = mix(px1, px2, localX);
  let effectiveHeight = uniforms.coverageHeight - 2.0 * uniforms.coverageYOffset;
  let coverageBottom = uniforms.coverageHeight - uniforms.coverageYOffset;
  let bandBottom = coverageBottom - bin.minDepth * uniforms.depthScale * effectiveHeight;
  let bandTop = coverageBottom - bin.maxDepth * uniforms.depthScale * effectiveHeight;
  let sy = mix(bandBottom, bandTop, localY);

  let clipPos = vec2f(sx, sy) / vec2f(uniforms.resolutionX, uniforms.resolutionY) * 2.0 - 1.0;
  out.pos = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
  return out;
}

@fragment
fn fs_main(in: CovVOut) -> @location(0) vec4f {
  return in.color;
}
`

const SNP_COLORS_GLSL = `
vec3 snpColor(float ct) {
  int ci = int(ct);
  if (ci == 1) return vec3(u.baseAR, u.baseAG, u.baseAB);
  else if (ci == 2) return vec3(u.baseCR, u.baseCG, u.baseCB);
  else if (ci == 3) return vec3(u.baseGR, u.baseGG, u.baseGB);
  else return vec3(u.baseTR, u.baseTG, u.baseTB);
}
`

// GLSL SNP coverage shader - colored segments on top of grey coverage
export const GLSL_SNP_COVERAGE_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in float a_position;  // absolute genome coordinate
layout(location = 1) in float a_yOffset;   // normalized y offset (0-1)
layout(location = 2) in float a_height;    // normalized segment height
layout(location = 3) in float a_colorType; // 1=A, 2=C, 3=G, 4=T

${UNIFORMS_GLSL}

out vec4 v_color;

${SNP_COLORS_GLSL}

void main() {
  int vid = gl_VertexID % 6;
  float localX = (vid == 0 || vid == 2 || vid == 3) ? 0.0 : 1.0;
  float localY = (vid == 0 || vid == 1 || vid == 4) ? 0.0 : 1.0;

  float blockStart = u.bpRangeHi + u.bpRangeLo;
  float t1 = (a_position - blockStart) / u.bpRangeLen;
  float t2 = (a_position + 1.0 - blockStart) / u.bpRangeLen;
  float px1 = u.regionScreenLeft + t1 * u.regionScreenWidth;
  float px2 = u.regionScreenLeft + t2 * u.regionScreenWidth;
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > u.resolutionX) {
    gl_Position = vec4(0.0);
    return;
  }

  float sx = mix(px1, px2, localX);
  float effectiveHeight = u.coverageHeight - 2.0 * u.coverageYOffset;
  float coverageBottom = u.coverageHeight - u.coverageYOffset;
  float segBottom = coverageBottom - a_yOffset * u.depthScale * effectiveHeight;
  float segTop = segBottom - a_height * u.depthScale * effectiveHeight;
  float sy = mix(segBottom, segTop, localY);

  vec2 clipPos = vec2(sx, sy) / vec2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);
  v_color = vec4(snpColor(a_colorType), 1.0);
}
`

// WGSL SNP coverage shader - colored segments on top of grey coverage
export const WGSL_SNP_COVERAGE_SHADER = `
${UNIFORMS_STRUCT_WGSL}

struct SnpSegment {
  position: f32,
  yOffset: f32,
  segHeight: f32,
  colorType: f32,
}

struct SnpVOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<storage, read> segments: array<SnpSegment>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

fn snpColor(ct: f32) -> vec3f {
  let ci = i32(ct);
  if ci == 1 { return vec3f(uniforms.baseAR, uniforms.baseAG, uniforms.baseAB); }
  else if ci == 2 { return vec3f(uniforms.baseCR, uniforms.baseCG, uniforms.baseCB); }
  else if ci == 3 { return vec3f(uniforms.baseGR, uniforms.baseGG, uniforms.baseGB); }
  else { return vec3f(uniforms.baseTR, uniforms.baseTG, uniforms.baseTB); }
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> SnpVOut {
  let seg = segments[iid];
  var out: SnpVOut;

  let v = vid % 6u;
  let localX = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let localY = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let blockStart = uniforms.bpRangeHi + uniforms.bpRangeLo;
  let t1 = (seg.position - blockStart) / uniforms.bpRangeLen;
  let t2 = (seg.position + 1.0 - blockStart) / uniforms.bpRangeLen;
  var px1 = uniforms.regionScreenLeft + t1 * uniforms.regionScreenWidth;
  var px2 = uniforms.regionScreenLeft + t2 * uniforms.regionScreenWidth;
  px2 = max(px2, px1 + 1.0);

  if (px2 < 0.0 || px1 > uniforms.resolutionX) {
    out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  let sx = mix(px1, px2, localX);
  let effectiveHeight = uniforms.coverageHeight - 2.0 * uniforms.coverageYOffset;
  let coverageBottom = uniforms.coverageHeight - uniforms.coverageYOffset;
  let segBottom = coverageBottom - seg.yOffset * uniforms.depthScale * effectiveHeight;
  let segTop = segBottom - seg.segHeight * uniforms.depthScale * effectiveHeight;
  let sy = mix(segBottom, segTop, localY);

  let clipPos = vec2f(sx, sy) / vec2f(uniforms.resolutionX, uniforms.resolutionY) * 2.0 - 1.0;
  out.pos = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
  out.color = vec4f(snpColor(seg.colorType), 1.0);
  return out;
}

@fragment
fn fs_main(in: SnpVOut) -> @location(0) vec4f {
  return in.color;
}
`

// GLSL indicator shader - insertion triangles at top of coverage area
export const GLSL_INDICATOR_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in float a_position;  // absolute genome coordinate

${UNIFORMS_GLSL}

out vec4 v_color;

void main() {
  int vid = gl_VertexID % 3;
  float blockStart = u.bpRangeHi + u.bpRangeLo;
  float t = (a_position - blockStart) / u.bpRangeLen;
  float cx = u.regionScreenLeft + t * u.regionScreenWidth;

  if (cx < -4.0 || cx > u.resolutionX + 4.0) {
    gl_Position = vec4(0.0);
    return;
  }

  float hw = 3.5;
  float th = 4.5;
  float sx, sy;
  if (vid == 0) { sx = cx - hw; sy = 0.0; }
  else if (vid == 1) { sx = cx + hw; sy = 0.0; }
  else { sx = cx; sy = th; }

  vec2 clipPos = vec2(sx, sy) / vec2(u.resolutionX, u.resolutionY) * 2.0 - 1.0;
  gl_Position = vec4(clipPos.x, -clipPos.y, 0.0, 1.0);

  // Insertion color (purple) — matches theme insertion color
  v_color = vec4(0.71, 0.0, 0.71, 1.0);
}
`

// WGSL indicator shader
export const WGSL_INDICATOR_SHADER = `
${UNIFORMS_STRUCT_WGSL}

struct Indicator {
  position: f32,
}

struct IndVOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
}

@group(0) @binding(0) var<storage, read> indicators: array<Indicator>;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> IndVOut {
  let ind = indicators[iid];
  var out: IndVOut;

  let blockStart = uniforms.bpRangeHi + uniforms.bpRangeLo;
  let t = (ind.position - blockStart) / uniforms.bpRangeLen;
  let cx = uniforms.regionScreenLeft + t * uniforms.regionScreenWidth;

  if (cx < -4.0 || cx > uniforms.resolutionX + 4.0) {
    out.pos = vec4f(0.0, 0.0, 0.0, 0.0);
    return out;
  }

  let hw = 3.5;
  let th = 4.5;
  let v = vid % 3u;
  var sx: f32;
  var sy: f32;
  if v == 0u { sx = cx - hw; sy = 0.0; }
  else if v == 1u { sx = cx + hw; sy = 0.0; }
  else { sx = cx; sy = th; }

  let clipPos = vec2f(sx, sy) / vec2f(uniforms.resolutionX, uniforms.resolutionY) * 2.0 - 1.0;
  out.pos = vec4f(clipPos.x, -clipPos.y, 0.0, 1.0);
  out.color = vec4f(0.71, 0.0, 0.71, 1.0);
  return out;
}

@fragment
fn fs_main(in: IndVOut) -> @location(0) vec4f {
  return in.color;
}
`

export {
  PICKING_FS_GLSL as PICKING_FRAGMENT_SHADER,
  SIMPLE_FS_GLSL as FILL_FRAGMENT_SHADER,
} from '@jbrowse/alignments-core'
