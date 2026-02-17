/// <reference types="@webgpu/types" />

import { WebGLFeatureRenderer } from './WebGLFeatureRenderer.ts'

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

export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

const rendererCache = new WeakMap<HTMLCanvasElement, CanvasFeatureRenderer>()

export class CanvasFeatureRenderer {
  private static device: GPUDevice | null = null
  private static devicePromise: Promise<GPUDevice | null> | null = null
  private static rectPipeline: GPURenderPipeline | null = null
  private static linePipeline: GPURenderPipeline | null = null
  private static chevronPipeline: GPURenderPipeline | null = null
  private static arrowPipeline: GPURenderPipeline | null = null
  private static bindGroupLayout: GPUBindGroupLayout | null = null

  private canvas: HTMLCanvasElement
  private context: GPUCanvasContext | null = null
  private uniformBuffer: GPUBuffer | null = null
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regions = new Map<number, GpuRegionData>()
  private glFallback: WebGLFeatureRenderer | null = null

  private constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  static getOrCreate(canvas: HTMLCanvasElement) {
    let renderer = rendererCache.get(canvas)
    if (!renderer) {
      renderer = new CanvasFeatureRenderer(canvas)
      rendererCache.set(canvas, renderer)
    }
    return renderer
  }

  private static async ensureDevice() {
    if (CanvasFeatureRenderer.device) {
      return CanvasFeatureRenderer.device
    }
    if (CanvasFeatureRenderer.devicePromise) {
      return CanvasFeatureRenderer.devicePromise
    }
    CanvasFeatureRenderer.devicePromise = (async () => {
      try {
        const adapter = await navigator.gpu?.requestAdapter()
        if (!adapter) {
          return null
        }
        const device = await adapter.requestDevice()
        CanvasFeatureRenderer.device = device
        CanvasFeatureRenderer.initPipelines(device)
        return device
      } catch {
        return null
      }
    })()
    return CanvasFeatureRenderer.devicePromise
  }

