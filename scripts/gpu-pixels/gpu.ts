/// <reference types="@webgpu/types" />

import { create, globals } from 'webgpu'

import { pipelineRecipe } from '../../packages/render-core/src/hal/deviceGpuCache.ts'
import { slangPass } from '../../packages/render-core/src/slangPass.ts'

import type { PixelFixture } from './fixture.ts'

export interface Gpu {
  device: GPUDevice
  label: string
  // dawn.node does not keep a device's parents alive, and collecting either
  // under a live device aborts the process.
  parents: [GPU, GPUAdapter]
}

/**
 * A device on Dawn, the WebGPU inside Chrome. `adapter` picks one by a
 * substring of its name, as Dawn's `adapter=` toggle matches it (`llvmpipe`
 * for Mesa's software Vulkan); absent, the low-power GPU.
 */
export async function openGpu(adapter: string | undefined): Promise<Gpu> {
  Object.assign(globalThis, globals)
  const gpu = create(adapter ? ['backend=vulkan', `adapter=${adapter}`] : [])
  const found = await gpu.requestAdapter({ powerPreference: 'low-power' })
  if (!found) {
    throw new Error(
      `Dawn found no adapter${adapter ? ` matching ${adapter}` : ''}`,
    )
  }
  const device = await found.requestDevice()
  device.addEventListener('uncapturederror', e => {
    console.error('GPU error:', e.error.message)
  })
  const { description, vendor, architecture } = found.info
  return {
    device,
    label: description || `${vendor} ${architecture}`,
    parents: [gpu, found],
  }
}

const FORMAT = 'rgba8unorm'

function textureOf(
  device: GPUDevice,
  t: { data: Uint8Array; width: number; height: number },
) {
  const texture = device.createTexture({
    size: [t.width, t.height],
    format: FORMAT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  })
  device.queue.writeTexture({ texture }, t.data, { bytesPerRow: t.width * 4 }, [
    t.width,
    t.height,
  ])
  return texture
}

/**
 * The fixture drawn through the pipeline the WebGPU HAL builds for its pass
 * (`pipelineRecipe`: layout, blend, topology), into an RGBA8 target at
 * `samples` resolved to one, read back as premultiplied RGBA8 rows.
 */
export async function render(
  { device }: Gpu,
  f: PixelFixture,
  wgsl: string,
  dpr: number,
  samples: 1 | 4,
) {
  const w = Math.round(f.width * dpr)
  const h = Math.round(f.height * dpr)
  const desc = slangPass({ id: f.name, mod: f.mod })
  const recipe = pipelineRecipe(desc, wgsl, samples)
  const module = device.createShaderModule({ code: wgsl })
  const errors = (await module.getCompilationInfo()).messages.filter(
    m => m.type === 'error',
  )
  if (errors.length > 0) {
    throw new Error(`${f.name}: ${errors.map(m => m.message).join('; ')}`)
  }
  const bindGroupLayout = device.createBindGroupLayout({
    entries: recipe.bindGroupLayout,
  })
  const pipeline = await device.createRenderPipelineAsync({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: { module, entryPoint: 'vs_main', buffers: [recipe.vertexBuffer] },
    fragment: {
      module,
      entryPoint: 'fs_main',
      targets: [
        { format: FORMAT, ...(recipe.blend && { blend: recipe.blend }) },
      ],
    },
    primitive: { topology: recipe.topology },
    multisample: samples === 1 ? undefined : { count: samples },
  })

  const uniformBytes = f.uniforms(dpr)
  const uniformBuffer = device.createBuffer({
    size: uniformBytes.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(uniformBuffer, 0, uniformBytes)
  const instanceBytes = f.instances()
  const vertexBuffer = device.createBuffer({
    size: Math.max(instanceBytes.byteLength, 4),
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(vertexBuffer, 0, instanceBytes)

  const blank = { data: new Uint8Array(4), width: 1, height: 1 }
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: desc.bindings.map(b => {
      if (b.kind === 'uniform') {
        return { binding: b.index, resource: { buffer: uniformBuffer } }
      }
      if (b.kind === 'texture') {
        const t = textureOf(device, f.textures?.[b.name] ?? blank)
        return { binding: b.index, resource: t.createView() }
      }
      const filter =
        desc.textures?.find(t => t.name === b.name)?.filter ?? 'nearest'
      return {
        binding: b.index,
        resource: device.createSampler({
          magFilter: filter,
          minFilter: filter,
          addressModeU: 'clamp-to-edge',
          addressModeV: 'clamp-to-edge',
        }),
      }
    }),
  })

  const target = device.createTexture({
    size: [w, h],
    format: FORMAT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  })
  const msaa =
    samples > 1
      ? device.createTexture({
          size: [w, h],
          format: FORMAT,
          sampleCount: samples,
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
      : undefined
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: (msaa ?? target).createView(),
        resolveTarget: msaa ? target.createView() : undefined,
        loadOp: 'clear',
        storeOp: msaa ? 'discard' : 'store',
        clearValue: [0, 0, 0, 0],
      },
    ],
  })
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup, [0])
  pass.setVertexBuffer(0, vertexBuffer)
  pass.draw(desc.verticesPerInstance, f.count)
  pass.end()
  const bytesPerRow = Math.ceil((w * 4) / 256) * 256
  const readback = device.createBuffer({
    size: bytesPerRow * h,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  encoder.copyTextureToBuffer(
    { texture: target },
    { buffer: readback, bytesPerRow },
    [w, h],
  )
  device.queue.submit([encoder.finish()])
  await readback.mapAsync(GPUMapMode.READ)
  const rows = new Uint8Array(readback.getMappedRange())
  const px = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    px.set(rows.subarray(y * bytesPerRow, y * bytesPerRow + w * 4), y * w * 4)
  }
  readback.unmap()
  for (const r of [readback, uniformBuffer, vertexBuffer, target, msaa]) {
    r?.destroy()
  }
  return { px, w, h }
}
