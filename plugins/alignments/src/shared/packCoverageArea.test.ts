import { COVERAGE_PASS } from '../features/coverage/packGpu.ts'
import { INDICATOR_PASS } from '../features/indicator/packGpu.ts'
import { INTERBASE_PASS } from '../features/interbase/packGpu.ts'
import { MOD_COVERAGE_PASS } from '../features/modCoverage/packGpu.ts'
import { SNP_COVERAGE_PASS } from '../features/snpCoverage/packGpu.ts'
import { packCoverageAreaForGpu } from './packCoverageArea.ts'

import type { PassDescriptor } from '@jbrowse/render-core/hal'

/**
 * The five coverage-band passes are the only uploads whose buffer and whose
 * parallel arrays are produced on opposite sides of the RPC boundary: the
 * worker packs the bytes here, and `buildCoverageResultFields` ships the raw
 * arrays beside them for the Canvas2D draw, the hit test and the tooltip. The
 * GPU draws as many instances as the bytes hold; every other consumer walks the
 * arrays. Disagree and the two backends draw a different number of segments.
 *
 * Nothing but this holds them together. `packCoverageSegmentsForGpu` hands each
 * packer a count taken off the compute result — five (array, count) pairings,
 * each a plain argument, and swapping any two of them type-checks
 * (`segmentCount` for `indicatorCount` is the near miss, both `number`, both
 * from the same object). So the fixtures below give every pass a DIFFERENT
 * length: a crossed pairing then packs the wrong number of bytes.
 */

const SNP_N = 3
const INTERBASE_N = 2
const INDICATOR_N = 4
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
    {
      positions: positions(INTERBASE_N),
      yOffsets: new Float32Array(INTERBASE_N),
      heights: ramp(INTERBASE_N),
      colorTypes: new Uint8Array(INTERBASE_N).fill(1),
      indicatorPositions: positions(INDICATOR_N),
      indicatorColorTypes: new Uint8Array(INDICATOR_N).fill(1),
      maxCount: 4,
      segmentCount: INTERBASE_N,
      indicatorCount: INDICATOR_N,
    },
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

function instances(pass: PassDescriptor, buf: ArrayBuffer) {
  return buf.byteLength / pass.instanceStride
}

describe('the worker packs as many instances as the arrays it ships beside them', () => {
  it('one buffer per pass, each the length of its own parallel array', () => {
    const p = packed()
    expect({
      coverage: instances(COVERAGE_PASS, p.coveragePackedBuffer),
      snp: instances(SNP_COVERAGE_PASS, p.snpPackedBuffer),
      interbase: instances(INTERBASE_PASS, p.interbasePackedBuffer),
      indicator: instances(INDICATOR_PASS, p.indicatorPackedBuffer),
      modCov: instances(MOD_COVERAGE_PASS, p.modCovPackedBuffer),
    }).toEqual({
      coverage: BIN_N,
      snp: SNP_N,
      interbase: INTERBASE_N,
      indicator: INDICATOR_N,
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
      {
        positions: new Uint32Array(0),
        yOffsets: new Float32Array(0),
        heights: new Float32Array(0),
        colorTypes: new Uint8Array(0),
        indicatorPositions: new Uint32Array(0),
        indicatorColorTypes: new Uint8Array(0),
        maxCount: 0,
        segmentCount: 0,
        indicatorCount: 0,
      },
      undefined,
    )
    expect(p.modCovPackedBuffer.byteLength).toBe(0)
    expect(p.coverageGpuBinCount).toBe(0)
  })
})
