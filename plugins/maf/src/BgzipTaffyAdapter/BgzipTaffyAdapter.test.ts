import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BgzipTaffyAdapter from './BgzipTaffyAdapter.ts'
import configSchema from './configSchema.ts'
import {
  filterFirstLineInstructions,
  parseRowInstructions,
} from './rowInstructions.ts'
import {
  blockToFeature,
  finalizeBlock,
  parseBases,
  parseCoordinatesAndEstablishBlock,
} from './tafParsing.ts'
import { countNonGapBases, parseLineByLine } from './testFixtures.ts'

// Test the core parsing logic with sample TAF data
describe('TAF parsing', () => {
  test('parses simple TAF block', () => {
    // Sample TAF data (simplified from real file)
    const tafData = `#taf version:1
ACGT ; i 0 hg38.chr1 100 + 1000 i 1 mm10.chr1 200 + 2000
ACGT
ACGT
`
    const buffer = new TextEncoder().encode(tafData)

    interface RowState {
      sequenceName: string
      start: number
      strand: number
      sequenceLength: number
      seq: string
    }

    const rows: RowState[] = []

    parseLineByLine(buffer, line => {
      if (line && !line.startsWith('#')) {
        const semicolonIndex = line.indexOf(' ; ')
        let basesAndTags: string
        let rowInstructions: string | undefined

        if (semicolonIndex !== -1) {
          basesAndTags = line.slice(0, semicolonIndex)
          rowInstructions = line.slice(semicolonIndex + 3)
        } else {
          basesAndTags = line
          rowInstructions = undefined
        }

        if (rowInstructions) {
          const atIndex = rowInstructions.indexOf(' @')
          const coordPart =
            atIndex !== -1 ? rowInstructions.slice(0, atIndex) : rowInstructions
          const instructions = parseRowInstructions(coordPart)

          for (const ins of instructions) {
            if (ins.type === 'i') {
              rows.splice(ins.row, 0, {
                sequenceName: ins.sequenceName,
                start: ins.start,
                strand: ins.strand,
                sequenceLength: ins.sequenceLength,
                seq: '',
              })
            }
          }
        }

        const basesStr = basesAndTags.trim()
        for (let i = 0; i < basesStr.length; i++) {
          const row = rows[i]
          if (row) {
            row.seq += basesStr[i]
          }
        }
      }
      return undefined
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      sequenceName: 'hg38.chr1',
      start: 100,
      strand: 1,
      sequenceLength: 1000,
    })
    expect(rows[0]!.seq).toBe('AAA')
    expect(rows[1]).toMatchObject({
      sequenceName: 'mm10.chr1',
      start: 200,
      strand: 1,
      sequenceLength: 2000,
    })
    expect(rows[1]!.seq).toBe('CCC')
  })

  test('handles gap operations', () => {
    const tafData = `#taf version:1
AC ; i 0 hg38.chr1 100 + 1000 i 1 mm10.chr1 200 + 2000
AC
AC ; g 1 50
`
    const buffer = new TextEncoder().encode(tafData)

    interface RowState {
      sequenceName: string
      start: number
      strand: number
      sequenceLength: number
      seq: string
    }

    const rows: RowState[] = []

    parseLineByLine(buffer, line => {
      if (line && !line.startsWith('#')) {
        const semicolonIndex = line.indexOf(' ; ')
        let basesAndTags: string
        let rowInstructions: string | undefined

        if (semicolonIndex !== -1) {
          basesAndTags = line.slice(0, semicolonIndex)
          rowInstructions = line.slice(semicolonIndex + 3)
        } else {
          basesAndTags = line
          rowInstructions = undefined
        }

        if (rowInstructions) {
          const atIndex = rowInstructions.indexOf(' @')
          const coordPart =
            atIndex !== -1 ? rowInstructions.slice(0, atIndex) : rowInstructions
          const instructions = parseRowInstructions(coordPart)

          for (const ins of instructions) {
            if (ins.type === 'i') {
              rows.splice(ins.row, 0, {
                sequenceName: ins.sequenceName,
                start: ins.start,
                strand: ins.strand,
                sequenceLength: ins.sequenceLength,
                seq: '',
              })
            } else if (ins.type === 'g') {
              const row = rows[ins.row]
              if (row) {
                row.start += ins.gapLength
              }
            }
          }
        }

        const basesStr = basesAndTags.trim()
        for (let i = 0; i < basesStr.length; i++) {
          const row = rows[i]
          if (row) {
            row.seq += basesStr[i]
          }
        }
      }
      return undefined
    })

    expect(rows).toHaveLength(2)
    // Row 0 should still have start 100
    expect(rows[0]!.start).toBe(100)
    // Row 1 should have start 200 + 50 = 250 after gap operation
    expect(rows[1]!.start).toBe(250)
  })

  test('handles delete operations', () => {
    const tafData = `#taf version:1
ABC ; i 0 hg38.chr1 100 + 1000 i 1 mm10.chr1 200 + 2000 i 2 rn6.chr1 300 + 3000
ABC
AB ; d 2
`
    const buffer = new TextEncoder().encode(tafData)

    interface RowState {
      sequenceName: string
      start: number
      strand: number
      sequenceLength: number
      seq: string
    }

    const rows: RowState[] = []

    parseLineByLine(buffer, line => {
      if (line && !line.startsWith('#')) {
        const semicolonIndex = line.indexOf(' ; ')
        let basesAndTags: string
        let rowInstructions: string | undefined

        if (semicolonIndex !== -1) {
          basesAndTags = line.slice(0, semicolonIndex)
          rowInstructions = line.slice(semicolonIndex + 3)
        } else {
          basesAndTags = line
          rowInstructions = undefined
        }

        if (rowInstructions) {
          const atIndex = rowInstructions.indexOf(' @')
          const coordPart =
            atIndex !== -1 ? rowInstructions.slice(0, atIndex) : rowInstructions
          const instructions = parseRowInstructions(coordPart)

          for (const ins of instructions) {
            if (ins.type === 'i') {
              rows.splice(ins.row, 0, {
                sequenceName: ins.sequenceName,
                start: ins.start,
                strand: ins.strand,
                sequenceLength: ins.sequenceLength,
                seq: '',
              })
            } else if (ins.type === 'd') {
              rows.splice(ins.row, 1)
            }
          }
        }

        const basesStr = basesAndTags.trim()
        for (let i = 0; i < basesStr.length; i++) {
          const row = rows[i]
          if (row) {
            row.seq += basesStr[i]
          }
        }
      }
      return undefined
    })

    // After delete, should only have 2 rows
    expect(rows).toHaveLength(2)
    expect(rows[0]!.seq).toBe('AAA')
    expect(rows[1]!.seq).toBe('BBB')
  })

  test('calculates non-gap length correctly', () => {
    expect(countNonGapBases('ACGT')).toBe(4)
    expect(countNonGapBases('AC-GT')).toBe(4)
    expect(countNonGapBases('--ACGT--')).toBe(4)
    expect(countNonGapBases('----')).toBe(0)
  })

  test('parses real TAF format from ce10 7-way', () => {
    // Real data from the ce10 chrI TAF file
    const tafData = `#taf version:1 scoring:roast.v3.3
Tt ; i 0 ce10.chrI 3725 + 15072423 i 1 caePb3.Scfld02_18 203084 + 1480539
Cc
TT
TT
TT
TT
AC
GG
TC
`
    const buffer = new TextEncoder().encode(tafData)

    interface RowState {
      sequenceName: string
      start: number
      strand: number
      sequenceLength: number
      seq: string
    }

    const rows: RowState[] = []

    parseLineByLine(buffer, line => {
      if (line && !line.startsWith('#')) {
        const semicolonIndex = line.indexOf(' ; ')
        let basesAndTags: string
        let rowInstructions: string | undefined

        if (semicolonIndex !== -1) {
          basesAndTags = line.slice(0, semicolonIndex)
          rowInstructions = line.slice(semicolonIndex + 3)
        } else {
          basesAndTags = line
          rowInstructions = undefined
        }

        if (rowInstructions) {
          const atIndex = rowInstructions.indexOf(' @')
          const coordPart =
            atIndex !== -1 ? rowInstructions.slice(0, atIndex) : rowInstructions
          const instructions = parseRowInstructions(coordPart)

          for (const ins of instructions) {
            if (ins.type === 'i') {
              rows.splice(ins.row, 0, {
                sequenceName: ins.sequenceName,
                start: ins.start,
                strand: ins.strand,
                sequenceLength: ins.sequenceLength,
                seq: '',
              })
            }
          }
        }

        const basesStr = basesAndTags.trim()
        for (let i = 0; i < basesStr.length; i++) {
          const row = rows[i]
          if (row) {
            row.seq += basesStr[i]
          }
        }
      }
      return undefined
    })

    expect(rows).toHaveLength(2)

    // Row 0: ce10.chrI
    // Column-by-column: Tt, Cc, TT, TT, TT, TT, AC, GG, TC
    // Row 0 gets: T, C, T, T, T, T, A, G, T = "TCTTTAGT"
    expect(rows[0]).toMatchObject({
      sequenceName: 'ce10.chrI',
      start: 3725,
      strand: 1,
      sequenceLength: 15072423,
    })
    expect(rows[0]!.seq).toBe('TCTTTTAGT')

    // Row 1: caePb3.Scfld02_18
    // Row 1 gets: t, c, T, T, T, T, C, G, C = "tcTTTTCGC"
    expect(rows[1]).toMatchObject({
      sequenceName: 'caePb3.Scfld02_18',
      start: 203084,
      strand: 1,
      sequenceLength: 1480539,
    })
    expect(rows[1]!.seq).toBe('tcTTTTCGC')
  })
})

