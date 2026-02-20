import { PILEUP_Y, PREAMBLE } from './common.ts'

export const READ_WGSL = `
${PREAMBLE}
${PILEUP_Y}

struct ReadInst {
  start_off: u32, end_off: u32, y: u32, flags: u32,
  mapq: u32, insert_size: f32, pair_orient: u32, strand: i32,
  tag_r: f32, tag_g: f32, tag_b: f32, chain_supp: u32,
}

@group(0) @binding(0) var<storage, read> instances: array<ReadInst>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) local_pos: vec2f,
  @location(2) feat_size_px: vec2f,
  @location(3) edge_flags: f32,
}

fn normal_color() -> vec3f { return color3(41u); }

fn strand_color(s: i32) -> vec3f {
  if s > 0 { return color3(32u); }
  if s < 0 { return color3(35u); }
  return color3(38u);
}

fn mapq_color(mapq: u32) -> vec3f {
  let h = f32(mapq) / 360.0;
  let c = 0.5;
  let hp = h * 6.0;
  let x = c * (1.0 - abs(hp % 2.0 - 1.0));
  let m = 0.25;
  var rgb: vec3f;
  if hp < 1.0 { rgb = vec3f(c, x, 0.0); }
  else if hp < 2.0 { rgb = vec3f(x, c, 0.0); }
  else if hp < 3.0 { rgb = vec3f(0.0, c, x); }
  else if hp < 4.0 { rgb = vec3f(0.0, x, c); }
  else if hp < 5.0 { rgb = vec3f(x, 0.0, c); }
  else { rgb = vec3f(c, 0.0, x); }
  return rgb + m;
}

fn insert_size_color(is: f32) -> vec3f {
  if is > uf(21u) { return color3(89u); }
  if is < uf(22u) { return color3(92u); }
  return color3(41u);
}

fn first_of_pair_color(flags: u32, s: i32) -> vec3f {
  let is_first = (flags & 64u) != 0u;
  let eff = select(s, -s, !is_first);
  if eff > 0 { return color3(32u); }
  if eff < 0 { return color3(35u); }
  return color3(38u);
}

fn pair_orient_color(po: u32) -> vec3f {
  if po == 1u { return color3(41u); }
  if po == 2u { return color3(44u); }
  if po == 3u { return color3(47u); }
  if po == 4u { return color3(50u); }
  return color3(38u);
}

fn is_and_orient_color(is: f32, po: u32) -> vec3f {
  if po == 2u { return color3(44u); }
  if po == 3u { return color3(47u); }
  if po == 4u { return color3(50u); }
  return insert_size_color(is);
}

fn modifications_color(flags: u32) -> vec3f {
  if (flags & 16u) != 0u { return color3(86u); }
  return color3(83u);
}

fn get_read_color(inst: ReadInst) -> vec3f {
  let cs = ui(11u);
  let cm = ui(14u);
  if cm == 1 && inst.chain_supp > 0u { return color3(95u); }
  if cs == 0 { return normal_color(); }
  if cs == 1 { return strand_color(inst.strand); }
  if cs == 2 { return mapq_color(inst.mapq); }
  if cs == 3 { return insert_size_color(inst.insert_size); }
  if cs == 4 { return first_of_pair_color(inst.flags, inst.strand); }
  if cs == 5 { return pair_orient_color(inst.pair_orient); }
  if cs == 6 { return is_and_orient_color(inst.insert_size, inst.pair_orient); }
  if cs == 7 { return modifications_color(inst.flags); }
  if cs == 8 { return vec3f(inst.tag_r, inst.tag_g, inst.tag_b); }
  return vec3f(0.6);
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  var out: VertexOutput;
  let inst = instances[iid];
  let highlight_only = ui(13u);
  let highlight_idx = ui(12u);

  if highlight_only == 1 && (highlight_idx < 0 || u32(highlight_idx) != iid) {
    out.position = vec4f(0.0);
    out.color = vec4f(0.0);
    return out;
  }

  let v = vid % 9u;
  let domain_start = uf(30u);
  let domain_len = uf(31u) - domain_start;
  let sx1 = (f32(inst.start_off) - domain_start) / domain_len * 2.0 - 1.0;
  let sx2 = (f32(inst.end_off) - domain_start) / domain_len * 2.0 - 1.0;

  let yy = pileup_y(f32(inst.y));
  let sy_top = yy.x;
  let sy_bot = yy.y;
  let sy_mid = (sy_top + sy_bot) * 0.5;

  let chevron_clip = 8.0 / canvas_width() * 2.0;
  let bp_per_px = uf(2u) / canvas_width();
  let chain_mode = ui(14u);
  let show_chev = (chain_mode == 1 || bp_per_px < 10.0) && feature_height() >= 3.0;

  let feat_w_px = (sx2 - sx1) * canvas_width() * 0.5;
  out.feat_size_px = vec2f(feat_w_px, feature_height());

  var sx: f32;
  var sy: f32;
  var lx: f32;
  var ly: f32;
  var ef: f32 = 0.0;

  if highlight_only == 1 {
    lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
    ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
    sx = mix(sx1, sx2, lx);
    sy = mix(sy_bot, sy_top, ly);
    if v >= 6u { sx = sx1; sy = sy_top; lx = 0.5; ly = 0.5; }
  } else if v < 6u {
    lx = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
    ly = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
    sx = mix(sx1, sx2, lx);
    sy = mix(sy_bot, sy_top, ly);
    if show_chev && inst.strand > 0 { ef = 1.0; }
    else if show_chev && inst.strand < 0 { ef = -1.0; }
  } else if show_chev {
    ef = 2.0;
    let chev_w = 8.0;
    let half_h = feature_height() * 0.5;
    let alt = chev_w * feature_height() / sqrt(half_h * half_h + chev_w * chev_w);
    if inst.strand > 0 {
      if v == 6u { sx = sx2; sy = sy_top; lx = 0.0; ly = alt; }
      else if v == 7u { sx = sx2; sy = sy_bot; lx = alt; ly = 0.0; }
      else { sx = sx2 + chevron_clip; sy = sy_mid; lx = 0.0; ly = 0.0; }
    } else if inst.strand < 0 {
      if v == 6u { sx = sx1; sy = sy_top; lx = 0.0; ly = alt; }
      else if v == 7u { sx = sx1 - chevron_clip; sy = sy_mid; lx = 0.0; ly = 0.0; }
      else { sx = sx1; sy = sy_bot; lx = alt; ly = 0.0; }
    } else {
      lx = 999.0; ly = 999.0; sx = sx1; sy = sy_top;
    }
  } else {
    lx = 0.5; ly = 0.5; sx = sx1; sy = sy_top;
  }

  out.local_pos = vec2f(lx, ly);
  out.edge_flags = ef;
  out.position = vec4f(sx, sy, 0.0, 1.0);

  if highlight_only == 1 {
    out.color = vec4f(0.0, 0.0, 0.0, 0.4);
  } else {
    out.color = vec4f(get_read_color(inst), 1.0);
  }
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  if ui(15u) == 1 {
    var edge_dist: f32;
    if in.edge_flags > 1.5 {
      edge_dist = min(in.local_pos.x, in.local_pos.y);
    } else {
      let dx_l = in.local_pos.x * in.feat_size_px.x;
      var dx_r = (1.0 - in.local_pos.x) * in.feat_size_px.x;
      if in.edge_flags > 0.5 { dx_r = 999.0; }
      var dx_ll = dx_l;
      if in.edge_flags < -0.5 { dx_ll = 999.0; }
      let dy = min(in.local_pos.y, 1.0 - in.local_pos.y) * in.feat_size_px.y;
      edge_dist = min(min(dx_ll, dx_r), dy);
    }
    if edge_dist < 1.0 && in.feat_size_px.x > 4.0 && in.feat_size_px.y > 4.0 {
      return vec4f(in.color.rgb * 0.7, in.color.a);
    }
  }
  return in.color;
}
`
