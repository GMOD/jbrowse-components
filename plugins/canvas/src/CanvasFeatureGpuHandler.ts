/// <reference types="@webgpu/types" />
import GpuHandlerType from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'

import type { GpuCanvasContext } from '@jbrowse/core/pluggableElementTypes/GpuHandlerType'
import type PluginManager from '@jbrowse/core/PluginManager'

const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

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
  // 12 vertices per chevron: 2 thin quads (top arm + bottom arm), 4 triangles
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

  let half_w = 5.0 / u.canvas_width;
  let half_h = 4.0 / u.canvas_height;
  let thickness = 1.5 / u.canvas_height;
  let dir = inst.direction;

  // top arm quad: vertices 0-5, bottom arm quad: vertices 6-11
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

const UNIFORM_SIZE = 32
const RECT_STRIDE = 8
const LINE_STRIDE = 8
const CHEVRON_STRIDE = 8
const ARROW_STRIDE = 8

interface GpuRegionData {
  regionStart: number
  rectBuffer: GPUBuffer | null
  rectCount: number
  rectBindGroup: GPUBindGroup | null
  lineBuffer: GPUBuffer | null
  lineCount: number
  lineBindGroup: GPUBindGroup | null
  chevronBuffer: GPUBuffer | null
  chevronBindGroup: GPUBindGroup | null
  arrowBuffer: GPUBuffer | null
  arrowCount: number
  arrowBindGroup: GPUBindGroup | null
}

interface GpuCanvasState {
  canvas: OffscreenCanvas
  context: GPUCanvasContext
  width: number
  height: number
  regions: Map<number, GpuRegionData>
}

export default class CanvasFeatureGpuHandler extends GpuHandlerType {
  name = 'CanvasFeatureGpuHandler'

  private device: GPUDevice | null = null
  private rectPipeline: GPURenderPipeline | null = null
  private linePipeline: GPURenderPipeline | null = null
  private chevronPipeline: GPURenderPipeline | null = null
  private arrowPipeline: GPURenderPipeline | null = null
  private bindGroupLayout: GPUBindGroupLayout | null = null
  private uniformBuffer: GPUBuffer | null = null

  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  private canvases = new Map<number, GpuCanvasState>()

  constructor(pm: PluginManager) {
    super(pm)
  }

