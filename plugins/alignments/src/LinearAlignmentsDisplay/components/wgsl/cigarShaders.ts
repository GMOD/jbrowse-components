import {
  PILEUP_Y,
  PREAMBLE,
  SIMPLE_FS,
  SIMPLE_VERTEX_OUTPUT,
} from './common.ts'
import {
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
} from '../../constants.ts'

const CIGAR_PREAMBLE = PREAMBLE + PILEUP_Y + SIMPLE_VERTEX_OUTPUT

const CIGAR_DOMAIN = `
fn cigar_domain() -> vec2f { return vec2f(uf(30u), uf(31u)); }
fn cigar_domain_len() -> f32 { return uf(31u) - uf(30u); }
`

export const GAP_WGSL = `
${CIGAR_PREAMBLE}
${CIGAR_DOMAIN}

struct GapInst { start_off: u32, end_off: u32, y: u32, gap_type: u32, frequency: f32 }
@group(0) @binding(0) var<storage, read> instances: array<GapInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let erase = ui(23u);

  if erase == 1 && inst.gap_type == 0u {
    out.position = vec4f(0.0); out.color = vec4f(0.0); return out;
  }

  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let domain_len = cigar_domain_len();
  let domain = cigar_domain();
  let sx1 = (f32(inst.start_off) - domain.x) / domain_len * 2.0 - 1.0;
  let sx2 = (f32(inst.end_off) - domain.x) / domain_len * 2.0 - 1.0;

  let yy = pileup_y(f32(inst.y));
  var y_top = yy.x;
  var y_bot = yy.y;

  if erase == 0 && inst.gap_type == 1u {
    let mid = (y_top + y_bot) * 0.5;
    let one_px = 2.0 / canvas_height();
    y_top = mid; y_bot = mid - one_px;
  }

  let sx = mix(sx1, sx2, lx);
  let sy = mix(y_bot, y_top, ly);
  out.position = vec4f(sx, sy, 0.0, 1.0);

  var alpha = 1.0;
  if inst.gap_type == 0u {
    let width_px = f32(inst.end_off - inst.start_off) * canvas_width() / domain_len;
    if width_px < 1.0 && inst.frequency == 0.0 { alpha = width_px * width_px; }
  }
  let c = select(color3(71u), color3(68u), inst.gap_type == 0u);
  out.color = vec4f(c, alpha);
  return out;
}

${SIMPLE_FS}
`

export const MISMATCH_WGSL = `
${CIGAR_PREAMBLE}
${CIGAR_DOMAIN}

struct MismatchInst { position: u32, y: u32, base: u32, frequency: f32 }
@group(0) @binding(0) var<storage, read> instances: array<MismatchInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let domain_len = cigar_domain_len();
  let domain = cigar_domain();
  let pos = f32(inst.position);
  let px_per_bp = canvas_width() / domain_len;

  var alpha = 1.0;
  if px_per_bp < 1.0 && inst.frequency == 0.0 { alpha = px_per_bp; }
  if alpha <= 0.0 { out.position = vec4f(0.0); out.color = vec4f(0.0); return out; }

  var px1 = (pos - domain.x) / domain_len * canvas_width();
  var px2 = (pos + 1.0 - domain.x) / domain_len * canvas_width();
  px1 = floor(px1);
  px2 = max(px1 + 1.0, floor(px2));
  let sx1 = px1 / canvas_width() * 2.0 - 1.0;
  let sx2 = px2 / canvas_width() * 2.0 - 1.0;
  let sx = mix(sx1, sx2, lx);

  let yy = pileup_y(f32(inst.y));
  let sy = mix(yy.y, yy.x, ly);
  out.position = vec4f(sx, sy, 0.0, 1.0);

  var c: vec3f;
  let b = inst.base;
  if b == 65u || b == 97u { c = color3(53u); }
  else if b == 67u || b == 99u { c = color3(56u); }
  else if b == 71u || b == 103u { c = color3(59u); }
  else if b == 84u || b == 116u { c = color3(62u); }
  else { c = vec3f(0.5); }
  out.color = vec4f(c, alpha);
  return out;
}

${SIMPLE_FS}
`

