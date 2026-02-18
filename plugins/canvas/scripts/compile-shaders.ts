import { createHash } from 'crypto'
import { execSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const HP_WGSL = `
const HP_LOW_MASK: u32 = 0xFFFu;

fn hp_split_uint(value: u32) -> vec2f {
  let lo = value & HP_LOW_MASK;
  let hi = value - lo;
  return vec2f(f32(hi), f32(lo));
}

fn hp_to_clip_x(split_pos: vec2f, bp_range: vec3f) -> f32 {
  let hi = split_pos.x - bp_range.x;
  let lo = split_pos.y - bp_range.y;
  return (hi + lo) / bp_range.z * 2.0 - 1.0;
}

fn snap_to_pixel_x(clip_x: f32, canvas_width: f32) -> f32 {
  let px = (clip_x + 1.0) * 0.5 * canvas_width;
  return floor(px + 0.5) / canvas_width * 2.0 - 1.0;
}
`

const RECT_SHADER = /* wgsl */ `
${HP_WGSL}

struct RectInstance {
  start_end: vec2u,
  y: f32,
  height: f32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<RectInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 6u;
  let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let local_y = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let sx1 = snap_to_pixel_x(hp_to_clip_x(hp_split_uint(abs_start), u.bp_range_x), u.canvas_width);
  let sx2 = snap_to_pixel_x(hp_to_clip_x(hp_split_uint(abs_end), u.bp_range_x), u.canvas_width);

  let min_width = 4.0 / u.canvas_width;
  let final_sx2 = select(sx2, sx1 + min_width, sx2 - sx1 < min_width);
  let sx = mix(sx1, final_sx2, local_x);

  let y_top_px = floor(inst.y - u.scroll_y + 0.5);
  let y_bot_px = floor(y_top_px + inst.height + 0.5);
  let sy_top = 1.0 - (y_top_px / u.canvas_height) * 2.0;
  let sy_bot = 1.0 - (y_bot_px / u.canvas_height) * 2.0;
  let sy = mix(sy_bot, sy_top, local_y);

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

const LINE_SHADER = /* wgsl */ `
${HP_WGSL}

struct LineInstance {
  start_end: vec2u,
  y: f32,
  _pad: f32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<LineInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 6u;

  let abs_start = inst.start_end.x + u.region_start;
  let abs_end = inst.start_end.y + u.region_start;
  let sx1 = hp_to_clip_x(hp_split_uint(abs_start), u.bp_range_x);
  let sx2 = hp_to_clip_x(hp_split_uint(abs_end), u.bp_range_x);

  let y_px = floor(inst.y - u.scroll_y + 0.5) + 0.5;
  let cy = 1.0 - (y_px / u.canvas_height) * 2.0;
  let half_px = 1.0 / u.canvas_height;

  let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
  let local_y = select(1.0, 0.0, v == 0u || v == 1u || v == 4u);
  let sx = mix(sx1, sx2, local_x);
  let sy = mix(cy - half_px, cy + half_px, local_y);

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

const CHEVRON_SHADER = /* wgsl */ `
${HP_WGSL}

struct ChevronInstance {
  start_end: vec2u,
  y: f32,
  direction: f32,
  color: vec4f,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<ChevronInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let local_chevron_index = i32(vid / 12u);
  let v = vid % 12u;

  let line_length_bp = f32(inst.start_end.y - inst.start_end.x);
  let line_width_px = line_length_bp / u.bp_per_px;
  let chevron_spacing_px = 25.0;

  var out: VertexOutput;

  if inst.direction == 0.0 || line_width_px < chevron_spacing_px * 0.5 {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.color = vec4f(0.0);
    return out;
  }

  let total_chevrons = max(1, i32(floor(line_width_px / chevron_spacing_px)));
  let bp_spacing = line_length_bp / f32(total_chevrons + 1);

  let viewport_start_bp = u.bp_range_x.x + u.bp_range_x.y - f32(u.region_start) - f32(inst.start_end.x);
  let viewport_end_bp = viewport_start_bp + u.bp_range_x.z;

  let first_visible = max(0, i32(floor(viewport_start_bp / bp_spacing)) - 1);
  let last_visible = min(total_chevrons - 1, i32(ceil(viewport_end_bp / bp_spacing)));

  let global_chevron_index = first_visible + local_chevron_index;

  if global_chevron_index < 0 || global_chevron_index > last_visible || global_chevron_index >= total_chevrons {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0);
    out.color = vec4f(0.0);
    return out;
  }

  let chevron_offset_bp = bp_spacing * f32(global_chevron_index + 1);
  let line_start_abs = inst.start_end.x + u.region_start;
  let split_start = hp_split_uint(line_start_abs);
  let split_chevron = vec2f(split_start.x, split_start.y + chevron_offset_bp);
  let cx = hp_to_clip_x(split_chevron, u.bp_range_x);

  let y_px = floor(inst.y - u.scroll_y + 0.5) + 0.5;
  let cy = 1.0 - (y_px / u.canvas_height) * 2.0;

  let half_w = 4.5 / u.canvas_width;
  let half_h = 3.5 / u.canvas_height;
  let thickness = 1.0 / u.canvas_height;
  let dir = inst.direction;

  let is_top_arm = v < 6u;
  let qv = v % 6u;
  var sx: f32;
  var sy: f32;

  let tip_x = cx + half_w * dir;
  let outer_x = cx - half_w * dir;
  let arm_y = select(-half_h, half_h, is_top_arm);

  switch qv {
    case 0u: { sx = outer_x; sy = cy + arm_y; }
    case 1u: { sx = tip_x; sy = cy + thickness * 0.5; }
    case 2u: { sx = tip_x; sy = cy - thickness * 0.5; }
    case 3u: { sx = outer_x; sy = cy + arm_y; }
    case 4u: { sx = tip_x; sy = cy - thickness * 0.5; }
    default: { sx = outer_x; sy = cy + arm_y - select(thickness, -thickness, is_top_arm); }
  }

  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = inst.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

const ARROW_SHADER = /* wgsl */ `
${HP_WGSL}

struct ArrowInstance {
  x: u32,
  _pad0: u32,
  y: f32,
  direction: f32,
  height: f32,
  color_r: f32,
  color_g: f32,
  color_b: f32,
}

struct Uniforms {
  bp_range_x: vec3f,
  region_start: u32,
  canvas_height: f32,
  canvas_width: f32,
  scroll_y: f32,
  bp_per_px: f32,
}

@group(0) @binding(0) var<storage, read> instances: array<ArrowInstance>;
@group(0) @binding(1) var<uniform> u: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(
  @builtin(vertex_index) vid: u32,
  @builtin(instance_index) iid: u32,
) -> VertexOutput {
  let inst = instances[iid];
  let v = vid % 9u;

  let abs_x = inst.x + u.region_start;
  let cx = hp_to_clip_x(hp_split_uint(abs_x), u.bp_range_x);

  let y_px = floor(inst.y - u.scroll_y + 0.5) + 0.5;
  let cy = 1.0 - (y_px / u.canvas_height) * 2.0;

  let stem_length = 7.0 / u.canvas_width * 2.0;
  let stem_half = 0.5 / u.canvas_height * 2.0;
  let head_half = 2.5 / u.canvas_height * 2.0;

  let dir = inst.direction;

  var sx: f32;
  var sy: f32;
  if v < 6u {
    let local_x = select(1.0, 0.0, v == 0u || v == 2u || v == 3u);
    let local_y = select(1.0, -1.0, v == 0u || v == 1u || v == 4u);
    sx = cx + local_x * stem_length * 0.5 * dir;
    sy = cy + local_y * stem_half;
  } else {
    let hvid = v - 6u;
    if hvid == 0u {
      sx = cx + stem_length * 0.5 * dir;
      sy = cy + head_half;
    } else if hvid == 1u {
      sx = cx + stem_length * 0.5 * dir;
      sy = cy - head_half;
    } else {
      sx = cx + stem_length * dir;
      sy = cy;
    }
  }

  var out: VertexOutput;
  out.position = vec4f(sx, sy, 0.0, 1.0);
  out.color = vec4f(inst.color_r, inst.color_g, inst.color_b, 1.0);
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4f {
  return in.color;
}
`

const shaders = [
  { name: 'RECT', wgsl: RECT_SHADER },
  { name: 'LINE', wgsl: LINE_SHADER },
  { name: 'CHEVRON', wgsl: CHEVRON_SHADER },
  { name: 'ARROW', wgsl: ARROW_SHADER },
] as const

const outDir = join(
  import.meta.dirname,
  '..',
  'src',
  'LinearWebGLFeatureDisplay',
  'components',
  'generated',
)
const outFile = join(outDir, 'index.ts')
const hashFile = join(outDir, '.wgsl-hash')

interface StructField {
  type: string
  name: string
}

function hasNaga() {
  try {
    execSync('naga --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function computeSourceHash() {
  const allWgsl = shaders.map(s => s.wgsl).join('\n')
  return createHash('sha256').update(allWgsl).digest('hex')
}

function isUpToDate(hash: string) {
  if (!existsSync(outFile) || !existsSync(hashFile)) {
    return false
  }
  try {
    return readFileSync(hashFile, 'utf-8').trim() === hash
  } catch {
    return false
  }
}

function parseStruct(glsl: string, structName: string): StructField[] {
  const re = new RegExp(`struct\\s+${structName}\\s*\\{([^}]+)\\}`)
  const m = re.exec(glsl)
  if (!m) {
    return []
  }
  const fields: StructField[] = []
  for (const line of m[1].split(';')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      fields.push({ type: parts[0], name: parts[1] })
    }
  }
  return fields
}

function fetchExpr(type: string, baseExpr: string) {
  if (type === 'float') {
    return `uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4])`
  }
  if (type === 'uint') {
    return `texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4]`
  }
  if (type === 'int') {
    return `int(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4])`
  }
  if (type === 'uvec2') {
    return `uvec2(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4], texelFetch(u_instanceData, ivec2((${baseExpr} + 1) / 4, 0), 0)[(${baseExpr} + 1) % 4])`
  }
  if (type === 'vec4') {
    return `vec4(uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr}) / 4, 0), 0)[(${baseExpr}) % 4]), uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr} + 1) / 4, 0), 0)[(${baseExpr} + 1) % 4]), uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr} + 2) / 4, 0), 0)[(${baseExpr} + 2) % 4]), uintBitsToFloat(texelFetch(u_instanceData, ivec2((${baseExpr} + 3) / 4, 0), 0)[(${baseExpr} + 3) % 4]))`
  }
  throw new Error(`Unsupported type in SSBO struct: ${type}`)
}

function fieldSize(type: string) {
  if (type === 'uvec2' || type === 'vec2' || type === 'ivec2') {
    return 2
  }
  if (type === 'vec3' || type === 'uvec3' || type === 'ivec3') {
    return 3
  }
  if (type === 'vec4' || type === 'uvec4' || type === 'ivec4') {
    return 4
  }
  return 1
}

function replaceSSBO(glsl: string) {
  const ssboRe =
    /layout\(std430\)\s+readonly\s+buffer\s+\w+\s*\{\s*(\w+)\s+(\w+)\[\]\s*;\s*\}\s*;/
  const ssboMatch = ssboRe.exec(glsl)
  if (!ssboMatch) {
    return glsl
  }

  const structType = ssboMatch[1]
  const arrayName = ssboMatch[2]
  const fields = parseStruct(glsl, structType)
  if (fields.length === 0) {
    throw new Error(`Could not parse struct ${structType}`)
  }

  let stride = 0
  const offsets: number[] = []
  for (const f of fields) {
    offsets.push(stride)
    stride += fieldSize(f.type)
  }

  let fetchFn = `${structType} _fetch_${structType}(int idx) {\n`
  fetchFn += `    int base = idx * ${stride};\n`
  fetchFn += `    ${structType} s;\n`
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]
    fetchFn += `    s.${f.name} = ${fetchExpr(f.type, `base + ${offsets[i]}`)};\n`
  }
  fetchFn += `    return s;\n`
  fetchFn += `}`

  glsl = glsl.replace(
    ssboMatch[0],
    `uniform highp usampler2D u_instanceData;\n\n${fetchFn}`,
  )

  const accessRe = new RegExp(
    `(\\w+)\\s+(\\w+)\\s*=\\s*${arrayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[([^\\]]+)\\]\\s*;`,
    'g',
  )
  glsl = glsl.replace(accessRe, (_match, type, varName, indexExpr) => {
    return `${type} ${varName} = _fetch_${type}(int(${indexExpr}));`
  })

  return glsl
}

function postProcess(glsl: string) {
  glsl = glsl.replace('#version 310 es', '#version 300 es')
  glsl = glsl.replace(/uniform uint naga_vs_first_instance;\n?/g, '')
  glsl = glsl.replace(
    /\(uint\(gl_InstanceID\)\s*\+\s*naga_vs_first_instance\)/g,
    'uint(gl_InstanceID)',
  )
  glsl = replaceSSBO(glsl)
  return glsl
}

function compileShader(
  wgsl: string,
  entryPoint: string,
  stage: 'vert' | 'frag',
  tmpDir: string,
  name: string,
) {
  const wgslPath = join(tmpDir, `${name}.wgsl`)
  const outPath = join(tmpDir, `${name}.${stage}`)
  writeFileSync(wgslPath, wgsl)
  try {
    execSync(
      `naga "${wgslPath}" "${outPath}" --entry-point ${entryPoint} --keep-coordinate-space --compact`,
      { stdio: 'pipe' },
    )
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer }
    console.error(`naga failed for ${name} ${stage}:`)
    console.error(err.stderr?.toString())
    throw e
  }
  return postProcess(readFileSync(outPath, 'utf-8'))
}

function main() {
  const hash = computeSourceHash()
  if (isUpToDate(hash)) {
    console.log('compile-shaders: GLSL is up to date, skipping')
    return
  }
  if (!hasNaga()) {
    if (existsSync(outFile)) {
      console.warn(
        'compile-shaders: naga not found, using existing generated GLSL',
      )
      return
    }
    console.error(
      'compile-shaders: naga not found and no generated GLSL exists.',
    )
    console.error('Install naga-cli: cargo install naga-cli')
    process.exit(1)
  }

  const tmpDir = join(tmpdir(), `jbrowse-canvas-shader-compile-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  const results: { name: string; vert: string; frag: string }[] = []
  for (const shader of shaders) {
    process.stdout.write(`  ${shader.name}...`)
    const vert = compileShader(shader.wgsl, 'vs_main', 'vert', tmpDir, shader.name)
    const frag = compileShader(shader.wgsl, 'fs_main', 'frag', tmpDir, shader.name)
    results.push({ name: shader.name, vert, frag })
    process.stdout.write(' ok\n')
  }

  mkdirSync(outDir, { recursive: true })

  let output = '// Auto-generated by compile-shaders.ts from WGSL sources\n'
  output += '// Do not edit manually - edit the WGSL sources in CanvasFeatureRenderer.ts instead\n'
  output += '// Regenerate: pnpm compile-shaders\n\n'

  for (const r of results) {
    output += `export const ${r.name}_VERTEX_SHADER = \`${r.vert.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`\n\n`
    output += `export const ${r.name}_FRAGMENT_SHADER = \`${r.frag.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`\n\n`
  }

  writeFileSync(outFile, output)
  writeFileSync(hashFile, hash)
  rmSync(tmpDir, { recursive: true })
  console.log(`compile-shaders: generated ${results.length} shader pairs → ${outFile}`)
}

main()
