/// <reference types="@webgpu/types" />

import getGpuDevice from '@jbrowse/core/gpu/getGpuDevice'

import { ldComputeShader } from './ldComputeShader.ts'
import { ldPhasedComputeShader } from './ldPhasedComputeShader.ts'

import type { LDMetric } from './getLDMatrix.ts'

const WORKGROUP_SIZE = 64
const MIN_WORK = 500_000

interface ComputeState {
  device: GPUDevice
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
}

interface PackedHaplotypes {
  altH1: Uint32Array
  validH1: Uint32Array
  altH2: Uint32Array
  validH2: Uint32Array
  words: number
}

let computeState: ComputeState | null = null
let computeStatePromise: Promise<ComputeState> | null = null

let phasedComputeState: ComputeState | null = null
let phasedComputeStatePromise: Promise<ComputeState> | null = null

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

async function ensurePipeline(device: GPUDevice): Promise<ComputeState> {
  if (computeState?.device === device) {
    return computeState
  }
  if (computeStatePromise) {
    return computeStatePromise
  }
  computeStatePromise = (async () => {
    const module = device.createShaderModule({ code: ldComputeShader })
    const bindGroupLayout = makeBindGroupLayout(device)
    const pipeline = await device.createComputePipelineAsync({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      compute: { module, entryPoint: 'computeLD' },
    })
    computeState = { device, pipeline, bindGroupLayout }
    computeStatePromise = null
    return computeState
  })()
  return computeStatePromise
}

async function ensurePhasedPipeline(device: GPUDevice): Promise<ComputeState> {
  if (phasedComputeState?.device === device) {
    return phasedComputeState
  }
  if (phasedComputeStatePromise) {
    return phasedComputeStatePromise
  }
  phasedComputeStatePromise = (async () => {
    const module = device.createShaderModule({ code: ldPhasedComputeShader })
    const bindGroupLayout = makeBindGroupLayout(device)
    const pipeline = await device.createComputePipelineAsync({
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      compute: { module, entryPoint: 'computeLDPhased' },
    })
    phasedComputeState = { device, pipeline, bindGroupLayout }
    phasedComputeStatePromise = null
    return phasedComputeState
  })()
  return phasedComputeStatePromise
}

async function runGPUCompute(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  bindGroupLayout: GPUBindGroupLayout,
  inputBuffer: Uint32Array,
  uniformData: Uint32Array,
  numCells: number,
): Promise<Float32Array> {
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
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      uniformData.buffer,
      uniformData.byteOffset,
      uniformData.byteLength,
    )

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
    pass.dispatchWorkgroups(Math.ceil(numCells / WORKGROUP_SIZE))
    pass.end()
    encoder.copyBufferToBuffer(ldBuffer, 0, readbackBuffer, 0, numCells * 4)
    device.queue.submit([encoder.finish()])

    await readbackBuffer.mapAsync(GPUMapMode.READ)
    return new Float32Array(readbackBuffer.getMappedRange().slice(0))
  } finally {
    readbackBuffer.unmap()
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

  const { pipeline, bindGroupLayout } = await ensurePipeline(device)

  // Pack genotypes: 4 samples per u32, missing (-1) stored as 0xFF
  const numSamplesPacked = Math.ceil(numSamples / 4)
  const genoPacked = new Uint32Array(n * numSamplesPacked)
  for (let snp = 0; snp < n; snp++) {
    const geno = encodedGenotypes[snp]!
    for (let s = 0; s < numSamples; s++) {
      const wordIdx = snp * numSamplesPacked + (s >> 2)
      const byte = geno[s]! < 0 ? 0xff : geno[s]! & 0xff
      genoPacked[wordIdx] = genoPacked[wordIdx]! | (byte << ((s & 3) * 8))
    }
  }

  const uniformData = new Uint32Array(8)
  uniformData[0] = n
  uniformData[1] = numSamples
  uniformData[2] = numSamplesPacked
  uniformData[3] = ldMetric === 'dprime' ? 1 : 0
  uniformData[4] = signedLD ? 1 : 0

  return runGPUCompute(
    device,
    pipeline,
    bindGroupLayout,
    genoPacked,
    uniformData,
    numCells,
  )
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

  const uniformData = new Uint32Array(8)
  uniformData[0] = n
  uniformData[1] = numWords
  uniformData[2] = ldMetric === 'dprime' ? 1 : 0
  uniformData[3] = signedLD ? 1 : 0

  return runGPUCompute(
    device,
    pipeline,
    bindGroupLayout,
    hapsPacked,
    uniformData,
    numCells,
  )
}
