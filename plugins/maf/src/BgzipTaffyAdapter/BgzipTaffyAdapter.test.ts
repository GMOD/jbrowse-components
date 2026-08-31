import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { makeSourceResolver } from '../util/parseAssemblyName.ts'
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

  // A column is read positionally — `finalizeBlock` takes row `j`'s base from
  // character `j` — so skipping a malformed pair shortened the string and gave
  // every row below it a base belonging to a different species, silently. The
  // analogous misalignment in `parseRowInstructions` already throws.
  test('parseBases throws on a malformed RLE pair rather than dropping it', () => {
    expect(() => parseBases('A 2 T x C 1', true)).toThrow(
      /Malformed run-length-encoded TAF column/,
    )
    expect(() => parseBases('A 2 GG 3', true)).toThrow(
      /Malformed run-length-encoded TAF column/,
    )
    // an odd token count leaves the last base with no count
    expect(() => parseBases('A 2 T', true)).toThrow(
      /Malformed run-length-encoded TAF column/,
    )
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
  // No sample set: tokens split on the dot heuristic (`makeSourceResolver`'s
  // other half), which is the discovery path all three adapters share.
  const splitResolve = makeSourceResolver().resolve

  const makeRow = (sequenceName: string, bases: string) => ({
    sequenceName,
    start: 100,
    strand: 1,
    sequenceLength: 1000,
    bases,
    length: bases.replaceAll('-', '').length,
  })

  test('no sampleFilter — all rows included, dot-split', () => {
    const block = {
      rows: [makeRow('hg38.chr1', 'ACGT'), makeRow('mm10.chr2', 'ACGT')],
      columnNumber: 4,
    }
    const feature = blockToFeature(block, splitResolve)
    expect(feature).toBeDefined()
    expect(feature!.alignments).toHaveProperty('hg38')
    expect(feature!.alignments).toHaveProperty('mm10')
    expect(feature!.alignments.hg38!.chr).toBe('chr1')
    expect(feature!.alignments.mm10!.chr).toBe('chr2')
  })

  // Discovery (no sampleFilter) used a first-dot split here while MAF-tabix
  // used the version-aware one, so the same haplotype-suffixed genome became a
  // different row — and carried a different `chr` into color-by-source-
  // chromosome and the inversion consensus — depending on file format.
  test('no sampleFilter — a haplotype suffix stays on the sample id', () => {
    const block = {
      rows: [makeRow('hg38.chr1', 'ACGT'), makeRow('HG002.1.chr1', 'ACGT')],
      columnNumber: 4,
    }
    const aln = blockToFeature(block, splitResolve)!.alignments
    expect(aln['HG002.1']).toBeDefined()
    expect(aln['HG002.1']!.chr).toBe('chr1')
  })

  // ...but a dotted contig accession is still all chromosome.
  test('no sampleFilter — a dotted contig accession is not read as a version', () => {
    const block = {
      rows: [makeRow('hg38.CM000663.2', 'ACGT')],
      columnNumber: 4,
    }
    const aln = blockToFeature(block, splitResolve)!.alignments
    expect(aln.hg38!.chr).toBe('CM000663.2')
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
    const feature = blockToFeature(block, makeSourceResolver(filter).resolve)
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
    const feature = blockToFeature(block, makeSourceResolver(filter).resolve)
    const aln = feature!.alignments
    expect(aln['Species1.1']).toBeDefined()
    expect(aln['Species1.2']).toBeDefined()
    expect(aln['Species2.1']).toBeUndefined()
    expect(aln['Species1.1']!.chr).toBe('chr3')
    expect(aln['Species1.2']!.seq).toBe('TGCA')
  })

  // A pangenome TAF names its rows PanSN (`sample#haplotype#contig`) — what
  // cactus/taffy emit, and what this repo's own E. coli pangenome build writes.
  // Discovery used to take the whole token as the sample and leave `chr` empty,
  // so every contig became its own row and both the features that key on `chr`
  // (color-by-source-chromosome, the inversion consensus) had nothing to key on.
  test('PanSN rows discover per haplotype, with the contig as chr', () => {
    const block = {
      rows: [
        makeRow('K12#1#chr', 'ACGT'),
        makeRow('HG002#1#chr1', 'ACGT'),
        makeRow('HG002#2#chr1', 'ACGT'),
      ],
      columnNumber: 4,
    }
    const aln = blockToFeature(block, splitResolve)!.alignments
    expect(Object.keys(aln)).toEqual(['K12#1', 'HG002#1', 'HG002#2'])
    expect(aln['HG002#1']!.chr).toBe('chr1')
  })

  test('PanSN rows narrow to a configured sample set', () => {
    const block = {
      rows: [makeRow('K12#1#chr', 'ACGT'), makeRow('O157#1#chr', 'TGCA')],
      columnNumber: 4,
    }
    const aln = blockToFeature(
      block,
      makeSourceResolver(new Set(['K12#1'])).resolve,
    )!.alignments
    expect(Object.keys(aln)).toEqual(['K12#1'])
    expect(aln['K12#1']!.chr).toBe('chr')
  })

  test('returns undefined for empty block', () => {
    expect(
      blockToFeature({ rows: [], columnNumber: 0 }, splitResolve),
    ).toBeUndefined()
    expect(
      blockToFeature(
        {
          rows: [makeRow('hg38.chr1', 'ACGT')],
          columnNumber: 0,
        },
        splitResolve,
      ),
    ).toBeUndefined()
  })

  test('ref row drives genomic span (start + length)', () => {
    const block = {
      rows: [makeRow('hg38.chr1', 'AC-GT')],
      columnNumber: 5,
    }
    const feature = blockToFeature(block, splitResolve)!
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

  test('adapter fetches the chromosome tail past the last index entry', async () => {
    // chrI's last .tai entry is at chrStart ~15,053,438; a query starting after
    // it and running past the chromosome end exercises the ranPastEnd read path
    // (bound at the chromosome data end / EOF via chrDataEndOffset + stat).
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
      start: 15_053_500,
      end: 15_200_000,
    })

    const featuresArray = await firstValueFrom(features.pipe(toArray()))
    expect(featuresArray.length).toBeGreaterThan(0)
    // Features land in the queried tail, not stale earlier blocks.
    expect(Math.max(...featuresArray.map(f => f.get('end')))).toBeGreaterThan(
      15_053_500,
    )
  })

  // The estimate feeds the fetch gate, so it has to track the size of the read
  // `getFeatures` would issue — both now derive it from one `queryBlockSpan`.
  test('getRegionByteSize grows with the region and is 0 off-index', async () => {
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
    const region = (start: number, end: number) => ({
      assemblyName: 'ce10',
      refName: 'chrI',
      start,
      end,
    })

    const narrow = await adapter.getRegionByteSize([region(3700, 50_000)])
    const wide = await adapter.getRegionByteSize([region(3700, 500_000)])
    expect(narrow).toBeGreaterThan(0)
    expect(wide).toBeGreaterThan(narrow)

    // Several regions accumulate rather than reporting only the last.
    const both = await adapter.getRegionByteSize([
      region(3700, 50_000),
      region(200_000, 300_000),
    ])
    expect(both).toBeGreaterThan(narrow)

    expect(
      await adapter.getRegionByteSize([
        { assemblyName: 'ce10', refName: 'chrNope', start: 0, end: 1000 },
      ]),
    ).toBe(0)

    // Only an unknown chromosome costs nothing. A query landing inside one
    // sparse bracket, and one running past the chromosome's last entry, both
    // resolve to a zero-width block span — but the read is still a whole bgzf
    // block, and reporting the span alone had the gate treat them as free.
    expect(await adapter.getRegionByteSize([region(3700, 4000)])).toBe(65536)
    expect(
      await adapter.getRegionByteSize([region(15_000_000, 15_100_000)]),
    ).toBe(65536)
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

// Every other MAF adapter passes `opts.stopToken` into `ObservableCreate`, which
// is what wires a cancel through to the rxjs chain. TAF's didn't, so a pan or
// zoom that rotated the stop token left this fetch delivering into a subscriber
// whose result had already been discarded — no error, no cancellation, just work
// nobody was waiting for on the one adapter whose reads are whole bgzf blocks.
describe('BgzipTaffyAdapter honors the stop token', () => {
  function tafAdapter() {
    return new BgzipTaffyAdapter(
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
  }
  const region = {
    assemblyName: 'ce10',
    refName: 'chrI',
    start: 3700,
    end: 50_000,
  }

  test('a token stopped before subscribe errors instead of delivering', async () => {
    const stopToken = createStopToken()
    stopStopToken(stopToken)
    await expect(
      firstValueFrom(
        tafAdapter().getFeatures(region, { stopToken }).pipe(toArray()),
      ),
    ).rejects.toThrow()
  })

  test('a live token delivers as before', async () => {
    const stopToken = createStopToken()
    const out = await firstValueFrom(
      tafAdapter().getFeatures(region, { stopToken }).pipe(toArray()),
    )
    expect(out.length).toBeGreaterThan(0)
  })
})

// `readHeader` decides whether the file's bases are run-length encoded. A
// missing `#taf` header legitimately means non-RLE; a failed *read* does not,
// and used to be swallowed into the same answer — which would have taken an RLE
// file's `"A 3 T 2"` for a literal sequence and rendered every base wrong with
// no error anywhere.
describe('BgzipTaffyAdapter RLE detection', () => {
  function tafAdapter(tafGzLocation: unknown) {
    return new BgzipTaffyAdapter(
      configSchema.create({
        tafGzLocation,
        taiLocation: {
          localPath:
            require.resolve('../../test_data/celegans/chrI.taf.gz.tai'),
          locationType: 'LocalPathLocation',
        },
      }),
    )
  }

  test('reads the header of a real (non-RLE) file rather than guessing', async () => {
    const adapter = tafAdapter({
      localPath: require.resolve('../../test_data/celegans/chrI.taf.gz'),
      locationType: 'LocalPathLocation',
    })
    await expect(adapter.readHeader()).resolves.toBe(false)
    // ...and it got there by reading, not by failing: the same call resolves
    // the whole setup
    await expect(adapter.configure()).resolves.toEqual(
      expect.objectContaining({ runLengthEncodeBases: false }),
    )
  })

  test('surfaces an unreadable file instead of assuming non-RLE', async () => {
    const adapter = tafAdapter({
      localPath: '/nonexistent/missing.taf.gz',
      locationType: 'LocalPathLocation',
    })
    await expect(adapter.readHeader()).rejects.toThrow()
    await expect(adapter.configure()).rejects.toThrow()
  })
})

describe('parseTafBlocksStreaming guards a cut tail', () => {
  // The generator reads no config, so a bare adapter is enough to reach it.
  const adapter = new BgzipTaffyAdapter(configSchema.create({}))
  const stream = (taf: string) => [
    ...adapter.parseTafBlocksStreaming(
      new TextEncoder().encode(taf),
      false,
      makeSourceResolver().resolve,
    ),
  ]

  const twoBlocks = [
    'AC ; i 0 hg38.chr1 100 + 1000',
    'AC',
    'GT ; s 0 hg38.chr1 102 + 1000',
    'GT',
    '',
  ].join('\n')

  test('keeps every block when the slice ends on a newline', () => {
    const features = stream(twoBlocks)
    expect(features.map(f => [f.start, f.end])).toEqual([
      [100, 102],
      [102, 104],
    ])
    expect(features.map(f => f.seq)).toEqual(['AA', 'GG'])
  })

  // TAF has no block terminator, so the open block is complete only once the
  // next coordinate line arrives. A read bounded by a byte range ends mid-line,
  // which leaves that block short however many columns the cut removed — here
  // it would place a 1bp block where a 2bp one belongs.
  test('drops the open block when the slice ends mid-line', () => {
    expect(stream(twoBlocks.trimEnd()).map(f => [f.start, f.end])).toEqual([
      [100, 102],
    ])
  })

  // A coordinate line cut before its ` ; ` looks like a plain bases line, so
  // `parseBasesColumn` would take `s 0 hg38.chr` for sequence; cut *after* it,
  // the truncated instruction stream reaches `parseRowInstructions`, which
  // throws on an opcode it doesn't know. Neither happens — the line is never
  // read.
  test('never reads a cut coordinate line', () => {
    expect(stream(`${twoBlocks}TT ; s 0 hg38.chr`).map(f => f.start)).toEqual([
      100,
    ])
    expect(() =>
      stream(`${twoBlocks}TT ; s 0 hg38.chr1 104 + 10`),
    ).not.toThrow()
  })
})

describe('blockToFeature places a minus-strand reference row forward', () => {
  const splitResolve = makeSourceResolver().resolve
  const row = (
    sequenceName: string,
    bases: string,
    strand: number,
    sequenceLength: number,
  ) => ({
    sequenceName,
    start: 1000,
    strand,
    sequenceLength,
    bases,
    length: bases.replaceAll('-', '').length,
  })

  const block = {
    rows: [
      row('hg38.chr1', 'ACGTACGTAC', -1, 2000),
      row('mm10.chr2', 'ACGTACGTAT', 1, 3000),
    ],
    columnNumber: 10,
  }

  test('flips the span through the reference srcSize', () => {
    const feature = blockToFeature(block, splitResolve)!
    expect([feature.start, feature.end]).toEqual([990, 1000])
    expect(feature.strand).toBe(1)
  })

  test('turns the whole block over, not just the coordinate', () => {
    const feature = blockToFeature(block, splitResolve)!
    expect(feature.seq).toBe('GTACGTACGT')
    expect(feature.alignments.hg38).toMatchObject({ start: 990, strand: 1 })
    expect(feature.alignments.mm10).toMatchObject({
      start: 1990,
      strand: -1,
      seq: 'ATACGTACGT',
    })
  })

  test('carries the reference row source token for the chromosome filter', () => {
    expect(blockToFeature(block, splitResolve)!.refSrc).toBe('hg38.chr1')
  })
})