describe('BgzipTaffyAdapter methods', () => {
  const testDecoder = new TextDecoder()

  test('parseBases handles plain format', () => {
    expect(parseBases('ACGT', false)).toBe('ACGT')
    expect(parseBases('acgt', false)).toBe('acgt')
    expect(parseBases('AC-T', false)).toBe('AC-T')
  })

  test('parseBases handles run-length encoded format', () => {
    expect(parseBases('A 3', true)).toBe('AAA')
    expect(parseBases('A 2 T 2', true)).toBe('AATT')
    expect(parseBases('- 3 A 1', true)).toBe('---A')
  })

  test('parseCoordinatesAndEstablishBlock creates new block from scratch', () => {
    const instructions = filterFirstLineInstructions(
      parseRowInstructions('s 0 ce10.chrI 100 + 1000 s 1 mm10.chr1 200 + 2000'),
    )

    const block = parseCoordinatesAndEstablishBlock(undefined, instructions)

    expect(block.rows).toHaveLength(2)
    expect(block.rows[0]).toMatchObject({
      sequenceName: 'ce10.chrI',
      start: 100,
      strand: 1,
      sequenceLength: 1000,
    })
    expect(block.rows[1]).toMatchObject({
      sequenceName: 'mm10.chr1',
      start: 200,
      strand: 1,
      sequenceLength: 2000,
    })
  })

  test('parseCoordinatesAndEstablishBlock copies from previous block', () => {
    // First block
    const instructions1 = parseRowInstructions(
      'i 0 ce10.chrI 100 + 1000 i 1 mm10.chr1 200 + 2000',
    )
    const block1 = parseCoordinatesAndEstablishBlock(undefined, instructions1)
    block1.rows[0]!.length = 50
    block1.rows[1]!.length = 50

    // Second block - no instructions, should copy from previous
    const block2 = parseCoordinatesAndEstablishBlock(block1, [])

    expect(block2.rows).toHaveLength(2)
    // Starts should be previous start + previous length
    expect(block2.rows[0]!.start).toBe(150) // 100 + 50
    expect(block2.rows[1]!.start).toBe(250) // 200 + 50
  })

  test('parseCoordinatesAndEstablishBlock handles insert in middle of block', () => {
    // First block with 2 rows
    const instructions1 = parseRowInstructions(
      'i 0 ce10.chrI 100 + 1000 i 1 mm10.chr1 200 + 2000',
    )
    const block1 = parseCoordinatesAndEstablishBlock(undefined, instructions1)
    block1.rows[0]!.length = 10
    block1.rows[1]!.length = 10

    // Second block - insert new row at position 1
    const instructions2 = parseRowInstructions('i 1 rn6.chr1 300 + 3000')
    const block2 = parseCoordinatesAndEstablishBlock(block1, instructions2)

    expect(block2.rows).toHaveLength(3)
    expect(block2.rows[0]!.sequenceName).toBe('ce10.chrI')
    expect(block2.rows[1]!.sequenceName).toBe('rn6.chr1')
    expect(block2.rows[2]!.sequenceName).toBe('mm10.chr1')
  })

  test('parseCoordinatesAndEstablishBlock handles delete', () => {
    // First block with 3 rows
    const instructions1 = parseRowInstructions(
      'i 0 ce10.chrI 100 + 1000 i 1 mm10.chr1 200 + 2000 i 2 rn6.chr1 300 + 3000',
    )
    const block1 = parseCoordinatesAndEstablishBlock(undefined, instructions1)
    for (const r of block1.rows) {
      r.length = 10
    }

    // Second block - delete middle row
    const instructions2 = parseRowInstructions('d 1')
    const block2 = parseCoordinatesAndEstablishBlock(block1, instructions2)

    expect(block2.rows).toHaveLength(2)
    expect(block2.rows[0]!.sequenceName).toBe('ce10.chrI')
    expect(block2.rows[1]!.sequenceName).toBe('rn6.chr1')
  })

  test('parseCoordinatesAndEstablishBlock handles gap', () => {
    const instructions1 = parseRowInstructions(
      'i 0 ce10.chrI 100 + 1000 i 1 mm10.chr1 200 + 2000',
    )
    const block1 = parseCoordinatesAndEstablishBlock(undefined, instructions1)
    block1.rows[0]!.length = 10
    block1.rows[1]!.length = 10

    // Add gap to row 1
    const instructions2 = parseRowInstructions('g 1 50')
    const block2 = parseCoordinatesAndEstablishBlock(block1, instructions2)

    expect(block2.rows[0]!.start).toBe(110) // 100 + 10
    expect(block2.rows[1]!.start).toBe(260) // 200 + 10 + 50 (gap)
  })

  test('finalizeBlock transposes columns to rows', () => {
    const block = {
      rows: [
        {
          sequenceName: 'a',
          start: 0,
          strand: 1,
          sequenceLength: 100,
          bases: '',
          length: 0,
        },
        {
          sequenceName: 'b',
          start: 0,
          strand: 1,
          sequenceLength: 100,
          bases: '',
          length: 0,
        },
      ],
      columnNumber: 0,
    }

    const columns = ['AC', 'GT', 'AC']

    finalizeBlock(block, columns, testDecoder)

    expect(block.columnNumber).toBe(3)
    expect(block.rows[0]!.bases).toBe('AGA') // First char from each column
    expect(block.rows[1]!.bases).toBe('CTC') // Second char from each column
    expect(block.rows[0]!.length).toBe(3)
    expect(block.rows[1]!.length).toBe(3)
  })

  test('finalizeBlock counts non-gap bases correctly', () => {
    const block = {
      rows: [
        {
          sequenceName: 'a',
          start: 0,
          strand: 1,
          sequenceLength: 100,
          bases: '',
          length: 0,
        },
        {
          sequenceName: 'b',
          start: 0,
          strand: 1,
          sequenceLength: 100,
          bases: '',
          length: 0,
        },
      ],
      columnNumber: 0,
    }

    // Row 0 gets: A, -, A = 2 non-gap
    // Row 1 gets: C, C, C = 3 non-gap
    const columns = ['AC', '-C', 'AC']

    finalizeBlock(block, columns, testDecoder)

    expect(block.rows[0]!.bases).toBe('A-A')
    expect(block.rows[0]!.length).toBe(2)
    expect(block.rows[1]!.bases).toBe('CCC')
    expect(block.rows[1]!.length).toBe(3)
  })
})