  private static initPipelines(device: GPUDevice) {
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

    CanvasFeatureRenderer.bindGroupLayout = device.createBindGroupLayout({
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
      bindGroupLayouts: [CanvasFeatureRenderer.bindGroupLayout],
    })

    const rectModule = device.createShaderModule({ code: RECT_SHADER })
    CanvasFeatureRenderer.rectPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: rectModule, entryPoint: 'vs_main' },
      fragment: {
        module: rectModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })

    const lineModule = device.createShaderModule({ code: LINE_SHADER })
    CanvasFeatureRenderer.linePipeline = device.createRenderPipeline({
      layout,
      vertex: { module: lineModule, entryPoint: 'vs_main' },
      fragment: {
        module: lineModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })

    const chevronModule = device.createShaderModule({ code: CHEVRON_SHADER })
    CanvasFeatureRenderer.chevronPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: chevronModule, entryPoint: 'vs_main' },
      fragment: {
        module: chevronModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })

    const arrowModule = device.createShaderModule({ code: ARROW_SHADER })
    CanvasFeatureRenderer.arrowPipeline = device.createRenderPipeline({
      layout,
      vertex: { module: arrowModule, entryPoint: 'vs_main' },
      fragment: {
        module: arrowModule,
        entryPoint: 'fs_main',
        targets: [target],
      },
      primitive: { topology: 'triangle-list' },
    })
  }

  async init() {
    const device = await CanvasFeatureRenderer.ensureDevice()
    if (!device) {
      try {
        this.glFallback = new WebGLFeatureRenderer(this.canvas)
        return true
      } catch {
        return false
      }
    }

    this.context = this.canvas.getContext('webgpu')!
    this.context.configure({
      device,
      format: 'bgra8unorm',
      alphaMode: 'premultiplied',
    })

    this.uniformBuffer = device.createBuffer({
      size: UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    return true
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      rectPositions: Uint32Array
      rectYs: Float32Array
      rectHeights: Float32Array
      rectColors: Uint8Array
      numRects: number
      linePositions: Uint32Array
      lineYs: Float32Array
      lineColors: Uint8Array
      lineDirections: Int8Array
      numLines: number
      arrowXs: Uint32Array
      arrowYs: Float32Array
      arrowDirections: Int8Array
      arrowHeights: Float32Array
      arrowColors: Uint8Array
      numArrows: number
    },
  ) {
    if (this.glFallback) {
      this.glFallback.uploadForRegion(regionNumber, data)
      return
    }
    const device = CanvasFeatureRenderer.device
    if (!device || !CanvasFeatureRenderer.bindGroupLayout || !this.uniformBuffer) {
      return
    }

    const old = this.regions.get(regionNumber)
    if (old) {
      this.destroyRegion(old)
    }

    const region: GpuRegionData = {
      regionStart: data.regionStart,
      rectBuffer: null,
      rectCount: data.numRects,
      rectBindGroup: null,
      lineBuffer: null,
      lineCount: data.numLines,
      lineBindGroup: null,
      chevronBuffer: null,
      chevronBindGroup: null,
      arrowBuffer: null,
      arrowCount: data.numArrows,
      arrowBindGroup: null,
    }

    if (data.numRects > 0) {
      const interleaved = this.interleaveRects(
        data.rectPositions,
        data.rectYs,
        data.rectHeights,
        data.rectColors,
        data.numRects,
      )
      region.rectBuffer = this.createStorageBuffer(device, interleaved)
      region.rectBindGroup = this.createBindGroup(device, region.rectBuffer)
    }

    if (data.numLines > 0) {
      const lineInterleaved = this.interleaveLines(
        data.linePositions,
        data.lineYs,
        data.lineColors,
        data.numLines,
      )
      region.lineBuffer = this.createStorageBuffer(device, lineInterleaved)
      region.lineBindGroup = this.createBindGroup(device, region.lineBuffer)
      const chevronInterleaved = this.interleaveChevrons(
        data.linePositions,
        data.lineYs,
        data.lineDirections,
        data.lineColors,
        data.numLines,
      )
      region.chevronBuffer = this.createStorageBuffer(device, chevronInterleaved)
      region.chevronBindGroup = this.createBindGroup(device, region.chevronBuffer)
    }

    if (data.numArrows > 0) {
      const arrowInterleaved = this.interleaveArrows(
        data.arrowXs,
        data.arrowYs,
        data.arrowDirections,
        data.arrowHeights,
        data.arrowColors,
        data.numArrows,
      )
      region.arrowBuffer = this.createStorageBuffer(device, arrowInterleaved)
      region.arrowBindGroup = this.createBindGroup(device, region.arrowBuffer)
    }

    this.regions.set(regionNumber, region)
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    if (this.glFallback) {
      this.glFallback.renderBlocks(blocks, state)
      return
    }
    const device = CanvasFeatureRenderer.device
    if (!device || !CanvasFeatureRenderer.rectPipeline || !this.context) {
      return
    }

    const { canvasWidth, canvasHeight, scrollY } = state

    if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
      this.canvas.width = canvasWidth
      this.canvas.height = canvasHeight
    }

    const textureView = this.context.getCurrentTexture().createView()
    let isFirst = true

    for (const block of blocks) {
      const region = this.regions.get(block.regionNumber)
      if (!region) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = this.splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.writeUniforms(
        device,
        bpStartHi,
        bpStartLo,
        clippedLengthBp,
        Math.floor(region.regionStart),
        canvasHeight,
        scissorW,
        scrollY,
        bpPerPx,
      )

      const encoder = device.createCommandEncoder()
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
        pass.setPipeline(CanvasFeatureRenderer.linePipeline!)
        pass.setBindGroup(0, region.lineBindGroup)
        pass.draw(6, region.lineCount)
      }

      if (region.chevronBindGroup && region.lineCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.chevronPipeline!)
        pass.setBindGroup(0, region.chevronBindGroup)
        pass.draw(MAX_VISIBLE_CHEVRONS_PER_LINE * 12, region.lineCount)
      }

      if (region.rectBindGroup && region.rectCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.rectPipeline!)
        pass.setBindGroup(0, region.rectBindGroup)
        pass.draw(6, region.rectCount)
      }

      if (region.arrowBindGroup && region.arrowCount > 0) {
        pass.setPipeline(CanvasFeatureRenderer.arrowPipeline!)
        pass.setBindGroup(0, region.arrowBindGroup)
        pass.draw(9, region.arrowCount)
      }

      pass.end()
      device.queue.submit([encoder.finish()])
      isFirst = false
    }

    if (isFirst) {
      const encoder = device.createCommandEncoder()
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
      device.queue.submit([encoder.finish()])
    }
  }

  pruneStaleRegions(activeRegions: number[]) {
    if (this.glFallback) {
      this.glFallback.pruneStaleRegions(new Set(activeRegions))
      return
    }
    const active = new Set<number>(activeRegions)
    for (const [num, region] of this.regions) {
      if (!active.has(num)) {
        this.destroyRegion(region)
        this.regions.delete(num)
      }
    }
  }

  dispose() {
    if (this.glFallback) {
      this.glFallback.destroy()
      this.glFallback = null
      return
    }
    for (const region of this.regions.values()) {
      this.destroyRegion(region)
    }
    this.regions.clear()
    this.uniformBuffer?.destroy()
    this.uniformBuffer = null
    this.context = null
  }

  private destroyRegion(region: GpuRegionData) {
    region.rectBuffer?.destroy()
    region.lineBuffer?.destroy()
    region.chevronBuffer?.destroy()
    region.arrowBuffer?.destroy()
  }

  private createStorageBuffer(device: GPUDevice, data: ArrayBuffer) {
    const buf = device.createBuffer({
      size: Math.max(data.byteLength, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(buf, 0, data)
    return buf
  }

  private createBindGroup(device: GPUDevice, storageBuffer: GPUBuffer) {
    return device.createBindGroup({
      layout: CanvasFeatureRenderer.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: storageBuffer } },
        { binding: 1, resource: { buffer: this.uniformBuffer! } },
      ],
    })
  }

  private writeUniforms(
    device: GPUDevice,
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
    device.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData)
  }

  private splitPositionWithFrac(value: number): [number, number] {
    const intValue = Math.floor(value)
    const frac = value - intValue
    const loInt = intValue & 0xfff
    const hi = intValue - loInt
    const lo = loInt + frac
    return [hi, lo]
  }

  private interleaveRects(
    positions: Uint32Array,
    ys: Float32Array,
    heights: Float32Array,
    colors: Uint8Array,
    count: number,
  ) {
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
}
