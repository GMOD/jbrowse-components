import { PREAMBLE, SIMPLE_FS, SIMPLE_VERTEX_OUTPUT } from './common.ts'

const COV_PREAMBLE = PREAMBLE + SIMPLE_VERTEX_OUTPUT

const COV_DOMAIN = `
fn vis_range() -> vec2f { return vec2f(uf(30u), uf(31u)); }
fn vis_range_len() -> f32 { return uf(31u) - uf(30u); }
fn cov_height() -> f32 { return uf(16u); }
fn cov_y_offset() -> f32 { return uf(17u); }
fn depth_scale() -> f32 { return uf(18u); }
fn eff_height() -> f32 { return cov_height() - 2.0 * cov_y_offset(); }
fn cov_bottom() -> f32 { return 1.0 - ((cov_height() - cov_y_offset()) / canvas_height()) * 2.0; }
`

export const COVERAGE_WGSL = `
${COV_PREAMBLE}
${COV_DOMAIN}

struct CovInst { position: f32, depth: f32 }
@group(0) @binding(0) var<storage, read> instances: array<CovInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let dw = vis_range_len();
  let vr = vis_range();
  var x1 = (inst.position - vr.x) / dw * 2.0 - 1.0;
  var x2 = (inst.position + uf(19u) - vr.x) / dw * 2.0 - 1.0;
  let min_w = 2.0 / canvas_width();
  if x2 - x1 < min_w { let m = (x1+x2)*0.5; x1 = m - min_w*0.5; x2 = m + min_w*0.5; }

  let bar_top = cov_bottom() + (inst.depth * depth_scale() * eff_height() / canvas_height()) * 2.0;
  out.position = vec4f(mix(x1, x2, lx), mix(cov_bottom(), bar_top, ly), 0.0, 1.0);
  out.color = vec4f(color3(80u), 1.0);
  return out;
}

${SIMPLE_FS}
`

export const SNP_COVERAGE_WGSL = `
${COV_PREAMBLE}
${COV_DOMAIN}

struct SnpCovInst { position: f32, y_offset: f32, seg_height: f32, color_type: f32 }
@group(0) @binding(0) var<storage, read> instances: array<SnpCovInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let dw = vis_range_len();
  let vr = vis_range();
  var x1 = (inst.position - vr.x) / dw * 2.0 - 1.0;
  var x2 = (inst.position + 1.0 - vr.x) / dw * 2.0 - 1.0;
  let min_w = 2.0 / canvas_width();
  if x2 - x1 < min_w { let m = (x1+x2)*0.5; x1 = m - min_w*0.5; x2 = m + min_w*0.5; }

  let s_bot = cov_bottom() + (inst.y_offset * depth_scale() * eff_height() / canvas_height()) * 2.0;
  let s_top = s_bot + (inst.seg_height * depth_scale() * eff_height() / canvas_height()) * 2.0;
  out.position = vec4f(mix(x1, x2, lx), mix(s_bot, s_top, ly), 0.0, 1.0);

  let ci = i32(inst.color_type);
  var c: vec3f;
  if ci == 1 { c = color3(53u); }
  else if ci == 2 { c = color3(56u); }
  else if ci == 3 { c = color3(59u); }
  else { c = color3(62u); }
  out.color = vec4f(c, 1.0);
  return out;
}

${SIMPLE_FS}
`

