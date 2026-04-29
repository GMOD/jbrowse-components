import { DEFAULT_CIGAR_OP_DRAW_COLORS as DEFAULT_SYNTENY_COLORS } from '@jbrowse/alignments-core'
import { makeContentBlock } from '@jbrowse/core/util/blockTypes'

import { prepareBlockGeometry } from './packGpu.ts'
import {
  FIELD_OFFSET_F32 as FILL_FIELD,
  INSTANCE_STRIDE_BYTES as INSTANCE_BYTE_SIZE,
  INSTANCE_STRIDE_F32 as FILL_STRIDE,
} from '../../shaders/multiSyntenyFill.generated.ts'
import { computeBlockRenderParams } from '../../shared/blockRenderParams.ts'
import { packCoverageForGpu } from '../coverage/packGpu.ts'

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
  const off = index * FILL_STRIDE
  const packed = u32[off + FILL_FIELD.color]!
  return {
    startBp: u32[off + FILL_FIELD.startBp]!,
    endBp: u32[off + FILL_FIELD.endBp]!,
    genomeRow: u32[off + FILL_FIELD.genomeRow]!,
    featureId: u32[off + FILL_FIELD.featureId]!,
    r: (packed & 0xff) / 255,
    g: ((packed >> 8) & 0xff) / 255,
    b: ((packed >> 16) & 0xff) / 255,
    a: ((packed >>> 24) & 0xff) / 255,
  }
}

describe('prepareBlockGeometry', () => {
  test('returns empty data for no features', () => {
    const result = prepareBlockGeometry(
      [],
      [],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(0)
    expect(result.buffer.byteLength).toBe(0)
  })

  test('packs single feature with correct bp coordinates', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat()]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
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
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ origRefName: 'chr1' })]],
      ['genomeB', [feat({ origRefName: 'chr1' })]],
      ['genomeC', [feat({ origRefName: 'chr1' })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
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

  test('sorts features by genomeRow then startBp', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      [
        'genomeA',
        [
          feat({ origRefName: 'chr1', start: 3000, end: 4000 }),
          feat({ origRefName: 'chr1', start: 1000, end: 2000 }),
        ],
      ],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
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
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cigar: '100M50D100M', start: 1000, end: 1250 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(2)

    let foundDeletion = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1100 && inst.endBp === 1150) {
        foundDeletion = true
        expect(inst.r).toBeCloseTo(0.533, 1)
      }
    }
    expect(foundDeletion).toBe(true)
  })

  test('expands CIGAR mismatches (X) into sub-instances', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cigar: '50M10X40M', start: 1000, end: 1100 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(2)

    let foundMismatch = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1060) {
        foundMismatch = true
        expect(inst.r).toBeCloseTo(1, 1)
        expect(inst.g).toBeCloseTo(0, 1)
      }
    }
    expect(foundMismatch).toBe(true)
  })

  test('expands CIGAR insertions as interbase markers', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cigar: '50M5I50M', start: 1000, end: 1100 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(2)

    let foundInsertion = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1050) {
        foundInsertion = true
      }
    }
    expect(foundInsertion).toBe(true)
  })

  test('insertions do not advance reference position', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cigar: '50M5I10D40M', start: 1000, end: 1100 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(3)

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
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cs: ':50*ag:49', start: 1000, end: 1100 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(2)

    let foundSub = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1051) {
        foundSub = true
        expect(inst.g).toBeGreaterThan(0.5)
      }
    }
    expect(foundSub).toBe(true)
  })

  test('expands cs deletions', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cs: ':50-acgt:46', start: 1000, end: 1100 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
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
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat({ cs: ':50+acgt:50', start: 1000, end: 1100 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
      ['genomeA'],
      'strand',
      true,
      DEFAULT_SYNTENY_COLORS,
    )
    expect(result.instanceCount).toBe(2)

    let foundIns = false
    for (let i = 0; i < result.instanceCount; i++) {
      const inst = readInstance(result.buffer, i)
      if (inst.startBp === 1050 && inst.endBp === 1050) {
        foundIns = true
      }
    }
    expect(foundIns).toBe(true)
  })

  test('feature IDs are 1-based and unique per feature', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      [
        'genomeA',
        [
          feat({ origRefName: 'chr1', start: 100, end: 200 }),
          feat({ origRefName: 'chr1', start: 300, end: 400 }),
        ],
      ],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
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

  test('instance buffer is exactly INSTANCE_BYTE_SIZE per instance', () => {
    const genomeFeatures: [string, MultiPairFeature[]][] = [
      ['genomeA', [feat(), feat({ start: 3000, end: 4000 })]],
    ]
    const result = prepareBlockGeometry(
      genomeFeatures,
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

describe('computeBlockRenderParams', () => {
  test('returns correct params for block', () => {
    const block = makeContentBlock({
      refName: 'chr1',
      start: 150000000,
      end: 160000000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 1000,
      widthPx: 500,
    })
    const params = computeBlockRenderParams(block, 200)
    expect(params.bpRangeLen).toBe(10000000)
    expect(params.regionScreenLeft).toBe(800)
    expect(params.regionScreenWidth).toBe(500)
  })

  test('HP splits region start into hi/lo components', () => {
    const block = makeContentBlock({
      refName: 'chr1',
      start: 150000000,
      end: 160000000,
      assemblyName: 'test',
      key: 'k1',
      offsetPx: 0,
      widthPx: 500,
    })
    const params = computeBlockRenderParams(block, 0)

    const reconstructed = params.bpRangeHi + params.bpRangeLo
    expect(reconstructed).toBe(150000000)

    expect(params.bpRangeHi % 4096).toBe(0)
    expect(params.bpRangeLo).toBeLessThan(4096)
    expect(params.bpRangeLo).toBeGreaterThanOrEqual(0)
  })
})

describe('packCoverageForGpu', () => {
  test('returns empty for zero maxDepth', () => {
    const depths = new Float32Array([1, 2, 3])
    const result = packCoverageForGpu(depths, 0, 0, 0)
    expect(result.binCount).toBe(0)
    expect(result.buffer.byteLength).toBe(0)
  })

  test('returns empty for empty depths', () => {
    const result = packCoverageForGpu(new Float32Array(0), 0, 10, 0)
    expect(result.binCount).toBe(0)
  })

  test('packs non-zero bins into 12-byte records', () => {
    const depths = new Float32Array([0, 5, 10, 0])
    const result = packCoverageForGpu(depths, 100, 10, 1000)
    expect(result.binCount).toBeGreaterThan(0)
    expect(result.buffer.byteLength).toBe(result.binCount * 12)
  })

  test('positions are absolute genomic coords', () => {
    const depths = new Float32Array([5])
    const result = packCoverageForGpu(depths, 1500, 5, 1000)
    expect(result.binCount).toBe(1)
    const f32 = new Float32Array(result.buffer)
    expect(f32[0]).toBe(1500)
  })
})
