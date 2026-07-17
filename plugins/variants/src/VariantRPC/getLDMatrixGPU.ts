/// <reference types="@webgpu/types" />

import { getGpuDevice, onDeviceLost } from '@jbrowse/render-core/gpuDevice'

import * as ldCompute from '../LDDisplay/components/shaders/ldCompute.generated.ts'
import * as ldPhasedCompute from '../LDDisplay/components/shaders/ldPhasedCompute.generated.ts'

import type { LDMetric } from './getLDMatrix.ts'
import type { PackedHaplotypes } from '@jbrowse/ld-core'

const MIN_WORK = 500_000

interface ComputeState {
  device: GPUDevice
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
}

function makeBindGroupLayout(device: GPUDevice) {
  return device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'storage' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
    ],
  })
}

// Both LD kernels share a bind group layout and differ only in source + entry
// point, so one cache factory serves both. The cache is invalidated on device
// loss so the next call rebuilds against a freshly acquired device.
function makePipelineCache(code: string, entryPoint: string) {
  let state: ComputeState | null = null
  // Serializes concurrent callers during async pipeline creation.
  let statePromise: Promise<ComputeState> | null = null
  onDeviceLost(() => {
    state = null
    statePromise = null
  })
  return async function ensurePipeline(device: GPUDevice) {
    if (state?.device === device) {
      return state
    }
    if (statePromise) {
      return statePromise
    }
    statePromise = (async () => {
      const module = device.createShaderModule({ code })
      const bindGroupLayout = makeBindGroupLayout(device)
      const pipeline = await device.createComputePipelineAsync({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module, entryPoint },
      })
      state = { device, pipeline, bindGroupLayout }
      statePromise = null
      return state
    })()
    return statePromise
  }
}

const ensureUnphasedPipeline = makePipelineCache(
  ldCompute.WGSL_SOURCE,
  ldCompute.COMPUTE_ENTRY_POINT,
)
const ensurePhasedPipeline = makePipelineCache(
  ldPhasedCompute.WGSL_SOURCE,
  ldPhasedCompute.COMPUTE_ENTRY_POINT,
)

async function runGPUCompute({
  device,
  pipeline,
  bindGroupLayout,
  inputBuffer,
  uniformData,
  numCells,
  workgroupSize,
}: {
  device: GPUDevice
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
  inputBuffer: Uint32Array
  uniformData: ArrayBuffer
  numCells: number
  workgroupSize: number
}): Promise<Float32Array> {
  const genoBuffer = device.createBuffer({
    size: inputBuffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  const ldBuffer = device.createBuffer({
    size: numCells * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })
  const uniformBuffer = device.createBuffer({
    size: uniformData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  const readbackBuffer = device.createBuffer({
    size: numCells * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  })

  try {
    device.queue.writeBuffer(
      genoBuffer,
      0,
      inputBuffer.buffer,
      inputBuffer.byteOffset,
      inputBuffer.byteLength,
    )
    device.queue.writeBuffer(uniformBuffer, 0, uniformData)

    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: genoBuffer } },
        { binding: 1, resource: { buffer: ldBuffer } },
        { binding: 2, resource: { buffer: uniformBuffer } },
      ],
    })

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(Math.ceil(numCells / workgroupSize))
    pass.end()
    encoder.copyBufferToBuffer(ldBuffer, 0, readbackBuffer, 0, numCells * 4)
    device.queue.submit([encoder.finish()])

    await readbackBuffer.mapAsync(GPUMapMode.READ)
    // Copy out of the mapped range before destroy() (which implicitly unmaps
    // and detaches the underlying ArrayBuffer).
    return new Float32Array(readbackBuffer.getMappedRange()).slice()
  } finally {
    genoBuffer.destroy()
    ldBuffer.destroy()
    uniformBuffer.destroy()
    readbackBuffer.destroy()
  }
}

