import { BaseBlock } from '@jbrowse/core/util/blockTypes'

import { DEFAULT_CIGAR_OP_DRAW_COLORS as DEFAULT_SYNTENY_COLORS } from '@jbrowse/alignments-core'
import {
  computeRegionRenderParams,
  prepareMultiSyntenyGpuData,
} from './multiSyntenyGpuData.ts'
import { INSTANCE_BYTE_SIZE } from './multiSyntenyGpuShaders.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

function feat(overrides: Partial<MultiPairFeature> = {}): MultiPairFeature {
  return {
    queryGenome: 'genomeA',
    origRefName: 'chr1',
    start: 1000,
    end: 2000,
    mateStart: 500,
    mateEnd: 1500,
    mateRefName: 'chr1',
    strand: 1,
    syriType: undefined,
    identity: 0.99,
    featureId: 'f1',
    segmentId: undefined,
    cigar: undefined,
    cs: undefined,
    ...overrides,
  }
}

function readInstance(buf: ArrayBuffer, index: number) {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const stride = INSTANCE_BYTE_SIZE / 4
  const off = index * stride
  return {
    startBp: u32[off]!,
    endBp: u32[off + 1]!,
    genomeRow: u32[off + 2]!,
    featureId: u32[off + 3]!,
    r: f32[off + 4]!,
    g: f32[off + 5]!,
    b: f32[off + 6]!,
    a: f32[off + 7]!,
  }
}