  init(device: GPUDevice) {
    console.log('[CanvasFeatureGpuHandler] init called with device', !!device)
    this.device = device
    const blendState: GPUBlendState = {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add',
      },
    }
    const target: GPUColorTargetState = {
      format: 'bgra8unorm',
      blend: blendState,
    }

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    this.bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    })

    const layout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout],
    })

    const rectModule = device.createShaderModule({ code: RECT_SHADER })
    this.rectPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: rectModule, entryPoint: 'vs_main' },
      fragment: { module: rectModule, entryPoint: 'fs_main', targets: [target] },
      primitive: { topology: 'triangle-list' },
    })

    const lineModule = device.createShaderModule({ code: LINE_SHADER })
    this.linePipeline = device.createRenderPipeline({
      layout,
      vertex: { module: lineModule, entryPoint: 'vs_main' },
      fragment: { module: lineModule, entryPoint: 'fs_main', targets: [target] },
      primitive: { topology: 'triangle-list' },
    })

    const chevronModule = device.createShaderModule({ code: CHEVRON_SHADER })
    this.chevronPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: chevronModule, entryPoint: 'vs_main' },
      fragment: { module: chevronModule, entryPoint: 'fs_main', targets: [target] },
      primitive: { topology: 'triangle-list' },
    })

    const arrowModule = device.createShaderModule({ code: ARROW_SHADER })
    this.arrowPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: arrowModule, entryPoint: 'vs_main' },
      fragment: { module: arrowModule, entryPoint: 'fs_main', targets: [target] },
      primitive: { topology: 'triangle-list' },
    })
  }

  initWebGL() {}

  handleMessage(
    msg: { type: string; canvasId: number; [key: string]: unknown },
    ctx: GpuCanvasContext,
  ) {
    console.log('[CanvasFeatureGpuHandler] handleMessage', msg.type, 'canvasId', msg.canvasId, 'device?', !!this.device)
    const state = this.ensureCanvas(msg.canvasId, ctx)
    switch (msg.type) {
      case 'resize': {
        state.width = msg.width as number
        state.height = msg.height as number
        state.canvas.width = msg.width as number
        state.canvas.height = msg.height as number
        break
      }
      case 'upload-region': {
        this.uploadRegion(state, msg)
        break
      }
      case 'prune-regions': {
        this.pruneRegions(state, msg)
        break
      }
      case 'render-blocks': {
        this.renderBlocks(state, msg)
        break
      }
    }
  }

  dispose(canvasId: number) {
    const state = this.canvases.get(canvasId)
    if (state) {
      for (const region of state.regions.values()) {
        this.destroyRegion(region)
      }
      this.canvases.delete(canvasId)
    }
  }

  private ensureCanvas(canvasId: number, ctx: GpuCanvasContext) {
    let state = this.canvases.get(canvasId)
    if (!state) {
      const gpuContext = ctx.canvas.getContext('webgpu')!
      gpuContext.configure({
        device: this.device!,
        format: 'bgra8unorm',
        alphaMode: 'premultiplied',
      })
      state = {
        canvas: ctx.canvas,
        context: gpuContext,
        width: ctx.width,
        height: ctx.height,
        regions: new Map(),
      }
      this.canvases.set(canvasId, state)
    }
    return state
  }

  private destroyRegion(region: GpuRegionData) {
    region.rectBuffer?.destroy()
    region.lineBuffer?.destroy()
    region.chevronBuffer?.destroy()
    region.arrowBuffer?.destroy()
  }

  private createStorageBuffer(data: ArrayBuffer) {
    const buf = this.device!.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    this.device!.queue.writeBuffer(buf, 0, data)
    return buf
  }

  private createBindGroup(storageBuffer: GPUBuffer) {
    return this.device!.createBindGroup({
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: storageBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer! } },
      ],
    })
  }

  private uploadRegion(state: GpuCanvasState, msg: Record<string, unknown>) {
    if (!this.device || !this.bindGroupLayout || !this.uniformBuffer) {
      console.warn('[CanvasFeatureGpuHandler] uploadRegion: no device/layout/uniform')
      return
    }
    const regionNumber = msg.regionNumber as number
    const old = state.regions.get(regionNumber)
    if (old) {
      this.destroyRegion(old)
    }

    const regionStart = msg.regionStart as number
    const numRects = msg.numRects as number
    const numLines = msg.numLines as number
    const numArrows = msg.numArrows as number

    console.log('[CanvasFeatureGpuHandler] uploadRegion', regionNumber, { regionStart, numRects, numLines, numArrows })

    const region: GpuRegionData = {
      regionStart,
      rectBuffer: null,
      rectCount: numRects,
      rectBindGroup: null,
      lineBuffer: null,
      lineCount: numLines,
      lineBindGroup: null,
      chevronBuffer: null,
      chevronBindGroup: null,
      arrowBuffer: null,
      arrowCount: numArrows,
      arrowBindGroup: null,
    }

    if (numRects > 0) {
      const rectPositions = msg.rectPositions as Uint32Array
      const rectYs = msg.rectYs as Float32Array
      const rectHeights = msg.rectHeights as Float32Array
      const rectColors = msg.rectColors as Uint8Array
      const interleaved = this.interleaveRects(rectPositions, rectYs, rectHeights, rectColors, numRects)
      region.rectBuffer = this.createStorageBuffer(interleaved)
      region.rectBindGroup = this.createBindGroup(region.rectBuffer)
    }

    if (numLines > 0) {
      const linePositions = msg.linePositions as Uint32Array
      const lineYs = msg.lineYs as Float32Array
      const lineColors = msg.lineColors as Uint8Array
      const lineDirections = msg.lineDirections as Int8Array
      const lineInterleaved = this.interleaveLines(linePositions, lineYs, lineColors, numLines)
      region.lineBuffer = this.createStorageBuffer(lineInterleaved)
      region.lineBindGroup = this.createBindGroup(region.lineBuffer)
      const chevronInterleaved = this.interleaveChevrons(linePositions, lineYs, lineDirections, lineColors, numLines)
      region.chevronBuffer = this.createStorageBuffer(chevronInterleaved)
      region.chevronBindGroup = this.createBindGroup(region.chevronBuffer)
    }

    if (numArrows > 0) {
      const arrowXs = msg.arrowXs as Uint32Array
      const arrowYs = msg.arrowYs as Float32Array
      const arrowDirections = msg.arrowDirections as Int8Array
      const arrowHeights = msg.arrowHeights as Float32Array
      const arrowColors = msg.arrowColors as Uint8Array
      const arrowInterleaved = this.interleaveArrows(arrowXs, arrowYs, arrowDirections, arrowHeights, arrowColors, numArrows)
      region.arrowBuffer = this.createStorageBuffer(arrowInterleaved)
      region.arrowBindGroup = this.createBindGroup(region.arrowBuffer)
    }

    state.regions.set(regionNumber, region)
  }

  private interleaveRects(
    positions: Uint32Array,
    ys: Float32Array,
    heights: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
    // RectInstance: vec2u start_end, f32 y, f32 height, vec4f color = 8 floats
    const buf = new ArrayBuffer(count * RECT_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * RECT_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = ys[i]!
      f32[off + 3] = heights[i]!
      f32[off + 4] = colors[i * 4]! / 255
      f32[off + 5] = colors[i * 4 + 1]! / 255
      f32[off + 6] = colors[i * 4 + 2]! / 255
      f32[off + 7] = colors[i * 4 + 3]! / 255
    }
    return buf
  }

  private interleaveLines(
    positions: Uint32Array,
    ys: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
    // LineInstance: vec2u start_end, f32 y, f32 _pad, vec4f color = 8 floats
    const buf = new ArrayBuffer(count * LINE_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * LINE_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = ys[i]!
      f32[off + 3] = 0
      f32[off + 4] = colors[i * 4]! / 255
      f32[off + 5] = colors[i * 4 + 1]! / 255
      f32[off + 6] = colors[i * 4 + 2]! / 255
      f32[off + 7] = colors[i * 4 + 3]! / 255
    }
    return buf
  }

  private interleaveChevrons(
    positions: Uint32Array,
    ys: Float32Array,
    directions: Int8Array,
    colors: Uint8Array,
    count: number,
  ) {
    // ChevronInstance: vec2u start_end, f32 y, f32 direction, vec4f color = 8 floats
    const buf = new ArrayBuffer(count * CHEVRON_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * CHEVRON_STRIDE
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = ys[i]!
      f32[off + 3] = directions[i]!
      f32[off + 4] = colors[i * 4]! / 255
      f32[off + 5] = colors[i * 4 + 1]! / 255
      f32[off + 6] = colors[i * 4 + 2]! / 255
      f32[off + 7] = colors[i * 4 + 3]! / 255
    }
    return buf
  }

  private interleaveArrows(
    xs: Uint32Array,
    ys: Float32Array,
    directions: Int8Array,
    heights: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
    // ArrowInstance: u32 x, u32 _pad, f32 y, f32 direction, f32 height, f32 r, f32 g, f32 a(b)
    const buf = new ArrayBuffer(count * ARROW_STRIDE * 4)
    const u32 = new Uint32Array(buf)
    const f32 = new Float32Array(buf)
    for (let i = 0; i < count; i++) {
      const off = i * ARROW_STRIDE
      u32[off] = xs[i]!
      u32[off + 1] = 0
      f32[off + 2] = ys[i]!
      f32[off + 3] = directions[i]!
      f32[off + 4] = heights[i]!
      f32[off + 5] = colors[i * 4]! / 255
      f32[off + 6] = colors[i * 4 + 1]! / 255
      f32[off + 7] = colors[i * 4 + 2]! / 255
    }
    return buf
  }

  private pruneRegions(state: GpuCanvasState, msg: Record<string, unknown>) {
    const active = new Set<number>(msg.activeRegions as number[])
    for (const [num, region] of state.regions) {
      if (!active.has(num)) {
        this.destroyRegion(region)
        state.regions.delete(num)
      }
    }
  }

  private writeUniforms(
    bpRangeHi: number,
    bpRangeLo: number,
    bpRangeLength: number,
    regionStart: number,
    canvasHeight: number,
    canvasWidth: number,
    scrollY: number,
    bpPerPx: number,
  ) {
    this.uniformF32[0] = bpRangeHi
    this.uniformF32[1] = bpRangeLo
    this.uniformF32[2] = bpRangeLength
    this.uniformU32[3] = regionStart
    this.uniformF32[4] = canvasHeight
    this.uniformF32[5] = canvasWidth
    this.uniformF32[6] = scrollY
    this.uniformF32[7] = bpPerPx
    this.device!.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)
  }

  private splitPositionWithFrac(value: number): [number, number] {
    const intValue = Math.floor(value)
    const frac = value - intValue
    const loInt = intValue & 0xfff
    const hi = intValue - loInt
    const lo = loInt + frac
    return [hi, lo]
  }

  private renderBlocks(state: GpuCanvasState, msg: Record<string, unknown>) {
    if (!this.device || !this.rectPipeline) {
      console.warn('[CanvasFeatureGpuHandler] renderBlocks: no device/pipeline')
      return
    }
    const blocks = msg.blocks as {
      regionNumber: number
      bpRangeX: [number, number]
      screenStartPx: number
      screenEndPx: number
    }[]
    const scrollY = msg.scrollY as number
    const canvasWidth = msg.canvasWidth as number
    const canvasHeight = msg.canvasHeight as number

    console.log('[CanvasFeatureGpuHandler] renderBlocks:', {
      numBlocks: blocks.length,
      canvasWidth,
      canvasHeight,
      scrollY,
      numRegions: state.regions.size,
      regionKeys: [...state.regions.keys()],
    })

    if (state.canvas.width !== canvasWidth || state.canvas.height !== canvasHeight) {
      state.canvas.width = canvasWidth
      state.canvas.height = canvasHeight
      state.width = canvasWidth
      state.height = canvasHeight
    }

    let isFirst = true

    for (const block of blocks) {
      const region = state.regions.get(block.regionNumber)
      if (!region) {
        console.warn('[CanvasFeatureGpuHandler] region not found:', block.regionNumber)
        continue
      }
      console.log('[CanvasFeatureGpuHandler] block', block.regionNumber, {
        rects: region.rectCount,
        lines: region.lineCount,
        arrows: region.arrowCount,
        hasRectBindGroup: !!region.rectBindGroup,
      })

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart = block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd = block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
        Math.floor(region.regionStart),
        canvasHeight,
        scissorW,
        scrollY,
        bpPerPx,
      )

      const encoder = this.device.createCommandEncoder()
      const textureView = state.context.getCurrentTexture().createView()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: (isFirst ? 'clear' : 'load') as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            ...(isFirst && { clearValue: { r: 0, g: 0, b: 0, a: 0 } }),
          },
        ],
      })

      pass.setViewport(scissorX, 0, scissorW, canvasHeight, 0, 1)
      pass.setScissorRect(scissorX, 0, scissorW, canvasHeight)

      if (region.lineBindGroup && region.lineCount > 0) {
        pass.setPipeline(this.linePipeline!)
        pass.setBindGroup(0, region.lineBindGroup)
        pass.draw(6, region.lineCount)
      }

      if (region.chevronBindGroup && region.lineCount > 0) {
        pass.setPipeline(this.chevronPipeline!)
        pass.setBindGroup(0, region.chevronBindGroup)
        pass.draw(MAX_VISIBLE_CHEVRONS_PER_LINE * 12, region.lineCount)
      }

      if (region.rectBindGroup && region.rectCount > 0) {
        pass.setPipeline(this.rectPipeline!)
        pass.setBindGroup(0, region.rectBindGroup)
        pass.draw(6, region.rectCount)
      }

      if (region.arrowBindGroup && region.arrowCount > 0) {
        pass.setPipeline(this.arrowPipeline!)
        pass.setBindGroup(0, region.arrowBindGroup)
        pass.draw(9, region.arrowCount)
      }

      pass.end()
      this.device.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      const encoder = this.device.createCommandEncoder()
      const textureView = state.context.getCurrentTexture().createView()
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: textureView,
            loadOp: 'clear' as GPULoadOp,
            storeOp: 'store' as GPUStoreOp,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      })
      pass.end()
      this.device.queue.submit([encoder.finish()])
    }
  }
}