describe('blockToFeature', () => {
  const makeRow = (sequenceName: string, bases: string) => ({
    sequenceName,
    start: 100,
    strand: 1,
    sequenceLength: 1000,
    bases,
    length: bases.replace(/-/g, '').length,
  })

  test('no sampleFilter — all rows included, simple dot-split', () => {
    const block = {
      rows: [makeRow('hg38.chr1', 'ACGT'), makeRow('mm10.chr2', 'ACGT')],
      columnNumber: 4,
    }
    const feature = blockToFeature(block)
    expect(feature).toBeDefined()
    expect(feature!.alignments).toHaveProperty('hg38')
    expect(feature!.alignments).toHaveProperty('mm10')
    expect(feature!.alignments.hg38!.chr).toBe('chr1')
    expect(feature!.alignments.mm10!.chr).toBe('chr2')
  })

  test('sampleFilter with plain names — rows not in filter are dropped', () => {
    const block = {
      rows: [
        makeRow('hg38.chr1', 'ACGT'),
        makeRow('mm10.chr2', 'ACGT'),
        makeRow('panTro6.chr1', 'ACGT'),
      ],
      columnNumber: 4,
    }
    const filter = new Set(['hg38', 'panTro6'])
    const feature = blockToFeature(block, filter)
    expect(feature!.alignments).toHaveProperty('hg38')
    expect(feature!.alignments).toHaveProperty('panTro6')
    expect(feature!.alignments).not.toHaveProperty('mm10')
  })

  test('sampleFilter with haplotype-suffixed names — matchSampleId resolves correctly', () => {
    const block = {
      rows: [
        makeRow('Species1.1.chr3', 'ACGT'),
        makeRow('Species1.2.chr3', 'TGCA'),
        makeRow('Species2.1.chr3', 'ACGT'),
      ],
      columnNumber: 4,
    }
    const filter = new Set(['Species1.1', 'Species1.2'])
    const feature = blockToFeature(block, filter)
    const aln = feature!.alignments
    expect(aln['Species1.1']).toBeDefined()
    expect(aln['Species1.2']).toBeDefined()
    expect(aln['Species2.1']).toBeUndefined()
    expect(aln['Species1.1']!.chr).toBe('chr3')
    expect(aln['Species1.2']!.seq).toBe('TGCA')
  })

  test('returns undefined for empty block', () => {
    expect(blockToFeature({ rows: [], columnNumber: 0 })).toBeUndefined()
    expect(
      blockToFeature({
        rows: [makeRow('hg38.chr1', 'ACGT')],
        columnNumber: 0,
      }),
    ).toBeUndefined()
  })

  test('ref row drives genomic span (start + length)', () => {
    const block = {
      rows: [makeRow('hg38.chr1', 'AC-GT')],
      columnNumber: 5,
    }
    const feature = blockToFeature(block)!
    expect(feature.start).toBe(100)
    expect(feature.end).toBe(104) // 4 non-gap bases
  })
})