describe('prepareMultiSyntenyGpuData', () => {
  test('returns empty data for no features', () => {
    const genomeRows = new Map<string, MultiPairFeature[]>()
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      [],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(0)
    expect(result.buffer.byteLength).toBe(0)
    expect(result.refNameIndex.size).toBe(0)
  })

  test('packs single feature with correct bp coordinates', () => {
    const genomeRows = new Map([['genomeA', [feat()]]])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(1)
    expect(result.buffer.byteLength).toBe(INSTANCE_BYTE_SIZE)

    const inst = readInstance(result.buffer, 0)
    expect(inst.startBp).toBe(1000)
    expect(inst.endBp).toBe(2000)
    expect(inst.genomeRow).toBe(0)
    expect(inst.featureId).toBe(1)
    expect(inst.a).toBeGreaterThan(0)
  })

  test('assigns correct genome row indices', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ origRefName: 'chr1' })]],
      ['genomeB', [feat({ origRefName: 'chr1' })]],
      ['genomeC', [feat({ origRefName: 'chr1' })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA', 'genomeB', 'genomeC'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(3)

    const rows = new Set<number>()
    for (let i = 0; i < 3; i++) {
      rows.add(readInstance(result.buffer, i).genomeRow)
    }
    expect(rows).toEqual(new Set([0, 1, 2]))
  })

  test('sorts features by refName and builds refNameIndex', () => {
    const genomeRows = new Map([
      [
        'genomeA',
        [
          feat({ origRefName: 'chr2', start: 100, end: 200 }),
          feat({ origRefName: 'chr1', start: 500, end: 600 }),
        ],
      ],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(2)

    // chr1 should come before chr2 after sorting
    const first = readInstance(result.buffer, 0)
    const second = readInstance(result.buffer, 1)
    expect(first.startBp).toBe(500)
    expect(second.startBp).toBe(100)

    expect(result.refNameIndex.get('chr1')).toEqual({
      startIdx: 0,
      count: 1,
    })
    expect(result.refNameIndex.get('chr2')).toEqual({
      startIdx: 1,
      count: 1,
    })
  })

  test('sorts features within same refName by startBp', () => {
    const genomeRows = new Map([
      [
        'genomeA',
        [
          feat({ origRefName: 'chr1', start: 3000, end: 4000 }),
          feat({ origRefName: 'chr1', start: 1000, end: 2000 }),
        ],
      ],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    const first = readInstance(result.buffer, 0)
    const second = readInstance(result.buffer, 1)
    expect(first.startBp).toBe(1000)
    expect(second.startBp).toBe(3000)
  })

  test('expands CIGAR deletions into sub-instances', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cigar: '100M50D100M', start: 1000, end: 1250 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base feature + 1 deletion sub-instance
    expect(result.instanceCount).toBe(2)

    // Find the deletion instance (grey color, ~0.53 for #888)
    let foundDeletion = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1100 && inst.endBp === 1150) {
        foundDeletion = true
        // Deletion color is #888 → r≈0.533, g≈0.533, b≈0.533
        expect(inst.r).toBeCloseTo(0.533, 1)
      }
    }
    expect(foundDeletion).toBe(true)
  })

  test('expands CIGAR mismatches (X) into sub-instances', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cigar: '50M10X40M', start: 1000, end: 1100 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base + 1 mismatch
    expect(result.instanceCount).toBe(2)

    let foundMismatch = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1060) {
        foundMismatch = true
        // Mismatch color #f00 → r=1, g=0, b=0
        expect(inst.r).toBeCloseTo(1, 1)
        expect(inst.g).toBeCloseTo(0, 1)
      }
    }
    expect(foundMismatch).toBe(true)
  })

  test('expands CIGAR insertions as interbase markers', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cigar: '50M5I50M', start: 1000, end: 1100 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base + 1 insertion marker
    expect(result.instanceCount).toBe(2)

    let foundInsertion = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      // Insertion at refPos=50, so startBp=endBp=1050 (interbase)
      if (inst.startBp === 1050 && inst.endBp === 1050) {
        foundInsertion = true
      }
    }
    expect(foundInsertion).toBe(true)
  })

  test('insertions do not advance reference position', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cigar: '50M5I10D40M', start: 1000, end: 1100 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base + 1 insertion + 1 deletion
    expect(result.instanceCount).toBe(3)

    // Deletion should be at refPos=50 (not 55), since insertion doesn't advance ref
    let foundDeletion = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.endBp - inst.startBp === 10) {
        foundDeletion = true
        expect(inst.startBp).toBe(1050)
        expect(inst.endBp).toBe(1060)
      }
    }
    expect(foundDeletion).toBe(true)
  })

  test('expands cs substitutions with base-specific colors', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cs: ':50*ag:49', start: 1000, end: 1100 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base + 1 substitution
    expect(result.instanceCount).toBe(2)

    let foundSub = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1051) {
        foundSub = true
        // query base is 'g' → color #d5bb04 → g≈0.733
        expect(inst.g).toBeGreaterThan(0.5)
      }
    }
    expect(foundSub).toBe(true)
  })

  test('expands cs deletions', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cs: ':50-acgt:46', start: 1000, end: 1100 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base + 1 deletion
    expect(result.instanceCount).toBe(2)

    let foundDel = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1054) {
        foundDel = true
      }
    }
    expect(foundDel).toBe(true)
  })

  test('expands cs insertions as interbase markers', () => {
    const genomeRows = new Map([
      ['genomeA', [feat({ cs: ':50+acgt:50', start: 1000, end: 1100 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    // 1 base + 1 insertion
    expect(result.instanceCount).toBe(2)

    let foundIns = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      // Interbase: startBp == endBp
      if (inst.startBp === 1050 && inst.endBp === 1050) {
        foundIns = true
      }
    }
    expect(foundIns).toBe(true)
  })

  test('feature IDs are 1-based and unique per feature', () => {
    const genomeRows = new Map([
      [
        'genomeA',
        [
          feat({ origRefName: 'chr1', start: 100, end: 200 }),
          feat({ origRefName: 'chr1', start: 300, end: 400 }),
        ],
      ],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    const ids = new Set<number>()
    for (let i = 0; i < result.instanceCount; i++) {
      ids.add(readInstance(result.buffer, i).featureId)
    }
    expect(ids.has(0)).toBe(false)
    expect(ids.size).toBe(2)
  })

  test('handles multiple refNames in refNameIndex', () => {
    const genomeRows = new Map([
      [
        'genomeA',
        [
          feat({ origRefName: 'chr1', start: 100, end: 200 }),
          feat({ origRefName: 'chr1', start: 300, end: 400 }),
          feat({ origRefName: 'chr2', start: 100, end: 200 }),
          feat({ origRefName: 'chr3', start: 500, end: 600 }),
        ],
      ],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.refNameIndex.size).toBe(3)
    expect(result.refNameIndex.get('chr1')!.count).toBe(2)
    expect(result.refNameIndex.get('chr2')!.count).toBe(1)
    expect(result.refNameIndex.get('chr3')!.count).toBe(1)

    // Verify contiguous indices
    const chr1 = result.refNameIndex.get('chr1')!
    const chr2 = result.refNameIndex.get('chr2')!
    const chr3 = result.refNameIndex.get('chr3')!
    expect(chr1.startIdx + chr1.count).toBeLessThanOrEqual(chr2.startIdx)
    expect(chr2.startIdx + chr2.count).toBeLessThanOrEqual(chr3.startIdx)
  })

  test('instance buffer is exactly INSTANCE_BYTE_SIZE per instance', () => {
    const genomeRows = new Map([
      ['genomeA', [feat(), feat({ start: 3000, end: 4000 })]],
    ])
    const result = prepareMultiSyntenyGpuData(
      genomeRows,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.buffer.byteLength).toBe(
      result.instanceCount * INSTANCE_BYTE_SIZE,
    )
  })
})

describe('computeRegionRenderParams', () => {
  test('returns undefined for unknown refName', () => {
    const index = new Map()
    const block = new BaseBlock({
      refName: 'chrX',
      start: 0,
      end: 1000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 0,
      widthPx: 500,
    })
    expect(computeRegionRenderParams(block, 0, index)).toBeUndefined()
  })

  test('returns correct params for matching block', () => {
    const index = new Map([['chr1', { startIdx: 5, count: 10 }]])
    const block = new BaseBlock({
      refName: 'chr1',
      start: 150000000,
      end: 160000000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 1000,
      widthPx: 500,
    })
    const params = computeRegionRenderParams(block, 200, index)!
    expect(params).toBeDefined()
    expect(params.instanceOffset).toBe(5)
    expect(params.instanceCount).toBe(10)
    expect(params.bpRangeLen).toBe(10000000)
    expect(params.regionScreenLeft).toBe(800)
    expect(params.regionScreenWidth).toBe(500)
  })

  test('HP splits region start into hi/lo components', () => {
    const index = new Map([['chr1', { startIdx: 0, count: 1 }]])
    const block = new BaseBlock({
      refName: 'chr1',
      start: 150000000,
      end: 160000000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 0,
      widthPx: 500,
    })
    const params = computeRegionRenderParams(block, 0, index)!

    // HP split: hi has bottom 12 bits zeroed, lo has bottom 12 bits + frac
    const reconstructed = params.bpRangeHi + params.bpRangeLo
    expect(reconstructed).toBe(150000000)

    // hi should be a multiple of 4096 (bottom 12 bits zeroed)
    expect(params.bpRangeHi % 4096).toBe(0)

    // lo should be less than 4096
    expect(params.bpRangeLo).toBeLessThan(4096)
    expect(params.bpRangeLo).toBeGreaterThanOrEqual(0)
  })
})
