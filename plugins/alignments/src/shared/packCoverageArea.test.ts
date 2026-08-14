import { emptyInterbaseCoverage } from '@jbrowse/alignments-core'

import { COVERAGE_PASS } from '../features/coverage/packGpu.ts'
import { MOD_COVERAGE_PASS } from '../features/modCoverage/packGpu.ts'
import { SNP_COVERAGE_PASS } from '../features/snpCoverage/packGpu.ts'
import { packCoverageAreaForGpu } from './packCoverageArea.ts'

import type { PipelineDescriptor } from '@jbrowse/render-core/hal'

/**
 * Three of the coverage-band packers still take their record count as a plain
 * argument beside the arrays it belongs to — `packSnpSegmentsForGpu(positions,
 * …, count)` and friends — and swapping two of those arguments type-checks,
 * both being `number` off the same compute result. A crossed pairing packs the
 * wrong number of bytes, the GPU draws as many instances as the bytes hold, and
 * the two backends disagree about how many segments exist.
 *
 * So the fixtures below give every pass a DIFFERENT length, and this asserts
 * each buffer came out at its own.
 *
 * The interbase and indicator passes are deliberately absent: their buffers are
 * written by `computeInterbaseCoverage` itself and forwarded, so there is no
 * (array, count) pair left to cross and nothing here could fail.
 */

const SNP_N = 3
const MOD_COV_N = 5
const BIN_N = 6

function ramp(n: number, from = 1) {
  return Float32Array.from({ length: n }, (_, i) => from + i)
}
function positions(n: number) {
  return Uint32Array.from({ length: n }, (_, i) => 10_000 + i)
}

function packed() {
  return packCoverageAreaForGpu(
    {
      depths: ramp(BIN_N),
      fwdDepths: undefined,
      revDepths: undefined,
      maxDepth: BIN_N,
      binSize: 1,
      startPos: 10_000,
    },
    {
      positions: positions(SNP_N),
      yOffsets: new Float32Array(SNP_N),
      heights: ramp(SNP_N),
      colorTypes: new Uint8Array(SNP_N).fill(1),
      relDepths: new Float32Array(SNP_N).fill(1),
      count: SNP_N,
    },
    emptyInterbaseCoverage(),
    {
      positions: positions(MOD_COV_N),
      yOffsets: new Float32Array(MOD_COV_N),
      heights: ramp(MOD_COV_N),
      colors: new Uint32Array(MOD_COV_N).fill(0xff00ff00),
      relDepths: new Float32Array(MOD_COV_N).fill(1),
      count: MOD_COV_N,
    },
  )
}

function instances(pass: PipelineDescriptor, buf: ArrayBuffer) {
  return buf.byteLength / pass.instanceStride
}

describe('the worker packs as many instances as the arrays it packed from', () => {
  it('one buffer per pass, each the length of its own parallel array', () => {
    const p = packed()
    expect({
      coverage: instances(COVERAGE_PASS, p.coveragePackedBuffer),
      snp: instances(SNP_COVERAGE_PASS, p.snpPackedBuffer),
      modCov: instances(MOD_COVERAGE_PASS, p.modCovPackedBuffer),
    }).toEqual({
      coverage: BIN_N,
      snp: SNP_N,
      modCov: MOD_COV_N,
    })
  })

  it('a track with no modifications ships no mod-coverage instances', () => {
    // `modCov` is undefined whenever the display isn't coloring by
    // modification, and the empty buffer is what makes the upload skip the pass
    // rather than draw a stale one.
    const p = packCoverageAreaForGpu(
      {
        depths: new Float32Array(0),
        fwdDepths: undefined,
        revDepths: undefined,
        maxDepth: 0,
        binSize: 1,
        startPos: 0,
      },
      {
        positions: new Uint32Array(0),
        yOffsets: new Float32Array(0),
        heights: new Float32Array(0),
        colorTypes: new Uint8Array(0),
        relDepths: new Float32Array(0),
        count: 0,
      },
      emptyInterbaseCoverage(),
      undefined,
    )
    expect(p.modCovPackedBuffer.byteLength).toBe(0)
    expect(p.coverageGpuBinCount).toBe(0)
  })
})