export const INSERTION_WGSL = `
${CIGAR_PREAMBLE}
${CIGAR_DOMAIN}

struct InsertionInst { position: u32, y: u32, length: u32, frequency: f32 }
@group(0) @binding(0) var<storage, read> instances: array<InsertionInst>;

fn text_width(num: u32) -> f32 {
  let cw = 6.0; let pad = 10.0;
  if num < 10u { return cw + pad; }
  if num < 100u { return cw * 2.0 + pad; }
  if num < 1000u { return cw * 3.0 + pad; }
  if num < 10000u { return cw * 4.0 + pad; }
  return cw * 5.0 + pad;
}

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];

  let rect_idx = vid / 6u;
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let domain_len = cigar_domain_len();
  let domain = cigar_domain();
  let pos = f32(inst.position);
  let bp_per_px = domain_len / canvas_width();
  let px_per_bp = 1.0 / bp_per_px;
  let cx = (pos - domain.x) / domain_len * 2.0 - 1.0;

  let is_long = inst.length >= ${LONG_INSERTION_MIN_LENGTH}u;
  let ins_w_px = f32(inst.length) * px_per_bp;
  let can_text = ins_w_px >= ${LONG_INSERTION_TEXT_THRESHOLD_PX}.0 && px_per_bp >= 6.5;
  let is_large = is_long && can_text;

  var rect_w: f32;
  if is_large { rect_w = text_width(inst.length); }
  else if is_long { rect_w = min(5.0, ins_w_px / 3.0); }
  else { rect_w = 1.0; }

  let one_px = 2.0 / canvas_width();
  let rect_w_clip = rect_w * 2.0 / canvas_width();
  let tick_w_clip = one_px * 3.0;

  let yy = pileup_y(f32(inst.y));
  let sy_top = yy.x;
  let sy_bot = yy.y;

  var x1: f32; var x2: f32; var y1: f32; var y2: f32;
  if rect_idx == 0u {
    x1 = cx - rect_w_clip * 0.5; x2 = cx + rect_w_clip * 0.5;
    y1 = sy_bot; y2 = sy_top;
  } else if rect_idx == 1u {
    if is_long || px_per_bp < 3.0 { x1 = cx; x2 = cx; y1 = sy_top; y2 = sy_top; }
    else {
      x1 = cx - tick_w_clip * 0.5; x2 = cx + tick_w_clip * 0.5;
      let th = 1.0 / canvas_height() * 2.0;
      y1 = sy_top; y2 = sy_top + th;
    }
  } else {
    if is_long || px_per_bp < 3.0 { x1 = cx; x2 = cx; y1 = sy_bot; y2 = sy_bot; }
    else {
      x1 = cx - tick_w_clip * 0.5; x2 = cx + tick_w_clip * 0.5;
      let th = 1.0 / canvas_height() * 2.0;
      y1 = sy_bot - th; y2 = sy_bot;
    }
  }

  let sx = mix(x1, x2, lx);
  let sy = mix(y1, y2, ly);

  var alpha = 1.0;
  if !is_long && px_per_bp < 1.0 && inst.frequency == 0.0 { alpha = px_per_bp * px_per_bp; }
  if alpha <= 0.0 { out.position = vec4f(0.0); out.color = vec4f(0.0); return out; }

  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = vec4f(color3(65u), alpha);
  return out;
}

${SIMPLE_FS}
`

const CLIP_SHADER_BODY = (colorSlot: number) => `
${CIGAR_PREAMBLE}
${CIGAR_DOMAIN}

struct ClipInst { position: u32, y: u32, length: u32, frequency: f32 }
@group(0) @binding(0) var<storage, read> instances: array<ClipInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let domain_len = cigar_domain_len();
  let domain = cigar_domain();
  let pos = f32(inst.position);
  let px_per_bp = canvas_width() / domain_len;

  var alpha = 1.0;
  if px_per_bp < 1.0 && inst.frequency == 0.0 { alpha = px_per_bp; }
  if alpha <= 0.0 { out.position = vec4f(0.0); out.color = vec4f(0.0); return out; }

  let bp_per_px = 1.0 / px_per_bp;
  let bar_w = max(bp_per_px, min(2.0 * bp_per_px, 1.0));
  var sx1 = (pos - bar_w * 0.5 - domain.x) / domain_len * 2.0 - 1.0;
  var sx2 = (pos + bar_w * 0.5 - domain.x) / domain_len * 2.0 - 1.0;

  let min_w = 2.0 / canvas_width();
  if sx2 - sx1 < min_w {
    let mid = (sx1 + sx2) * 0.5;
    sx1 = mid - min_w * 0.5; sx2 = mid + min_w * 0.5;
  }

  let yy = pileup_y(f32(inst.y));
  out.position = vec4f(mix(sx1, sx2, lx), mix(yy.y, yy.x, ly), 0.0, 1.0);
  out.color = vec4f(color3(${colorSlot}u), alpha);
  return out;
}

${SIMPLE_FS}
`

export const SOFTCLIP_WGSL = CLIP_SHADER_BODY(74)
export const HARDCLIP_WGSL = CLIP_SHADER_BODY(77)

export const MODIFICATION_WGSL = `
${CIGAR_PREAMBLE}
${CIGAR_DOMAIN}

struct ModInst { position: u32, y: u32, packed_color: u32, _pad: u32 }
@group(0) @binding(0) var<storage, read> instances: array<ModInst>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32, @builtin(instance_index) iid: u32) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let v = vid % 6u;
  let lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let domain_len = cigar_domain_len();
  let domain = cigar_domain();
  let pos = f32(inst.position);

  var sx1 = (pos - domain.x) / domain_len * 2.0 - 1.0;
  var sx2 = (pos + 1.0 - domain.x) / domain_len * 2.0 - 1.0;
  let min_w = 2.0 / canvas_width();
  if sx2 - sx1 < min_w {
    let mid = (sx1 + sx2) * 0.5;
    sx1 = mid - min_w * 0.5; sx2 = mid + min_w * 0.5;
  }

  let yy = pileup_y(f32(inst.y));
  out.position = vec4f(mix(sx1, sx2, lx), mix(yy.y, yy.x, ly), 0.0, 1.0);

  let pc = inst.packed_color;
  out.color = vec4f(
    f32(pc & 0xFFu) / 255.0,
    f32((pc >> 8u) & 0xFFu) / 255.0,
    f32((pc >> 16u) & 0xFFu) / 255.0,
    f32((pc >> 24u) & 0xFFu) / 255.0,
  );
  return out;
}

${SIMPLE_FS}
`