export async function computeLDMatrixGPU(
  encodedGenotypes: Int8Array[],
  ldMetric: LDMetric,
  signedLD: boolean,
): Promise<Float32Array | null> {
  const n = encodedGenotypes.length
  if (n < 2) {
    return new Float32Array(0)
  }

  const numSamples = encodedGenotypes[0]!.length
  const numCells = (n * (n - 1)) / 2

  if (numCells * numSamples < MIN_WORK) {
    return null
  }

  const device = await getGpuDevice()
  if (!device) {
    return null
  }

  const { pipeline, bindGroupLayout } = await ensureUnphasedPipeline(device)

  // Pack genotypes: 4 samples per u32, missing (-1) stored as 0xFF.
  // Build each word in a local variable (1 write vs 4 read-modify-writes).
  const numSamplesPacked = Math.ceil(numSamples / 4)
  const genoPacked = new Uint32Array(n * numSamplesPacked)
  const fullWords = numSamples >> 2
  const remainder = numSamples & 3
  for (let snp = 0; snp < n; snp++) {
    const geno = encodedGenotypes[snp]!
    const base = snp * numSamplesPacked
    for (let w = 0, s = 0; w < fullWords; w++, s += 4) {
      const b0 = geno[s]! < 0 ? 0xff : geno[s]!
      const b1 = geno[s + 1]! < 0 ? 0xff : geno[s + 1]!
      const b2 = geno[s + 2]! < 0 ? 0xff : geno[s + 2]!
      const b3 = geno[s + 3]! < 0 ? 0xff : geno[s + 3]!
      genoPacked[base + w] = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    }
    if (remainder) {
      const s = fullWords << 2
      let word = geno[s]! < 0 ? 0xff : geno[s]!
      if (remainder > 1) {
        word |= (geno[s + 1]! < 0 ? 0xff : geno[s + 1]!) << 8
      }
      if (remainder > 2) {
        word |= (geno[s + 2]! < 0 ? 0xff : geno[s + 2]!) << 16
      }
      genoPacked[base + fullWords] = word
    }
  }

  const uniformData = new ArrayBuffer(ldCompute.UNIFORMS_SIZE_BYTES)
  ldCompute.writeUniforms(uniformData, {
    numSnps: n,
    numSamples,
    numSamplesPacked,
    ldMetric: ldMetric === 'dprime' ? 1 : 0,
    signedLD: signedLD ? 1 : 0,
  })

  return runGPUCompute({
    device,
    pipeline,
    bindGroupLayout,
    inputBuffer: genoPacked,
    uniformData,
    numCells,
    workgroupSize: ldCompute.WORKGROUP_SIZE_X,
  })
}

export async function computeLDMatrixGPUPhased(
  packedHaplotypes: PackedHaplotypes[],
  ldMetric: LDMetric,
  signedLD: boolean,
): Promise<Float32Array | null> {
  const n = packedHaplotypes.length
  if (n < 2) {
    return new Float32Array(0)
  }

  const numWords = packedHaplotypes[0]!.words
  const numCells = (n * (n - 1)) / 2

  // Work proportional to numCells * numWords (each word covers 32 samples)
  if (numCells * numWords * 32 < MIN_WORK) {
    return null
  }

  const device = await getGpuDevice()
  if (!device) {
    return null
  }

  const { pipeline, bindGroupLayout } = await ensurePhasedPipeline(device)

  // Layout: for each SNP i, 4 arrays of numWords each:
  // [altH1[0..numWords-1], validH1[0..numWords-1], altH2[0..numWords-1], validH2[0..numWords-1]]
  const hapsPacked = new Uint32Array(n * 4 * numWords)
  for (let snp = 0; snp < n; snp++) {
    const h = packedHaplotypes[snp]!
    const base = snp * 4 * numWords
    hapsPacked.set(h.altH1, base)
    hapsPacked.set(h.validH1, base + numWords)
    hapsPacked.set(h.altH2, base + numWords * 2)
    hapsPacked.set(h.validH2, base + numWords * 3)
  }

  const uniformData = new ArrayBuffer(ldPhasedCompute.UNIFORMS_SIZE_BYTES)
  ldPhasedCompute.writeUniforms(uniformData, {
    numSnps: n,
    numWords,
    ldMetric: ldMetric === 'dprime' ? 1 : 0,
    signedLD: signedLD ? 1 : 0,
  })

  return runGPUCompute({
    device,
    pipeline,
    bindGroupLayout,
    inputBuffer: hapsPacked,
    uniformData,
    numCells,
    workgroupSize: ldPhasedCompute.WORKGROUP_SIZE_X,
  })
}
