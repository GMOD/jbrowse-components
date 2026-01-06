import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './PAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'
import { addSyriTypes, getWeightedMeans } from './util.ts'

import type { PAFRecord } from './util.ts'

test('adapter can fetch features from peach_grape.paf', async () => {
  const adapter = new Adapter(
    MyConfigSchema.create({
      pafLocation: {
        localPath: require.resolve('./test_data/peach_grape.paf'),
        locationType: 'LocalPathLocation',
      },
      assemblyNames: ['peach', 'grape'],
    }),
  )

  const features1 = adapter.getFeatures({
    refName: 'Pp01',
    start: 0,
    end: 200000,
    assemblyName: 'peach',
  })

  const features2 = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 200000,
    assemblyName: 'grape',
  })

  const fa1 = await firstValueFrom(features1.pipe(toArray()))
  const fa2 = await firstValueFrom(features2.pipe(toArray()))
  expect(fa1.length).toBe(11)
  expect(fa2.length).toBe(5)
  expect(fa1[0]!.get('refName')).toBe('Pp01')
  expect(fa2[0]!.get('refName')).toBe('chr1')

  // Verify syriType is set on features
  const syriType1 = fa1[0]!.get('syriType')
  expect(['SYN', 'INV', 'TRANS', 'DUP']).toContain(syriType1)
})

describe('syriType classification', () => {
  // Helper to create a PAFRecord
  function createRecord(
    qname: string,
    qstart: number,
    qend: number,
    tname: string,
    tstart: number,
    tend: number,
    strand: number,
  ): PAFRecord {
    return {
      qname,
      qstart,
      qend,
      tname,
      tstart,
      tend,
      strand,
      extra: {
        numMatches: Math.abs(qend - qstart),
        blockLen: Math.abs(qend - qstart),
        mappingQual: 60,
      },
    }
  }

  test('classifies SYN for same chromosome forward strand alignments', () => {
    // chr1 maps primarily to chrA (largest coverage)
    // This alignment is chr1 -> chrA, forward strand = SYN
    const records: PAFRecord[] = [
      createRecord('chr1', 0, 100000, 'chrA', 0, 100000, 1),
      createRecord('chr1', 100000, 200000, 'chrA', 100000, 200000, 1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('SYN')
    expect(result[1]!.extra.syriType).toBe('SYN')
  })

  test('classifies INV for same chromosome reverse strand alignments', () => {
    // chr1 maps primarily to chrA
    // This alignment is chr1 -> chrA, reverse strand = INV
    const records: PAFRecord[] = [
      createRecord('chr1', 0, 100000, 'chrA', 100000, 0, -1),
      createRecord('chr1', 100000, 200000, 'chrA', 200000, 100000, -1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('INV')
    expect(result[1]!.extra.syriType).toBe('INV')
  })

  test('classifies TRANS for alignments to non-primary target', () => {
    // chr1 maps primarily to chrA (larger total coverage)
    // But one alignment goes to chrB = TRANS
    const records: PAFRecord[] = [
      // 200kb to chrA - this is the primary target
      createRecord('chr1', 0, 100000, 'chrA', 0, 100000, 1),
      createRecord('chr1', 100000, 200000, 'chrA', 100000, 200000, 1),
      // 50kb to chrB - this is a translocation
      createRecord('chr1', 200000, 250000, 'chrB', 0, 50000, 1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('SYN') // to chrA
    expect(result[1]!.extra.syriType).toBe('SYN') // to chrA
    expect(result[2]!.extra.syriType).toBe('TRANS') // to chrB (not primary)
  })

  test('classifies DUP for non-collinear mappings within same target', () => {
    // chr1 maps to chrA
    // Query positions are close (10kb gap) but target positions jump >100kb
    // This indicates a potential duplication
    const records: PAFRecord[] = [
      // First block: query 0-100kb maps to target 0-100kb
      createRecord('chr1', 0, 100000, 'chrA', 0, 100000, 1),
      // Second block: query 110kb-200kb (10kb gap) maps to target 500kb-590kb (400kb jump)
      // This is a non-collinear pattern suggesting duplication
      createRecord('chr1', 110000, 200000, 'chrA', 500000, 590000, 1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('DUP')
    expect(result[1]!.extra.syriType).toBe('DUP')
  })

  test('does not classify as DUP when target gap is proportional to query gap', () => {
    // Normal collinear alignment - gaps are proportional
    const records: PAFRecord[] = [
      createRecord('chr1', 0, 100000, 'chrA', 0, 100000, 1),
      // 50kb gap in query, ~50kb gap in target - this is normal, not DUP
      createRecord('chr1', 150000, 250000, 'chrA', 150000, 250000, 1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('SYN')
    expect(result[1]!.extra.syriType).toBe('SYN')
  })

  test('mixed classifications in a complex scenario', () => {
    const records: PAFRecord[] = [
      // chr1 primarily maps to chrA (300kb total)
      createRecord('chr1', 0, 100000, 'chrA', 0, 100000, 1), // SYN
      createRecord('chr1', 100000, 200000, 'chrA', 100000, 200000, 1), // SYN
      createRecord('chr1', 200000, 300000, 'chrA', 200000, 300000, -1), // INV (reverse)

      // chr1 also has a small alignment to chrB (translocation)
      createRecord('chr1', 300000, 350000, 'chrB', 0, 50000, 1), // TRANS

      // chr2 primarily maps to chrB
      createRecord('chr2', 0, 100000, 'chrB', 100000, 200000, 1), // SYN
      createRecord('chr2', 100000, 200000, 'chrB', 200000, 300000, 1), // SYN
    ]

    const result = addSyriTypes(getWeightedMeans(records))

    // chr1 -> chrA alignments
    expect(result[0]!.extra.syriType).toBe('SYN')
    expect(result[1]!.extra.syriType).toBe('SYN')
    expect(result[2]!.extra.syriType).toBe('INV')

    // chr1 -> chrB (translocation since chr1 primarily maps to chrA)
    expect(result[3]!.extra.syriType).toBe('TRANS')

    // chr2 -> chrB alignments
    expect(result[4]!.extra.syriType).toBe('SYN')
    expect(result[5]!.extra.syriType).toBe('SYN')
  })

  test('handles single alignment correctly', () => {
    const records: PAFRecord[] = [
      createRecord('chr1', 0, 100000, 'chrA', 0, 100000, 1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('SYN')
  })

  test('handles single reverse strand alignment as INV', () => {
    const records: PAFRecord[] = [
      createRecord('chr1', 0, 100000, 'chrA', 100000, 0, -1),
    ]

    const result = addSyriTypes(getWeightedMeans(records))
    expect(result[0]!.extra.syriType).toBe('INV')
  })
})
