import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { COVERAGE_PASS } from '../../features/coverage/packGpu.ts'
import { INDICATOR_PASS } from '../../features/indicator/packGpu.ts'
import { INTERBASE_PASS } from '../../features/interbase/packGpu.ts'
import { MOD_COVERAGE_PASS } from '../../features/modCoverage/packGpu.ts'
import { SNP_COVERAGE_PASS } from '../../features/snpCoverage/packGpu.ts'
import {
  ALIGNMENTS_PASSES,
  GPU_COVERAGE_PASS,
  GPU_PILEUP_PASS,
  GpuAlignmentsRenderer,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsSources } from './rendererTypes.ts'
import type { PipelineDescriptor } from '@jbrowse/render-core/hal'

/**
 * A pass has to be wired in three places to paint: registered in
 * `ALIGNMENTS_PASSES`, drawn, and UPLOADED. Two of those are now structural —
 * an `InstancePass` carries its own packer, so a drawn pass has an upload by
 * construction, and `ALIGNMENTS_PASSES` is built from the registries the draw
 * loops read, so a drawn pass is registered by construction.
 *
 * What no type can see is whether the packer a pass carries actually WRITES
 * anything. Every one of them reads fields off the payload, and a wrong field
 * name that happens to type-check — `interbasePackedBuffer` where
 * `snpPackedBuffer` was meant, real, and the right type — packs an empty or
 * wrong-length buffer, uploads nothing (or the wrong pass's instances), and
 * paints a layer missing on the GPU backend only while Canvas2D still draws
 * it.
 *
 * So: hand every pass a fixture with exactly one instance's worth of data, and
 * require that every pass uploads.
 */

const START = 10_000

// One instance's worth of bytes for a pass, at that pass's generated stride.
// The five coverage passes take a worker-packed buffer verbatim, so sizing
// their fixtures by hand is sizing them the way no packer would: at the real
// stride, "one instance" is one instance on both sides.
function oneInstance(pass: PipelineDescriptor) {
  return new ArrayBuffer(pass.instanceStride)
}

// One instance in every feature array, so every pass has something to upload.
// Companion arrays are sized to match their positions array — a short one packs
// `undefined` into a typed array as 0 rather than throwing, which would let a
// pass "upload" without the fixture really covering it.
function fullyPopulated() {
  return makePileupDataResult({
    readPositions: new Uint32Array([START, START + 100]),
    readYs: new Uint16Array([0]),

    gapPositions: new Uint32Array([START + 10, START + 20]),
    gapYs: new Uint16Array([0]),
    gapLengths: new Uint32Array([10]),
    gapTypes: new Uint8Array([0]),
    gapFrequencies: new Uint8Array([255]),

    mismatchPositions: new Uint32Array([START + 5]),
    mismatchYs: new Uint16Array([0]),
    mismatchBases: new Uint8Array([1]),
    mismatchFrequencies: new Uint8Array([255]),
    mismatchQuals: new Uint8Array([40]),

    // Worker order is (insertions, softclips, hardclips) — one of each, so the
    // insertion pass sees 1 instance and the clip pass 2.
    interbasePositions: new Uint32Array([START + 30, START + 40, START + 50]),
    interbaseYs: new Uint16Array([0, 0, 0]),
    interbaseLengths: new Uint32Array([5, 5, 5]),
    interbaseTypes: new Uint8Array([0, 1, 2]),
    interbaseFrequencies: new Uint8Array([255, 255, 255]),
    numInsertions: 1,
    numSoftclips: 1,
    numHardclips: 1,

    softclipBasePositions: new Uint32Array([START + 41]),
    softclipBaseYs: new Uint16Array([0]),
    softclipBaseBases: new Uint8Array([1]),

    modificationPositions: new Uint32Array([START + 60]),
    modificationYs: new Uint16Array([0]),
    modificationColors: new Uint32Array([0xff00ff00]),

    perBaseQualPositions: new Uint32Array([START + 70]),
    perBaseQualYs: new Uint16Array([0]),
    perBaseQualScores: new Uint8Array([30]),

    perBaseLetterPositions: new Uint32Array([START + 80]),
    perBaseLetterYs: new Uint16Array([0]),
    perBaseLetterBases: new Uint8Array([2]),

    connectingLinePositions: new Uint32Array([START + 90, START + 95]),
    connectingLineYs: new Uint16Array([0]),

    overlapPositions: new Uint32Array([START + 96, START + 98]),
    overlapYs: new Uint16Array([0]),

    linkedReadLinePositions: new Uint32Array([START + 10, START + 90]),
    linkedReadLineYs: new Uint16Array([0, 0]),
    linkedReadLineColorTypes: new Uint8Array([0]),
    numLinkedReadLines: 1,

    coverageGpuBinCount: 1,
    coveragePackedBuffer: oneInstance(COVERAGE_PASS),
    snpPackedBuffer: oneInstance(SNP_COVERAGE_PASS),
    interbasePackedBuffer: oneInstance(INTERBASE_PASS),
    indicatorPackedBuffer: oneInstance(INDICATOR_PASS),
    modCovPackedBuffer: oneInstance(MOD_COVERAGE_PASS),
  })
}

function oneRegion(): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, fullyPopulated()]]),
        arcsRpcDataMap: new Map(),
      },
    ],
    readConnectionsLineWidth: 1,
  }
}

function uploadedPasses() {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  new GpuAlignmentsRenderer(hal).sync(oneRegion())
  return new Set(
    hal.calls.filter(c => c.method === 'uploadBuffer').map(c => c.args[1]),
  )
}

describe('every drawn pass is also uploaded', () => {
  it('the fixture actually populates every pass', () => {
    // Guards the guard: if a future field rename empties an array, the
    // assertions below would pass vacuously by uploading nothing at all.
    expect(uploadedPasses().size).toBe(
      Object.keys(GPU_PILEUP_PASS).length +
        Object.keys(GPU_COVERAGE_PASS).length,
    )
  })

  it('every pileup-layer pass gets a buffer', () => {
    const uploaded = uploadedPasses()
    for (const [layer, pass] of Object.entries(GPU_PILEUP_PASS)) {
      expect({ layer, uploaded: uploaded.has(pass.id) }).toEqual({
        layer,
        uploaded: true,
      })
    }
  })

  it('every coverage-band pass gets a buffer', () => {
    const uploaded = uploadedPasses()
    for (const [layer, pass] of Object.entries(GPU_COVERAGE_PASS)) {
      expect({ layer, uploaded: uploaded.has(pass.id) }).toEqual({
        layer,
        uploaded: true,
      })
    }
  })
})
