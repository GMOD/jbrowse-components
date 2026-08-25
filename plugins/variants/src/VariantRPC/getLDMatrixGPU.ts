/// <reference types="@webgpu/types" />

import {
  calculateLDStatsDosageBits,
  calculateLDStatsPhasedBits,
  packDosages,
} from '@jbrowse/ld-core'
import { getGpuDevice, onDeviceLost } from '@jbrowse/render-core/gpuDevice'

import * as ldCompute from '../LDDisplay/components/shaders/ldCompute.generated.ts'
import * as ldPhasedCompute from '../LDDisplay/components/shaders/ldPhasedCompute.generated.ts'
import { bandCellCount } from './ldBand.ts'
import { planLDDispatch } from './ldDispatchPlan.ts'
import { findLDSpotCheckMismatch } from './ldGpuSpotCheck.ts'

import type { LDMetric } from './getLDMatrix.ts'
import type { DispatchPlan } from './ldDispatchPlan.ts'
import type { PackedHaplotypes } from '@jbrowse/ld-core'
import type { ShaderBinding } from '@jbrowse/render-core/hal'

const MIN_WORK = 500_000

// Which of the pair a cell holds, matching `computeLDMatrixCPU`'s one-line
// selection and the kernels' `ldFinalize`.
function metricOf(stats: { r2: number; dprime: number }, ldMetric: LDMetric) {
  return ldMetric === 'dprime' ? stats.dprime : stats.r2
}

// Throws rather than returning null so `getLDMatrix`'s catch reports WHY the
// matrix went to the CPU. A silent null there is the same silence this exists to
// break — see `ldGpuSpotCheck.ts` for what it is watching for.
function assertSpotCheck(
  values: Float32Array,
  n: number,
  band: number,
  statsFor: (i: number, j: number) => number,
) {
  const mismatch = findLDSpotCheckMismatch(values, n, band, statsFor)
  if (mismatch) {
    throw new Error(
      `LD compute returned a matrix its CPU twin disagrees with: ${mismatch}. ` +
        `A dispatch that comes back incomplete raises no validation error, so ` +
        `this is the only thing that sees one.`,
    )
  }
}

interface ComputeState {
  device: GPUDevice
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
  // Carried alongside the layout it was built from, so the bind group is
  // written against the same reflected indices.
  bindings: readonly ShaderBinding[]
}

// Built from the kernel's own reflected binding table rather than restated
// here. This was three hardcoded entries — 0 read-only-storage, 1 storage, 2
// uniform — which is exactly what `ldCompute.slang`'s `[[vk::binding]]`
// attributes say, transcribed by hand into the one place a mismatch shows up as
// a validation failure at pipeline creation. `BINDINGS` is the same fact,
// reflected.
function makeBindGroupLayout(
  device: GPUDevice,
  bindings: readonly ShaderBinding[],
) {
  return device.createBindGroupLayout({
    entries: bindings.map(b => {
      if (b.kind === 'texture' || b.kind === 'sampler') {
        // A compute kernel here binds buffers only; the codegen can describe a
        // sampler, and this driver has no case for one.
        throw new Error(
          `LD compute: binding ${b.index} ('${b.name}') is a ${b.kind}, which ` +
            `this dispatch does not bind`,
        )
      }
      return {
        binding: b.index,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: b.kind },
      }
    }),
  })
}

// Both LD kernels differ only in source + entry point, so one cache factory
// serves both. They also happen to share a binding table — asserted rather than
// assumed, since each now carries its own. The cache is invalidated on device
// loss so the next call rebuilds against a freshly acquired device.
function makePipelineCache(
  code: string,
  entryPoint: string,
  bindings: readonly ShaderBinding[],
) {
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
      const bindGroupLayout = makeBindGroupLayout(device, bindings)
      const pipeline = await device.createComputePipelineAsync({
        layout: device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        }),
        compute: { module, entryPoint },
      })
      state = { device, pipeline, bindGroupLayout, bindings }
      statePromise = null
      return state
    })()
    return statePromise
  }
}

const ensureUnphasedPipeline = makePipelineCache(
  ldCompute.WGSL_SOURCE,
  ldCompute.COMPUTE_ENTRY_POINT,
  ldCompute.BINDINGS,
)
const ensurePhasedPipeline = makePipelineCache(
  ldPhasedCompute.WGSL_SOURCE,
  ldPhasedCompute.COMPUTE_ENTRY_POINT,
  ldPhasedCompute.BINDINGS,
)

