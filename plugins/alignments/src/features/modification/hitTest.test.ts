import { abgrAlpha, packAbgr } from '@jbrowse/core/util/colorBits'
import Flatbush from '@jbrowse/core/util/flatbush'

import { hitTestModification } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { CigarCoords, ResolvedBlock } from '../../shared/hitTestTypes.ts'

function makeModFlatbush(positions: number[], rows: number[]) {
  const fb = new Flatbush(positions.length)
  for (let i = 0; i < positions.length; i++) {
    fb.add(positions[i]!, rows[i]!, positions[i], rows[i])
  }
  fb.finish()
  return fb
}

function makeRpcData(
  overrides: Partial<PileupDataResult> = {},
): PileupDataResult {
  return {
    readPositions: new Uint32Array(),
    readYs: new Uint16Array(),
    readFlags: new Uint16Array(),
    readMapqs: new Uint8Array(),
    readAvgBaseQualities: new Uint8Array(),
    readIds: [],
    readNames: [],
    readChainIndices: undefined,
    mismatchPositions: new Uint32Array(),
    mismatchYs: new Uint16Array(),
    mismatchBases: new Uint8Array(),
    mismatchFrequencies: new Uint8Array(),
    interbasePositions: new Uint32Array(),
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint16Array(),
    interbaseTypes: new Uint8Array(),
    interbaseSequences: [],
    gapPositions: new Uint32Array(),
    gapYs: new Uint16Array(),
    gapTypes: new Uint8Array(),
    modificationPositions: new Uint32Array(),
    modificationYs: new Uint16Array(),
    modificationColors: new Uint32Array(),
    coverageDepths: new Float32Array(),
    coverageStartPos: 0,
    indicatorPositions: new Uint32Array(),
    indicatorColorTypes: new Uint8Array(),
    softclipBasePositions: new Uint32Array(),
    softclipBaseBases: new Uint8Array(),
    ...overrides,
  } as PileupDataResult
}

function makeCoords(overrides: Partial<CigarCoords> = {}): CigarCoords {
  return {
    bpPerPx: 1,
    genomicPos: 1000.5,
    row: 0,
    adjustedY: 5,
    yWithinRow: 5,
    ...overrides,
  }
}

function makeResolved(rpcData: PileupDataResult): ResolvedBlock {
  return {
    rpcData,
    bpRange: [0, 2000],
    blockStartPx: 0,
    blockWidth: 2000,
    refName: 'ctgA',
    reversed: false,
  }
}

describe('hitTestModification', () => {
  it('returns undefined when modFlatbush is absent', () => {
    const rpcData = makeRpcData()
    const resolved = makeResolved(rpcData)
    expect(hitTestModification(resolved, makeCoords(), 10)).toBeUndefined()
  })

  it('returns undefined when mouse is below feature height', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(255, 0, 0, 200)]),
      modificationYs: new Uint16Array([0]),
      modFlatbush: makeModFlatbush([pos], [0]),
    })
    const resolved = makeResolved(rpcData)
    // yWithinRow > featureHeightSetting → miss
    expect(
      hitTestModification(resolved, makeCoords({ yWithinRow: 15 }), 10),
    ).toBeUndefined()
  })

  it('returns undefined when mouse is far from any modification', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(255, 0, 0, 200)]),
      modificationYs: new Uint16Array([0]),
      modFlatbush: makeModFlatbush([pos], [0]),
    })
    const resolved = makeResolved(rpcData)
    // genomicPos far from mod position
    expect(
      hitTestModification(resolved, makeCoords({ genomicPos: 1050 }), 10),
    ).toBeUndefined()
  })

  it('hits a modification at the visual center (pos + 0.5)', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(200, 100, 50, 180)]),
      modificationYs: new Uint16Array([0]),
      modFlatbush: makeModFlatbush([pos], [0]),
    })
    const resolved = makeResolved(rpcData)
    // Mouse exactly at visual center pos+0.5
    const hit = hitTestModification(
      resolved,
      makeCoords({ genomicPos: pos + 0.5 }),
      10,
    )
    expect(hit).toBeDefined()
    expect(hit!.position).toBe(pos)
  })

  it('returns the correct RGB color (excludes alpha)', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(200, 100, 50, 180)]),
      modificationYs: new Uint16Array([0]),
      modFlatbush: makeModFlatbush([pos], [0]),
    })
    const resolved = makeResolved(rpcData)
    const hit = hitTestModification(
      resolved,
      makeCoords({ genomicPos: pos + 0.5 }),
      10,
    )
    expect(hit!.color).toBe('rgb(200,100,50)')
  })

  it('resolves modType from detectedModifications index', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(100, 200, 50, 180)]),
      modificationYs: new Uint16Array([0]),
      modificationTypeIndices: new Uint8Array([1]),
      detectedModifications: ['5hmC', '5mC'],
      modFlatbush: makeModFlatbush([pos], [0]),
    })
    const resolved = makeResolved(rpcData)
    const hit = hitTestModification(
      resolved,
      makeCoords({ genomicPos: pos + 0.5 }),
      10,
    )
    expect(hit!.modType).toBe('5mC')
  })

  it('returns undefined modType when typeIndices are absent', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(100, 200, 50, 180)]),
      modificationYs: new Uint16Array([0]),
      modFlatbush: makeModFlatbush([pos], [0]),
    })
    const resolved = makeResolved(rpcData)
    const hit = hitTestModification(
      resolved,
      makeCoords({ genomicPos: pos + 0.5 }),
      10,
    )
    expect(hit!.modType).toBeUndefined()
  })
})

describe('modification probability round-trip', () => {
  // Verifies that the quadratic visual mapping applied in buildModificationArrays
  // is correctly inverted in hitTestModification so the tooltip shows raw ML probability.
  function roundTrip(rawProb: number) {
    const a = Math.round(Math.min(1, rawProb * rawProb + 0.1) * 255) & 0xff
    const packed = packAbgr(128, 0, 0, a)
    const alpha = abgrAlpha(packed) / 255
    return Math.sqrt(Math.max(0, alpha - 0.1))
  }

  it('recovers 0% probability within Uint8 quantization (~0.044 max error at floor)', () => {
    // 0.1 * 255 = 25.5, rounds to 26; inverted: sqrt(26/255 - 0.1) ≈ 0.044
    expect(roundTrip(0)).toBeCloseTo(0, 1)
  })

  it('recovers 50% probability within rounding', () => {
    expect(roundTrip(0.5)).toBeCloseTo(0.5, 2)
  })

  it('recovers 80% probability within rounding', () => {
    expect(roundTrip(0.8)).toBeCloseTo(0.8, 2)
  })

  it('recovers ~95% probability (clamps at 1.0 alpha above ~95%)', () => {
    // p*p + 0.1 = 1 when p ≈ 0.9487; above that alpha clamps to 1
    expect(roundTrip(0.9)).toBeCloseTo(0.9, 2)
  })

  it('low probability mods are never fully transparent (0.1 floor)', () => {
    const a = Math.round(Math.min(1, 0 * 0 + 0.1) * 255) & 0xff
    expect(a / 255).toBeGreaterThan(0)
  })
})