export const MOD_COVERAGE_WGSL = `
${COV_PREAMBLE}
${COV_DOMAIN}

struct ModCovInst { position: f32, y_offset: f32, seg_height: f32, packed_color: u32 }
@group(0) @binding(0) var<storage, read> instances: array<ModCovInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let dw = vis_range_len();
  let vr = vis_range();
  var x1 = (inst.position - vr.x) / dw * 2.0 - 1.0;
  var x2 = (inst.position + 1.0 - vr.x) / dw * 2.0 - 1.0;
  let min_w = 2.0 / canvas_width();
  if x2 - x1 < min_w { let m = (x1+x2)*0.5; x1 = m - min_w*0.5; x2 = m + min_w*0.5; }

  let s_bot = cov_bottom() + (inst.y_offset * depth_scale() * eff_height() / canvas_height()) * 2.0;
  let s_top = s_bot + (inst.seg_height * depth_scale() * eff_height() / canvas_height()) * 2.0;
  out.position = vec4f(mix(x1, x2, lx), mix(s_bot, s_top, ly), 0.0, 1.0);

  let pc = inst.packed_color;
  out.color = vec4f(
    f32(pc & 0xFFu) / 255.0, f32((pc >> 8u) & 0xFFu) / 255.0,
    f32((pc >> 16u) & 0xFFu) / 255.0, f32((pc >> 24u) & 0xFFu) / 255.0,
  );
  return out;
}

${SIMPLE_FS}
`

export const NONCOV_HISTOGRAM_WGSL = `
${COV_PREAMBLE}

fn vis_range() -> vec2f { return vec2f(uf(30u), uf(31u)); }
fn vis_range_len() -> f32 { return uf(31u) - uf(30u); }

struct NoncovInst { position: f32, y_offset: f32, seg_height: f32, color_type: f32 }
@group(0) @binding(0) var<storage, read> instances: array<NoncovInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let dw = vis_range_len();
  let vr = vis_range();
  let cx = (inst.position - vr.x) / dw * 2.0 - 1.0;
  let bar_w = 1.0 / canvas_width() * 2.0;

  let noncov_h = uf(20u);
  let ind_off = 4.5 / canvas_height() * 2.0;
  let s_top = 1.0 - ind_off - (inst.y_offset * noncov_h / canvas_height()) * 2.0;
  let s_bot = s_top - (inst.seg_height * noncov_h / canvas_height()) * 2.0;

  out.position = vec4f(mix(cx - bar_w*0.5, cx + bar_w*0.5, lx), mix(s_bot, s_top, ly), 0.0, 1.0);

  let ci = i32(inst.color_type);
  var c: vec3f;
  if ci == 1 { c = color3(65u); }
  else if ci == 2 { c = color3(74u); }
  else { c = color3(77u); }
  out.color = vec4f(c, 1.0);
  return out;
}

${SIMPLE_FS}
`

export const INDICATOR_WGSL = `
${COV_PREAMBLE}

fn vis_range() -> vec2f { return vec2f(uf(30u), uf(31u)); }
fn vis_range_len() -> f32 { return uf(31u) - uf(30u); }

struct IndicatorInst { position: f32, color_type: f32 }
@group(0) @binding(0) var<storage, read> instances: array<IndicatorInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 3u;

  let dw = vis_range_len();
  let vr = vis_range();
  let cx = (inst.position - vr.x) / dw * 2.0 - 1.0;
  let tw = 7.0 / canvas_width() * 2.0;
  let th = 4.5 / canvas_height() * 2.0;

  var sx: f32; var sy: f32;
  if v == 0u { sx = cx - tw * 0.5; sy = 1.0; }
  else if v == 1u { sx = cx + tw * 0.5; sy = 1.0; }
  else { sx = cx; sy = 1.0 - th; }

  out.position = vec4f(sx, sy, 0.0, 1.0);
  let ci = i32(inst.color_type);
  var c: vec3f;
  if ci == 1 { c = color3(65u); }
  else if ci == 2 { c = color3(74u); }
  else { c = color3(77u); }
  out.color = vec4f(c, 1.0);
  return out;
}

${SIMPLE_FS}
`

export const SEPARATOR_LINE_WGSL = `
${PREAMBLE}
${SIMPLE_VERTEX_OUTPUT}

struct LineVert { x: f32, y: f32 }
@group(0) @binding(0) var<storage, read> verts: array<LineVert>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
  var out: VertexOutput;
  let v = verts[vid];
  out.position = vec4f(v.x, v.y, 0.0, 1.0);
  out.color = vec4f(uf(0u), uf(1u), uf(2u), uf(3u));
  return out;
}

${SIMPLE_FS}
`
