/**
 * Tests for GfaTabixAdapter.getMultiPairFeatures with HPRC-style naming where
 * haplotype contigs use different chromosome names from the reference.
 *
 * Root cause verified: synteny_build previously grouped paths by path_chrom()
 * (the last #-delimited token), so HG00438#1#JAHBCB010000023.1 landed in group
 * "JAHBCB010000023.1" and never got aligned against GRCh38#0#chr20.  Only
 * CHM13#0#chr20 shared the "chr20" bucket, which is why the browser showed only
 * one row.  The fix iterates all hap paths against each ref path using shared
 * graph ordinals (align_pair already handled cross-chrom correctly).
 */
import { execSync } from 'child_process'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import Adapter from '../GfaTabixAdapter.ts'
import configSchema from '../configSchema.ts'

const TOOL = path.resolve(
  __dirname,
  '../../../../../tools/gfa-to-tabix/target/release/gfa-to-tabix',
)

// Minimal GFA that mimics HPRC naming:
//   ref  GRCh38#0#chr20  — three segments
//   hap1 CHM13#0#chr20   — same chrom name (was already working)
//   hap2 HG00438#1#JAHBCB010000023.1 — different chrom name (was broken)
const CROSS_CHROM_GFA = `\
H\tVN:Z:1.1
S\t1\tAAAA\tLN:i:4
S\t2\tCCCC\tLN:i:4
S\t3\tGGGG\tLN:i:4
P\tGRCh38#0#chr20\t1+,2+,3+\t4M,4M,4M
P\tCHM13#0#chr20\t1+,2+,3+\t4M,4M,4M
P\tHG00438#1#JAHBCB010000023.1\t1+,2+,3+\t4M,4M,4M
`

let tmpDir: string
let prefix: string

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'jest-multisyn-'))
  prefix = path.join(tmpDir, 'fixture')
  const gfaPath = `${prefix}.gfa`
  writeFileSync(gfaPath, CROSS_CHROM_GFA)
  execSync(`${TOOL} ${gfaPath} ${prefix}`, { stdio: 'pipe' })
})

function makeAdapter() {
  return new Adapter(
    configSchema.create({
      posLocation: {
        localPath: `${prefix}.pos.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      posIndex: {
        location: {
          localPath: `${prefix}.pos.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      syntenyLocation: {
        localPath: `${prefix}.synteny.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      syntenyIndex: {
        location: {
          localPath: `${prefix}.synteny.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
}

const refRegion = {
  refName: 'chr20',
  assemblyName: 'GRCh38#0',
  start: 0,
  end: 12,
}

test('sources_includes_all_three_assemblies', async () => {
  const adapter = makeAdapter()
  const sources = await adapter.getSources()
  const names = sources.map(s => s.name)
  console.log('[test] sources:', JSON.stringify(names))
  expect(names).toContain('CHM13#0')
  expect(names).toContain('HG00438#1')
  expect(names).toContain('GRCh38#0')
})

test('getMultiPairFeatures_returns_both_haplotypes', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(refRegion)
  const genomes = [...genomeRows.keys()]
  console.log('[test] genomeRows genomes:', JSON.stringify(genomes))
  for (const [genome, features] of genomeRows) {
    console.log(`[test]   ${genome}: ${features.length} features`)
  }
  // CHM13 was already working (same chrom name as ref)
  expect(genomeRows.has('CHM13#0')).toBe(true)
  // HG00438 was broken (different chrom name); the fix must surface it
  expect(genomeRows.has('HG00438#1')).toBe(true)
  // Each should have at least one feature
  expect(genomeRows.get('CHM13#0')!.length).toBeGreaterThan(0)
  expect(genomeRows.get('HG00438#1')!.length).toBeGreaterThan(0)
})

test('getMultiPairFeatures_features_in_region', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(refRegion)
  for (const [, features] of genomeRows) {
    for (const f of features) {
      // Ref coords must overlap the query region
      expect(f.end).toBeGreaterThan(refRegion.start)
      expect(f.start).toBeLessThan(refRegion.end)
    }
  }
})
