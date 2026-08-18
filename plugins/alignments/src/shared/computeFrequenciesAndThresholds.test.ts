import { featureFrequencyThreshold } from '../LinearAlignmentsDisplay/constants.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../shaders/slang/gap.consts.generated.ts'
import {
  applyDepthDependentThreshold,
  computeFrequenciesAndThresholds,
  computePositionFrequencies,
} from './computeFrequenciesAndThresholds.ts'
import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from './types.ts'

describe('computePositionFrequencies (interbase depth)', () => {
  it('uses max of left and right depth for interbase features', () => {
    const coverageDepths = new Float32Array([5, 10, 15, 20])
    const positions = new Uint32Array([2])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    expect(freqs[0]).toBe(Math.round((1 / 15) * 255))
  })

  it('handles insertion at left edge (no left neighbor)', () => {
    const coverageDepths = new Float32Array([10, 20, 30])
    const positions = new Uint32Array([0])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    expect(freqs[0]).toBe(Math.round(0.1 * 255))
  })

  it('handles insertion at right edge (no right neighbor)', () => {
    const coverageDepths = new Float32Array([10, 20, 30])
    const positions = new Uint32Array([3])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    expect(freqs[0]).toBe(Math.round((1 / 30) * 255))
  })

  it('counts multiple insertions at same position', () => {
    const coverageDepths = new Float32Array([10, 20])
    const positions = new Uint32Array([1, 1])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    expect(freqs[0]).toBe(Math.round(0.1 * 255))
    expect(freqs[1]).toBe(Math.round(0.1 * 255))
  })

  it('handles coverageStartPos correctly', () => {
    const coverageDepths = new Float32Array([5, 10, 15])
    const positions = new Uint32Array([12])
    const freqs = computePositionFrequencies(positions, coverageDepths, 10)
    expect(freqs[0]).toBe(Math.round((1 / 15) * 255))
  })

  it('at a coverage cliff, uses the higher side', () => {
    const coverageDepths = new Float32Array([50, 50, 50, 0, 0])
    const positions = new Uint32Array([3])
    const freqs = computePositionFrequencies(positions, coverageDepths, 0)
    expect(freqs[0]).toBe(Math.round(0.02 * 255))
  })
})

// Only the deletion branch of gap.slang / drawGaps reads gapFrequencies, so a
// skip must neither carry one nor contribute to the count at a deletion that
// starts where it does — a splice donor doubling as a deletion site.
describe('computeFrequenciesAndThresholds (gap frequencies)', () => {
  const depths = new Float32Array(600).fill(40)
  const deletion = { start: 10, end: 15, type: GAP_DELETION }
  const skip = { start: 10, end: 500, type: GAP_SKIP }

  function gapFrequencies(gaps: (typeof deletion)[]) {
    const gapPositions = new Uint32Array(gaps.length * 2)
    const gapTypes = new Uint8Array(gaps.length)
    for (const [i, g] of gaps.entries()) {
      gapPositions[i * 2] = g.start
      gapPositions[i * 2 + 1] = g.end
      gapTypes[i] = g.type
    }
    return computeFrequenciesAndThresholds(
      {
        mismatchPositions: new Uint32Array(0),
        mismatchBases: new Uint8Array(0),
      },
      {
        interbasePositions: new Uint32Array(0),
        interbaseTypes: new Uint8Array(0),
      },
      { gapPositions, gapTypes },
      depths,
      0,
    ).gapFrequencies
  }

  const twentyDeletions = Array.from({ length: 20 }, () => deletion)

  it('does not count skips toward a deletion starting at the same base', () => {
    const alone = gapFrequencies(twentyDeletions)
    const spliced = gapFrequencies([
      ...twentyDeletions,
      ...Array.from({ length: 15 }, () => skip),
    ])
    expect(alone[0]).toBe(Math.round((20 / 40) * 255))
    expect(spliced[0]).toBe(alone[0])
  })

  it('leaves a skip at zero and keeps one entry per gap', () => {
    const freqs = gapFrequencies([skip, ...twentyDeletions, skip])
    expect(freqs).toHaveLength(22)
    expect(freqs[0]).toBe(0)
    expect(freqs[21]).toBe(0)
    expect(freqs[1]).toBe(Math.round((20 / 40) * 255))
  })
})