async function runGPUCompute({
  device,
  pipeline,
  bindGroupLayout,
  bindings,
  inputBuffer,
  uniformData,
  numCells,
  dispatch,
}: {
  device: GPUDevice
  pipeline: GPUComputePipeline
  bindGroupLayout: GPUBindGroupLayout
  bindings: readonly ShaderBinding[]
  inputBuffer: Uint32Array
  uniformData: ArrayBuffer
  numCells: number
  dispatch: DispatchPlan
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

    // Indices come from the same reflected table the layout was built from, so
    // the group and the layout cannot disagree about them. Matched by ROLE
    // rather than by name: the two kernels call their input `genotypes` and
    // `haps`, and a kind is what the buffer usage actually corresponds to.
    const bufferFor: Record<string, GPUBuffer> = {
      'read-only-storage': genoBuffer,
      storage: ldBuffer,
      uniform: uniformBuffer,
    }
    const bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: bindings.map(b => ({
        binding: b.index,
        resource: { buffer: bufferFor[b.kind]! },
      })),
    })

    // A failed dispatch is not an exception: WebGPU records validation errors
    // asynchronously, leaves ldBuffer unwritten, and mapAsync still resolves —
    // so without this scope an over-limit or otherwise invalid dispatch reads
    // back as a plausible all-zero matrix and the caller's CPU fallback never
    // fires. Throwing here is what routes any such failure to the CPU path.
    device.pushErrorScope('validation')
    const encoder = device.createCommandEncoder()
    const pass = encoder.beginComputePass()
    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(dispatch.width, dispatch.height)
    pass.end()
    encoder.copyBufferToBuffer(ldBuffer, 0, readbackBuffer, 0, numCells * 4)
    device.queue.submit([encoder.finish()])
    const validationError = await device.popErrorScope()
    if (validationError) {
      throw new Error(`LD compute dispatch failed: ${validationError.message}`)
    }

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
  band: number,
  ldMetric: LDMetric,
  signedLD: boolean,
): Promise<Float32Array | null> {
  const n = encodedGenotypes.length
  if (n < 2) {
    return new Float32Array(0)
  }

  const numSamples = encodedGenotypes[0]!.length
  const numCells = bandCellCount(n, band)

  if (numCells * numSamples < MIN_WORK) {
    return null
  }

  const device = await getGpuDevice()
  if (!device) {
    return null
  }

  // Three bit planes per SNP, laid out [het, homAlt, valid] to match getWord in
  // ldCompute.slang. packDosages is the same function the CPU fallback packs
  // with, so the two paths cannot drift into different encodings of the same
  // genotypes — the only difference here is that the planes are copied into one
  // flat buffer for a single upload.
  const numWords = Math.ceil(numSamples / 32)
  const plan = planLDDispatch(
    device.limits,
    numCells,
    n * 3 * numWords * 4,
    ldCompute.WORKGROUP_SIZE_X,
  )
  if (!plan) {
    return null
  }

  const { pipeline, bindGroupLayout, bindings } =
    await ensureUnphasedPipeline(device)

  const genoPacked = new Uint32Array(n * 3 * numWords)
  for (let snp = 0; snp < n; snp++) {
    const { het, homAlt, valid } = packDosages(encodedGenotypes[snp]!)
    const base = snp * 3 * numWords
    genoPacked.set(het, base)
    genoPacked.set(homAlt, base + numWords)
    genoPacked.set(valid, base + numWords * 2)
  }

  const uniformData = new ArrayBuffer(ldCompute.UNIFORMS_SIZE_BYTES)
  ldCompute.writeUniforms(uniformData, {
    numSnps: n,
    numWords,
    band,
    ldMetric: ldMetric === 'dprime' ? 1 : 0,
    signedLD: signedLD ? 1 : 0,
    dispatchRowStride: plan.rowStride,
  })

  const values = await runGPUCompute({
    device,
    pipeline,
    bindGroupLayout,
    bindings,
    inputBuffer: genoPacked,
    uniformData,
    numCells,
    dispatch: plan,
  })
  assertSpotCheck(values, n, band, (i, j) =>
    metricOf(
      calculateLDStatsDosageBits(
        packDosages(encodedGenotypes[i]!),
        packDosages(encodedGenotypes[j]!),
        signedLD,
      ),
      ldMetric,
    ),
  )
  return values
}

export async function computeLDMatrixGPUPhased(
  packedHaplotypes: PackedHaplotypes[],
  band: number,
  ldMetric: LDMetric,
  signedLD: boolean,
): Promise<Float32Array | null> {
  const n = packedHaplotypes.length
  if (n < 2) {
    return new Float32Array(0)
  }

  const numWords = packedHaplotypes[0]!.words
  const numCells = bandCellCount(n, band)

  // Work proportional to numCells * numWords (each word covers 32 samples)
  if (numCells * numWords * 32 < MIN_WORK) {
    return null
  }

  const device = await getGpuDevice()
  if (!device) {
    return null
  }

  const plan = planLDDispatch(
    device.limits,
    numCells,
    n * 4 * numWords * 4,
    ldPhasedCompute.WORKGROUP_SIZE_X,
  )
  if (!plan) {
    return null
  }

  const { pipeline, bindGroupLayout, bindings } =
    await ensurePhasedPipeline(device)

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
    band,
    ldMetric: ldMetric === 'dprime' ? 1 : 0,
    signedLD: signedLD ? 1 : 0,
    dispatchRowStride: plan.rowStride,
  })

  const values = await runGPUCompute({
    device,
    pipeline,
    bindGroupLayout,
    bindings,
    inputBuffer: hapsPacked,
    uniformData,
    numCells,
    dispatch: plan,
  })
  assertSpotCheck(values, n, band, (i, j) =>
    metricOf(
      calculateLDStatsPhasedBits(
        packedHaplotypes[i]!,
        packedHaplotypes[j]!,
        signedLD,
      ),
      ldMetric,
    ),
  )
  return values
}
