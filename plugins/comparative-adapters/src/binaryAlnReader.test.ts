import { promises as fsPromises } from 'fs'
import path from 'path'

import { LocalFile } from 'generic-filehandle2'

import { decodeBinaryCs, binaryCsIdentity } from './binaryCs.ts'
import {
  loadAlnIndex,
  queryAlnBin,
  parseAlnBinRecords,
} from './binaryAlnReader.ts'

const testDataDir = path.resolve(
  __dirname,
  '../../../test/data/synteny-demo/gfa-tabix-output',
)

describe('binaryAlnReader', () => {
  it('loads the aln.idx and parses header correctly', async () => {
    const idxFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.idx'))
    const index = await loadAlnIndex(idxFile)

    expect(index.genomeNames.length).toBeGreaterThanOrEqual(3)
    expect(index.chromNames.length).toBeGreaterThanOrEqual(3)
    expect(index.genomeNames).toContain('HG00621#2')
    expect(index.genomeNames).toContain('grch38#1')
    expect(index.genomeNames).toContain('chm13#1')
    expect(index.chromSections.size).toBeGreaterThan(0)
  })

  it('queries all records for a chromosome', async () => {
    const idxFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.idx'))
    const binFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.bin'))
    const index = await loadAlnIndex(idxFile)

    // Find a ref chrom that has data
    const chromName = index.chromNames.find(name =>
      index.chromSections.has(index.chromNames.indexOf(name)),
    )
    expect(chromName).toBeDefined()

    const records = await queryAlnBin(
      binFile,
      index,
      chromName!,
      0,
      20000,
    )

    expect(records.length).toBeGreaterThan(0)
    for (const rec of records) {
      expect(rec.refStart).toBeGreaterThanOrEqual(0)
      expect(rec.refEnd).toBeGreaterThan(rec.refStart)
      expect(rec.identity).toBeGreaterThanOrEqual(0)
      expect(rec.identity).toBeLessThanOrEqual(1)
      expect([1, -1]).toContain(rec.strand)
    }
  })

  it('binary CS round-trips to valid text CS', async () => {
    const idxFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.idx'))
    const binFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.bin'))
    const index = await loadAlnIndex(idxFile)

    const chromName = index.chromNames[0]!
    const records = await queryAlnBin(binFile, index, chromName, 0, 20000)

    for (const rec of records) {
      if (rec.csData.length > 0) {
        const textCs = decodeBinaryCs(rec.csData)
        // Verify the text CS starts with valid operations
        expect(textCs).toMatch(/^[:*+-]/)

        // Verify identity from binary CS matches the pre-computed value
        const computedIdentity = binaryCsIdentity(rec.csData)
        expect(Math.abs(computedIdentity - rec.identity)).toBeLessThan(0.001)
      }
    }
  })

  it('reads the full binary file and parses all records', async () => {
    const binPath = path.join(testDataDir, 'pggb-chrM.aln.bin')
    const buf = await fsPromises.readFile(binPath)
    const records = parseAlnBinRecords(new Uint8Array(buf))

    expect(records.length).toBeGreaterThanOrEqual(3)
  })

  it('returns empty array for unknown chromosome', async () => {
    const idxFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.idx'))
    const binFile = new LocalFile(path.join(testDataDir, 'pggb-chrM.aln.bin'))
    const index = await loadAlnIndex(idxFile)

    const records = await queryAlnBin(binFile, index, 'nonexistent', 0, 1000)
    expect(records.length).toBe(0)
  })
})
