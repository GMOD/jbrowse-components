import { MockHal } from '@jbrowse/render-core/hal'

import { makePileupDataResult } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import { PASS_COVERAGE } from '../../features/coverage/packGpu.ts'
import { PASS_INDICATOR } from '../../features/indicator/packGpu.ts'
import { PASS_INTERBASE } from '../../features/interbase/packGpu.ts'
import { PASS_MOD_COV } from '../../features/modCoverage/packGpu.ts'
import { PASS_SNP_COV } from '../../features/snpCoverage/packGpu.ts'
import {
  ALIGNMENTS_PASSES,
  GPU_PILEUP_PASS,
  GpuAlignmentsRenderer,
  coveragePassPlan,
} from './GpuAlignmentsRenderer.ts'

import type { AlignmentsSources, RenderState } from './rendererTypes.ts'

/**
 * A pass has to be wired in three places to paint: registered in
 * `ALIGNMENTS_PASSES`, drawn (`GPU_PILEUP_PASS` / `coveragePassPlan`), and
 * UPLOADED in `syncRegion`. `coverageParity.test.ts` locks the first two
 * together. This file locks the third, which was the one with no guard at all:
 * a drawn-but-never-uploaded pass has no buffer, so it draws zero instances —
 * no throw, no blank-screen crash, just a layer silently missing on the GPU
 * backend while Canvas2D still paints it.
 *
 * `GPU_PILEUP_UPLOAD` and `GPU_COVERAGE_UPLOAD` now make an unwired pass a
 * compile error. What is left for a runtime check is the part a `Record` can't
 * see: that the upload a map names actually WRITES something. Every entry is
 * `if (n > 0)` over a count it reads off the payload, so a wrong field name —
 * `snpPositions` where `snpRelDepths` was meant, both real, both `Uint32Array`-
 * ish — type-checks, sits in a fully-populated map, and uploads nothing.
 */

const START = 10_000

const STRIDE = new Map(ALIGNMENTS_PASSES.map(p => [p.id, p.instanceStride]))

// One instance's worth of bytes for a pass, at that pass's generated stride.
function oneInstance(passId: string) {
  return new ArrayBuffer(STRIDE.get(passId)!)
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

    // Position-aggregate passes upload a worker-packed buffer verbatim. Sized
    // from the pass's real stride, not a round number: these are the ONLY
    // uploads whose buffer and count are decided on opposite sides of the RPC
    // boundary — the worker sizes the bytes, the main thread counts a parallel
    // array — so a fixture with arbitrary byte counts is a fixture no packer
    // could have produced, and it makes the consistency case below vacuous.
    coverageGpuBinCount: 1,
    coveragePackedBuffer: oneInstance(PASS_COVERAGE),
    snpPositions: new Uint32Array([START + 1]),
    snpPackedBuffer: oneInstance(PASS_SNP_COV),
    interbaseCovPositions: new Uint32Array([START + 2]),
    interbasePackedBuffer: oneInstance(PASS_INTERBASE),
    indicatorPositions: new Uint32Array([START + 3]),
    indicatorPackedBuffer: oneInstance(PASS_INDICATOR),
    modCovPositions: new Uint32Array([START + 4]),
    modCovPackedBuffer: oneInstance(PASS_MOD_COV),
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

function uploadCalls() {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  new GpuAlignmentsRenderer(hal).sync(oneRegion())
  return hal.calls
    .filter(c => c.method === 'uploadBuffer')
    .map(c => {
      const [, pass, byteLength, count] = c.args as [
        number,
        string,
        number,
        number,
      ]
      return { pass, byteLength, count }
    })
}

function uploadedPasses() {
  return new Set(uploadCalls().map(c => c.pass))
}

describe('every drawn pass is also uploaded', () => {
  it('the fixture actually populates every pass', () => {
    // Guards the guard: if a future field rename empties an array, the
    // assertions below would pass vacuously by uploading nothing at all.
    expect(uploadedPasses().size).toBe(
      Object.keys(GPU_PILEUP_PASS).length +
        coveragePassPlan({
          coverageMaxDepth: 50,
          showInterbaseIndicators: true,
        } as unknown as RenderState).length,
    )
  })

  it('every pileup-layer pass gets a buffer', () => {
    const uploaded = uploadedPasses()
    for (const [layer, pass] of Object.entries(GPU_PILEUP_PASS)) {
      expect({ layer, uploaded: uploaded.has(pass) }).toEqual({
        layer,
        uploaded: true,
      })
    }
  })

  // The count handed to the HAL is what it multiplies the stride by to find the
  // last instance, so a count past `byteLength / stride` reads off the end of
  // the buffer — undefined pixels, no throw. For the main-thread packers this
  // is near-trivial: one function allocates `n * stride` and passes `n`. It has
  // teeth for the five coverage passes, where the WORKER sizes the buffer and
  // the main thread counts a parallel array, so nothing but this holds the two
  // sides of the RPC boundary to the same number.
  it('every upload declares exactly as many instances as its bytes hold', () => {
    for (const { pass, byteLength, count } of uploadCalls()) {
      expect({ pass, count }).toEqual({
        pass,
        count: byteLength / STRIDE.get(pass)!,
      })
    }
  })

  it('every coverage-band pass gets a buffer', () => {
    const uploaded = uploadedPasses()
    const state = {
      coverageMaxDepth: 50,
      showInterbaseIndicators: true,
    } as unknown as RenderState
    for (const [pass] of coveragePassPlan(state)) {
      expect({ pass, uploaded: uploaded.has(pass) }).toEqual({
        pass,
        uploaded: true,
      })
    }
  })
})