describe('BgzipTaffyAdapter integration tests', () => {
  test('adapter can fetch features from celegans chrI.taf.gz', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
        nhLocation: {
          localPath: require.resolve('../../test_data/celegans/ce10.7way.nh'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const features = adapter.getFeatures({
      assemblyName: 'ce10',
      refName: 'chrI',
      start: 3700,
      end: 4000,
    })

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.length).toBeGreaterThan(0)

    const first = featuresArray[0]!
    expect(first.get('refName')).toBe('chrI')
    expect(first.get('start')).toBeGreaterThanOrEqual(0)
    expect(first.get('end')).toBeGreaterThan(first.get('start'))
    expect(first.get('alignments')).toBeDefined()
  })

  test('adapter returns correct ref names', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const refNames = await adapter.getRefNames()
    expect(refNames).toContain('chrI')
  })

  test('adapter can fetch samples with newick tree', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
        nhLocation: {
          localPath: require.resolve('../../test_data/celegans/ce10.7way.nh'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const result = await adapter.getSamples()

    expect(result.treeNewick).toBeDefined()
  })

  test('adapter can fetch features from a larger region', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const features = adapter.getFeatures({
      assemblyName: 'ce10',
      refName: 'chrI',
      start: 3700,
      end: 50000,
    })

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.length).toBeGreaterThan(0)

    for (const feat of featuresArray) {
      expect(feat.get('alignments')).toBeDefined()
      expect(feat.get('seq')).toBeDefined()
      expect(feat.get('start')).toBeLessThan(feat.get('end'))
    }
  })

  test('adapter returns empty array for region with no data', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const features = adapter.getFeatures({
      assemblyName: 'ce10',
      refName: 'nonexistent',
      start: 0,
      end: 1000,
    })

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.length).toBe(0)
  })

  test('adapter handles single-entry index files (evolverMammals)', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/evolverMammals.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/evolverMammals.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const refNames = await adapter.getRefNames()
    expect(refNames).toContain('Anc0refChr0')

    const features = adapter.getFeatures({
      assemblyName: 'Anc0',
      refName: 'Anc0refChr0',
      start: 0,
      end: 100,
    })

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.length).toBeGreaterThan(0)

    const first = featuresArray[0]!
    expect(first.get('alignments')).toBeDefined()
    expect(first.get('seq')).toBeDefined()
  })

  test('feature alignments contain expected organism data', async () => {
    const adapter = new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation: {
          localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
          locationType: 'LocalPathLocation',
        },
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
      }),
    )

    const features = adapter.getFeatures({
      assemblyName: 'ce10',
      refName: 'chrI',
      start: 3700,
      end: 4000,
    })

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.length).toBeGreaterThan(0)

    const first = featuresArray[0]!
    const alignments = first.get('alignments') as Record<string, unknown>

    expect(alignments).toBeDefined()
    expect(typeof alignments).toBe('object')

    const organismNames = Object.keys(alignments)
    expect(organismNames.length).toBeGreaterThan(0)

    const firstOrganism = alignments[organismNames[0]!]
    expect(firstOrganism).toHaveProperty('chr')
    expect(firstOrganism).toHaveProperty('start')
    expect(firstOrganism).toHaveProperty('seq')
  })
})
