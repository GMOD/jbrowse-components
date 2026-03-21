import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { gfaToTabix } from './gfa-to-tabix.ts'

const GFA_FILE = path.resolve(
  'test/data/synteny-demo/synthetic/synthetic_4genome.gfa',
)

async function withTmpDir(fn: (dir: string) => Promise<void>) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfa-tabix-test-'))
  try {
    await fn(tmpDir)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

function tabixQuery(file: string, region: string) {
  try {
    return execSync(`tabix "${file}" "${region}"`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(l => l.length > 0)
  } catch {
    return []
  }
}

function readSegsFile(prefix: string) {
  return execSync(`zcat "${prefix}.segments.gz"`, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(l => l.length > 0 && !l.startsWith('#'))
}

function readSegsIdx(prefix: string) {
  const buf = fs.readFileSync(`${prefix}.segments.idx`)
  const aligned = new ArrayBuffer(buf.byteLength)
  new Uint8Array(aligned).set(buf)
  return new BigUint64Array(aligned)
}

function querySegsRange(prefix: string, minOrd: number, maxOrd: number) {
  const idx = readSegsIdx(prefix)
  const startOffset = Number(idx[minOrd]!)
  const endOffset = Number(idx[Math.min(maxOrd + 1, idx.length - 1)]!)
  const allText = execSync(`zcat "${prefix}.segments.gz"`, { encoding: 'utf8' })
  const slice = allText.slice(startOffset, endOffset)
  return slice
    .trim()
    .split('\n')
    .filter(l => l.length > 0 && !l.startsWith('#'))
}

describe('GFA to tabix conversion', () => {
  it('creates pos.bed.gz and segs.gz with indexes', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      const stats = await gfaToTabix(GFA_FILE, prefix)

      expect(fs.existsSync(`${prefix}.pos.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.pos.bed.gz.tbi`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segments.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segments.gz.gzi`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segments.idx`)).toBe(true)

      expect(stats.segmentCount).toBe(224)
      expect(stats.pathCount).toBe(4)
      expect(stats.genomes.sort()).toEqual(
        ['ref#1', 'sample1#1', 'sample2#1', 'sample3#1'].sort(),
      )
    })
  })

  it('pos.bed.gz can be queried by genome path', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      const results = tabixQuery(`${prefix}.pos.bed.gz`, 'ref#1#chr1:0-100000')
      expect(results.length).toBeGreaterThan(0)

      const cols = results[0]!.split('\t')
      expect(cols.length).toBe(5)
      expect(cols[0]).toBe('ref#1#chr1')
      expect(+cols[1]!).toBeGreaterThanOrEqual(0)
    })
  })

  it('segs.gz has 6 columns per row', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      const lines = readSegsFile(prefix)
      expect(lines.length).toBeGreaterThan(0)

      const cols = lines[0]!.split('\t')
      expect(cols.length).toBe(6)
      // First column is numeric segment ID
      expect(+cols[0]!).toBeGreaterThanOrEqual(0)
    })
  })

  it('pos.bed.gz returns correct segment ordinal ranges', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      const results = tabixQuery(`${prefix}.pos.bed.gz`, 'ref#1#chr1:0-50000')

      for (const line of results) {
        const cols = line.split('\t')
        const minOrd = +cols[3]!
        const maxOrd = +cols[4]!
        expect(minOrd).toBeLessThanOrEqual(maxOrd)
        expect(minOrd).toBeGreaterThanOrEqual(0)
      }
    })
  })

  it('shared segments appear in segs for multiple genomes', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      // Query segment ordinal 0 using companion index
      const results = querySegsRange(prefix, 0, 0)
      expect(results.length).toBe(4) // shared by all 4 genomes

      const paths = results.map(r => r.split('\t')[1])
      expect(paths).toContain('ref#1#chr1')
      expect(paths).toContain('sample1#1#chr1')
    })
  })

  it('companion index has correct offsets', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      const idx = readSegsIdx(prefix)
      // Should have numSegments + 1 entries (sentinel at end)
      expect(idx.length).toBeGreaterThan(1)

      // Offsets should be monotonically non-decreasing
      for (let i = 1; i < idx.length; i++) {
        expect(idx[i]!).toBeGreaterThanOrEqual(idx[i - 1]!)
      }

      // Querying segment 0 via index should return rows starting with "0\t"
      const seg0Lines = querySegsRange(prefix, 0, 0)
      for (const line of seg0Lines) {
        expect(line.startsWith('0\t')).toBe(true)
      }
    })
  })

  it('synteny projection: ref region → other genomes via segments', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      // Step 1: get segment range for ref genome region
      const posResults = tabixQuery(
        `${prefix}.pos.bed.gz`,
        'ref#1#chr1:0-100000',
      )
      expect(posResults.length).toBeGreaterThan(0)

      let minOrd = Infinity
      let maxOrd = -Infinity
      for (const line of posResults) {
        const cols = line.split('\t')
        minOrd = Math.min(minOrd, +cols[3]!)
        maxOrd = Math.max(maxOrd, +cols[4]!)
      }

      // Step 2: get all paths for those segments via companion index
      const segResults = querySegsRange(prefix, minOrd, maxOrd)
      expect(segResults.length).toBeGreaterThan(0)

      const byPath = new Map<string, string[]>()
      for (const line of segResults) {
        const cols = line.split('\t')
        const pathName = cols[1]!
        if (!byPath.has(pathName)) {
          byPath.set(pathName, [])
        }
        byPath.get(pathName)!.push(line)
      }

      expect(byPath.size).toBe(4)

      for (const [_pathName, lines] of byPath) {
        for (const line of lines) {
          const cols = line.split('\t')
          const offset = +cols[2]!
          const segLen = +cols[3]!
          expect(offset).toBeGreaterThanOrEqual(0)
          expect(segLen).toBeGreaterThan(0)
        }
      }
    })
  })

  it('filters by assemblies when specified', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      const stats = await gfaToTabix(GFA_FILE, prefix, {
        assemblies: ['ref#1', 'sample1#1'],
      })

      expect(stats.pathCount).toBe(2)
      expect(stats.genomes.sort()).toEqual(['ref#1', 'sample1#1'].sort())

      // Only 2 genomes in segs for segment 0
      const results = querySegsRange(prefix, 0, 0)
      expect(results.length).toBe(2)
    })
  })

  it('includes #sizes header with path lengths', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      const headerOutput = execSync(`zcat "${prefix}.pos.bed.gz" | head -5`, {
        encoding: 'utf8',
      })
      const sizesLine = headerOutput
        .split('\n')
        .find(l => l.startsWith('#sizes='))
      expect(sizesLine).toBeDefined()

      const sizesStr = sizesLine!.replace('#sizes=', '')
      const entries = sizesStr.split(',')
      expect(entries.length).toBe(4)
      for (const entry of entries) {
        const colonIdx = entry.lastIndexOf(':')
        expect(colonIdx).toBeGreaterThan(0)
        const length = +entry.slice(colonIdx + 1)
        expect(length).toBeGreaterThan(0)
      }
    })
  })

  it('generates aln.bed.gz with cs tags from GFA with sequences', async () => {
    const gfaWithSeqs = path.resolve('test_data/volvox/volvox_sample.gfa')
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      const stats = await gfaToTabix(gfaWithSeqs, prefix)

      expect(stats.alnFile).toBeDefined()
      expect(fs.existsSync(`${prefix}.aln.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.aln.bed.gz.tbi`)).toBe(true)

      const results = tabixQuery(`${prefix}.aln.bed.gz`, 'path1#path1:0-1000')
      expect(results.length).toBeGreaterThan(0)

      const cols = results[0]!.split('\t')
      expect(cols.length).toBe(9)
      expect(cols[0]).toBe('path1#path1')
      expect(cols[7]).toMatch(/^[+-]$/)
      expect(cols[8]).toMatch(/:/)
    })
  })

  it('cs tag contains substitution info for divergent segments', async () => {
    const gfaWithSeqs = path.resolve('test_data/volvox/volvox_sample.gfa')
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(gfaWithSeqs, prefix)

      const results = tabixQuery(`${prefix}.aln.bed.gz`, 'path1#path1:0-1000')

      const csStrings = results.map(r => r.split('\t')[8])
      const hasVariant = csStrings.some(
        cs => cs && (cs.includes('*') || cs.includes('+') || cs.includes('-')),
      )
      expect(hasVariant).toBe(true)
    })
  })

  it('chunk size controls pos.bed.gz granularity', async () => {
    await withTmpDir(async dir => {
      const prefix10 = path.join(dir, 'chunk10')
      await gfaToTabix(GFA_FILE, prefix10, { chunkSize: 10 })
      const results10 = tabixQuery(
        `${prefix10}.pos.bed.gz`,
        'ref#1#chr1:0-10000000',
      )

      const prefix100 = path.join(dir, 'chunk100')
      await gfaToTabix(GFA_FILE, prefix100, { chunkSize: 100 })
      const results100 = tabixQuery(
        `${prefix100}.pos.bed.gz`,
        'ref#1#chr1:0-10000000',
      )

      expect(results10.length).toBeGreaterThan(results100.length)
    })
  })
})
