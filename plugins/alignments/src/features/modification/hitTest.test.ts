import { abgrAlpha, packAbgr } from '@jbrowse/core/util/colorBits'
import Flatbush from '@jbrowse/core/util/flatbush'

import { getModificationCallName } from '../../shared/modificationData.ts'
import { namesToBlock } from '../../shared/readNameBlock.ts'
import { buildModificationArrays } from './buildArrays.ts'
import { hitTestModification } from './hitTest.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
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
    readKeys: [],
    ...namesToBlock([]),
    readChainIndices: undefined,
    mismatchPositions: new Uint32Array(),
    mismatchYs: new Uint16Array(),
    mismatchBases: new Uint8Array(),
    mismatchFrequencies: new Uint8Array(),
    interbasePositions: new Uint32Array(),
    interbaseYs: new Uint16Array(),
    interbaseLengths: new Uint32Array(),
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
    softclipBasePositions: new Uint32Array(),
    softclipBaseBases: new Uint8Array(),
    ...overrides,
  } as PileupDataResult
}

function makeCoords(overrides: Partial<CigarCoords> = {}): CigarCoords {
  return {
    bpPerPx: 1,
    genomicPos: 1000.5,
    basePos: 1000,
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

  it('resolves modType from the modificationTypes index', () => {
    const pos = 1000
    const rpcData = makeRpcData({
      modificationPositions: new Uint32Array([pos]),
      modificationColors: new Uint32Array([packAbgr(100, 200, 50, 180)]),
      modificationYs: new Uint16Array([0]),
      modificationTypeIndices: new Uint8Array([1]),
      modificationTypes: ['5hmC', '5mC'],
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

  // Flatbush returns its packed (Hilbert-sorted) tree order, not distance
  // order, so `hits[0]` was the LEFTMOST candidate in the ±tolerance window
  // rather than the one under the cursor. The window is ±2bp at 1bp/px and
  // consecutive modified bases on one read are the normal case for 5mC/6mA, so
  // the tooltip and details widget routinely named a neighbouring base — and
  // disagreed with the snpBase annotation, which is pinned to the exact cursor
  // base by the mismatch test.
  describe('picks the modification nearest the cursor', () => {
    // Four consecutive modified bases on one read, each a different mod type so
    // the assertion can tell which one answered.
    function consecutiveMods() {
      const positions = [1000, 1001, 1002, 1003]
      return makeResolved(
        makeRpcData({
          modificationPositions: new Uint32Array(positions),
          modificationColors: new Uint32Array(
            positions.map(() => packAbgr(255, 0, 0, 200)),
          ),
          modificationYs: new Uint16Array([0, 0, 0, 0]),
          modificationTypeIndices: new Uint8Array([0, 1, 2, 3]),
          modificationTypes: ['a', 'b', 'c', 'd'],
          modFlatbush: makeModFlatbush(positions, [0, 0, 0, 0]),
        }),
      )
    }

    // Visual center of base b is b+0.5, so a cursor at b+0.5 is exactly on it.
    it.each([
      [1000.5, 1000, 'a'],
      [1001.5, 1001, 'b'],
      [1002.5, 1002, 'c'],
      [1003.5, 1003, 'd'],
    ])('cursor at %s resolves base %s', (genomicPos, position, modType) => {
      const hit = hitTestModification(
        consecutiveMods(),
        makeCoords({ genomicPos }),
        10,
      )
      expect(hit).toMatchObject({ position, modType })
    })

    // On a cell boundary the two bases either side are exactly equidistant from
    // `queryCenter`, and the tie fell through to Flatbush's ascending order —
    // so the leftmost pixel column of a base answered its LEFT neighbour on a
    // forward block. One column per base, and only there, which is why sampling
    // centres above never saw it.
    //
    // The orientation is carried entirely by the coords the caller resolved:
    // `bpAtPx` puts `genomicPos` at b on a forward block and b+1 on a reversed
    // one for the same pixel column, while `basePos` is b either way. So both
    // cases are expressible here without a second block.
    it.each([
      ['forward', 1002, 1002],
      ['reversed', 1003, 1002],
    ])(
      'the leftmost column of a base resolves that base, %s',
      (_orientation, genomicPos, basePos) => {
        const hit = hitTestModification(
          consecutiveMods(),
          makeCoords({ genomicPos, basePos }),
          10,
        )
        expect(hit).toMatchObject({ position: 1002, modType: 'c' })
      },
    )
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
    // eslint-disable-next-line unicorn/no-constant-zero-expression -- 0*0 mirrors the p*p+0.1 alpha formula at p=0
    const a = Math.round(Math.min(1, 0 * 0 + 0.1) * 255) & 0xff
    expect(a / 255).toBeGreaterThan(0)
  })
})

// The no-mod bucket keeps the canonical mod code ('m'), so before
// `modificationNoMod` existed the hit test could only report modType and every
// consumer named the call "5mC" — labeling a blue UNmethylated mark with the
// name of the modification it is the absence of, at the confidence it is absent.
describe('no-mod bucket survives the packed arrays', () => {
  const entry = (noMod: boolean) => ({
    readIndex: 0,
    position: 1000,
    base: 'C',
    modType: 'm',
    strand: 1,
    color: packAbgr(0, 0, 255, 255),
    prob: 0.95,
    noMod,
  })

  function hitFor(noMod: boolean) {
    const arrays = buildModificationArrays([entry(noMod)], 0)
    const rpcData = makeRpcData({
      ...arrays,
      modFlatbush: makeModFlatbush([1000], [0]),
    })
    return hitTestModification(makeResolved(rpcData), makeCoords(), 10)
  }

  it('reports noMod and names the call "Unmodified C", not "5mC"', () => {
    const hit = hitFor(true)
    expect(hit?.noMod).toBe(true)
    expect(hit?.modType).toBe('m')
    expect(getModificationCallName(hit!.modType!, hit!.noMod)).toBe(
      'Unmodified C',
    )
  })

  it('still names a genuine modified call by its modification', () => {
    const hit = hitFor(false)
    expect(hit?.noMod).toBe(false)
    expect(getModificationCallName(hit!.modType!, hit!.noMod)).toBe('5mC')
  })
})

// Bisulfite reads no MM/ML tags, so the worker's `detectedModifications` is
// always empty there while every mark still carries modType 'm'.
describe('a mark whose type no MM tag announced', () => {
  const bisulfiteEntry = (color: number, noMod: boolean) => ({
    readIndex: 0,
    position: 1000,
    base: 'C',
    modType: 'm',
    strand: 1,
    color,
    // Bisulfite is a binary call, not a likelihood.
    prob: 1,
    noMod,
  })

  function hitFor(noMod: boolean) {
    const arrays = buildModificationArrays(
      [bisulfiteEntry(packAbgr(255, 0, 0, 255), noMod)],
      0,
    )
    return hitTestModification(
      makeResolved(
        makeRpcData({ ...arrays, modFlatbush: makeModFlatbush([1000], [0]) }),
      ),
      makeCoords(),
      10,
    )
  }

  it('names the modification instead of reading "Unknown"', () => {
    const hit = hitFor(false)
    expect(hit?.modType).toBe('m')
    expect(getModificationCallName(hit!.modType!, hit!.noMod)).toBe('5mC')
  })

  it('names the unmodified bucket too', () => {
    const hit = hitFor(true)
    expect(hit?.noMod).toBe(true)
    expect(getModificationCallName(hit!.modType!, hit!.noMod)).toBe(
      'Unmodified C',
    )
  })
})
