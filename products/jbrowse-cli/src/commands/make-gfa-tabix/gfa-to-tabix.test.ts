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

describe('GFA to tabix conversion', () => {
  it('creates pos.bed.gz and segs.bed.gz with indexes', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      const stats = await gfaToTabix(GFA_FILE, prefix)

      expect(fs.existsSync(`${prefix}.pos.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.pos.bed.gz.tbi`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segs.bed.gz`)).toBe(true)
      expect(fs.existsSync(`${prefix}.segs.bed.gz.tbi`)).toBe(true)

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

      const results = tabixQuery(
        `${prefix}.pos.bed.gz`,
        'ref#1#chr1:0-100000',
      )
      expect(results.length).toBeGreaterThan(0)

      // Each result should have 5 columns
      const cols = results[0]!.split('\t')
      expect(cols.length).toBe(5)
      expect(cols[0]).toBe('ref#1#chr1')
      expect(+cols[1]!).toBeGreaterThanOrEqual(0)
    })
  })

  it('segs.bed.gz can be queried by segment ordinal range', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      // Query first few segments
      const results = tabixQuery(`${prefix}.segs.bed.gz`, 'S:0-5')
      expect(results.length).toBeGreaterThan(0)

      // Each result should have 8 columns
      const cols = results[0]!.split('\t')
      expect(cols.length).toBe(8)
      expect(cols[0]).toBe('S')
    })
  })

  it('pos.bed.gz returns correct segment ordinal ranges', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      const results = tabixQuery(
        `${prefix}.pos.bed.gz`,
        'ref#1#chr1:0-50000',
      )

      for (const line of results) {
        const cols = line.split('\t')
        const minOrd = +cols[3]!
        const maxOrd = +cols[4]!
        expect(minOrd).toBeLessThanOrEqual(maxOrd)
        expect(minOrd).toBeGreaterThanOrEqual(0)
      }
    })
  })

  it('shared segments appear in segs.bed.gz for multiple genomes', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      // Query segment ordinal 0 (first segment, shared by all paths)
      const results = tabixQuery(`${prefix}.segs.bed.gz`, 'S:0-1')
      expect(results.length).toBe(4) // shared by all 4 genomes

      const paths = results.map(r => r.split('\t')[3])
      expect(paths).toContain('ref#1#chr1')
      expect(paths).toContain('sample1#1#chr1')
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

      // Find overall min/max ordinals
      let minOrd = Infinity
      let maxOrd = -Infinity
      for (const line of posResults) {
        const cols = line.split('\t')
        minOrd = Math.min(minOrd, +cols[3]!)
        maxOrd = Math.max(maxOrd, +cols[4]!)
      }

      // Step 2: get all paths for those segments
      const segResults = tabixQuery(
        `${prefix}.segs.bed.gz`,
        `S:${minOrd}-${maxOrd + 1}`,
      )
      expect(segResults.length).toBeGreaterThan(0)

      // Group by path name
      const byPath = new Map<string, string[]>()
      for (const line of segResults) {
        const cols = line.split('\t')
        const pathName = cols[3]!
        if (!byPath.has(pathName)) {
          byPath.set(pathName, [])
        }
        byPath.get(pathName)!.push(line)
      }

      // Should have entries for all 4 genomes
      expect(byPath.size).toBe(4)

      // Each genome should have segments with valid offsets
      for (const [_pathName, lines] of byPath) {
        for (const line of lines) {
          const cols = line.split('\t')
          const offset = +cols[4]!
          const segLen = +cols[5]!
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
      const results = tabixQuery(`${prefix}.segs.bed.gz`, 'S:0-1')
      expect(results.length).toBe(2)
    })
  })

  it('includes #sizes header with path lengths', async () => {
    await withTmpDir(async dir => {
      const prefix = path.join(dir, 'test')
      await gfaToTabix(GFA_FILE, prefix)

      // Read the header from pos.bed.gz
      const headerOutput = execSync(
        `zcat "${prefix}.pos.bed.gz" | head -5`,
        { encoding: 'utf8' },
      )
      const sizesLine = headerOutput
        .split('\n')
        .find(l => l.startsWith('#sizes='))
      expect(sizesLine).toBeDefined()

      // Parse sizes and verify each path has a positive length
      const sizesStr = sizesLine!.replace('#sizes=', '')
      const entries = sizesStr.split(',')
      expect(entries.length).toBe(4) // 4 genomes = 4 paths
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

      // Path names for P-lines without # are duplicated: path1#path1
      const results = tabixQuery(
        `${prefix}.aln.bed.gz`,
        'path1#path1:0-1000',
      )
      expect(results.length).toBeGreaterThan(0)

      // 9 columns: refPath, start, end, queryGenome, queryChrom, qStart, qEnd, strand, cs
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

      const results = tabixQuery(
        `${prefix}.aln.bed.gz`,
        'path1#path1:0-1000',
      )

      // path1 uses s1,s2,s4,s5 and path2 uses s1,s3,s4,s5
      // s2 vs s3 is a bubble — should produce substitution cs ops (*XY)
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

      // Smaller chunks → more pos.bed.gz entries
      expect(results10.length).toBeGreaterThan(results100.length)
    })
  })
})