describe('applyDepthDependentThreshold (interbase mode)', () => {
  it('zeroes frequencies below threshold for interbase features', () => {
    const coverageDepths = new Float32Array([10, 20, 30])
    const positions = new Uint32Array([1, 2])
    const frequencies = new Uint8Array([
      Math.round(0.05 * 255),
      Math.round(0.5 * 255),
    ])
    applyDepthDependentThreshold(
      frequencies,
      positions,
      coverageDepths,
      0,
      () => 0.1,
      true,
    )
    expect(frequencies[0]).toBe(0)
    expect(frequencies[1]).toBe(Math.round(0.5 * 255))
  })

  it('uses interbase depth (max of neighbors) when interbase=true', () => {
    const coverageDepths = new Float32Array([100, 0])
    const positions = new Uint32Array([1])
    const frequencies = new Uint8Array([Math.round(0.01 * 255)])
    applyDepthDependentThreshold(
      frequencies,
      positions,
      coverageDepths,
      0,
      () => 0.005,
      true,
    )
    expect(frequencies[0]).toBe(Math.round(0.01 * 255))
  })
})

describe('featureFrequencyThreshold', () => {
  it('returns 0.8 for shallow coverage (depth < 10)', () => {
    expect(featureFrequencyThreshold(0)).toBe(0.8)
    expect(featureFrequencyThreshold(5)).toBe(0.8)
    expect(featureFrequencyThreshold(9)).toBe(0.8)
  })

  it('returns 0.3 for deep coverage (depth >= 30)', () => {
    expect(featureFrequencyThreshold(30)).toBe(0.3)
    expect(featureFrequencyThreshold(100)).toBe(0.3)
    expect(featureFrequencyThreshold(1000)).toBe(0.3)
  })

  it('interpolates between 0.8 and 0.3 for depth 10-30', () => {
    expect(featureFrequencyThreshold(20)).toBeCloseTo(0.55, 5)
    expect(featureFrequencyThreshold(10)).toBeCloseTo(0.8, 5)
    expect(featureFrequencyThreshold(30)).toBeCloseTo(0.3, 5)
  })

  it('is monotonically decreasing', () => {
    let prev = featureFrequencyThreshold(0)
    for (let d = 1; d <= 50; d++) {
      const curr = featureFrequencyThreshold(d)
      expect(curr).toBeLessThanOrEqual(prev)
      prev = curr
    }
  })
})

// An SV breakpoint puts insertions, soft clips and hard clips on the same base,
// and each kind draws its own bar, so each counts only its own kind. Pooling
// them let three insertions at depth 40 inherit twelve clips' 37% and draw
// opaque past the fade.
describe('computeFrequenciesAndThresholds (interbase frequencies)', () => {
  const depths = new Float32Array(200).fill(40)
  const POS = 100

  function interbaseFrequencies(counts: {
    insertions: number
    softclips: number
    hardclips: number
  }) {
    const { insertions, softclips, hardclips } = counts
    const total = insertions + softclips + hardclips
    const interbasePositions = new Uint32Array(total).fill(POS)
    const interbaseTypes = new Uint8Array(total)
    interbaseTypes.fill(INTERBASE_INSERTION, 0, insertions)
    interbaseTypes.fill(INTERBASE_SOFTCLIP, insertions, insertions + softclips)
    interbaseTypes.fill(INTERBASE_HARDCLIP, insertions + softclips)
    return computeFrequenciesAndThresholds(
      {
        mismatchPositions: new Uint32Array(0),
        mismatchBases: new Uint8Array(0),
      },
      { interbasePositions, interbaseTypes },
      { gapPositions: new Uint32Array(0), gapTypes: new Uint8Array(0) },
      depths,
      0,
    ).interbaseFrequencies
  }

  it('does not count clips toward an insertion at the same base', () => {
    const alone = interbaseFrequencies({
      insertions: 3,
      softclips: 0,
      hardclips: 0,
    })
    const withClips = interbaseFrequencies({
      insertions: 3,
      softclips: 12,
      hardclips: 8,
    })
    expect(alone[0]).toBe(0)
    expect(withClips[0]).toBe(alone[0])
  })

  it('keeps each kind on its own count at a shared base', () => {
    const freqs = interbaseFrequencies({
      insertions: 16,
      softclips: 12,
      hardclips: 20,
    })
    expect(freqs[0]).toBe(Math.round((16 / 40) * 255))
    expect(freqs[16]).toBe(Math.round((12 / 40) * 255))
    expect(freqs[28]).toBe(Math.round((20 / 40) * 255))
  })
})
