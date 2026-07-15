import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { variantMatrixFragment } from './exportRCode.ts'

// Only run when R + Rsamtools are actually installed (skipped in CI). This
// executes the *real* generated script so a codegen change that emits invalid
// or non-running R fails the test.
function rWithRsamtools() {
  const probe = spawnSync(
    'Rscript',
    ['-e', 'cat(requireNamespace("Rsamtools", quietly = TRUE))'],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithRsamtools() ? test : test.skip

function runMatrix(
  name: string,
  file: string,
  region: { refName: string; start: number; end: number },
  opts?: { minMaf?: number; maxMissing?: number; phased?: boolean },
) {
  const fragment = variantMatrixFragment({
    trackId: `vcf_${name}`,
    trackName: `Volvox ${name}`,
    uri: resolve(process.cwd(), `test_data/volvox/${file}`),
    minMaf: opts?.minMaf ?? 0,
    maxMissing: opts?.maxMissing ?? 1,
    phased: opts?.phased ?? false,
  })
  const script = assembleRScript(region, [fragment])
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-vmatrix-${name}-`))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  return dir
}

// 1094-sample phased 1000G simulation (FORMAT is GT:AP, diploid) — exercises the
// FORMAT GT-subfield locator and the many-sample hclust/dendrogram path
maybe(
  '1094-sample matrix script runs and produces a figure',
  () => {
    const dir = runMatrix('test', 'volvox.test.vcf.gz', {
      refName: 'contigA',
      start: 3000,
      end: 12738,
    })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  120000,
)

// phased mode on the diploid 1094-sample panel: samples expand to HP0/HP1
// haplotype rows, exercising the per-haplotype single-allele classing branch
maybe(
  '1094-sample phased matrix script runs and produces a figure',
  () => {
    const dir = runMatrix(
      'test_phased',
      'volvox.test.vcf.gz',
      { refName: 'contigA', start: 3000, end: 12738 },
      { phased: true },
    )
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  120000,
)

// 50-sample haploid VCF (FORMAT is bare GT) with a MAF floor applied, so the
// site-filter branch and the small-y-label path both execute
maybe(
  '50-sample matrix with a MAF filter runs and produces a figure',
  () => {
    const dir = runMatrix(
      'variants',
      'volvox.variants.vcf.gz',
      { refName: 'ref#0#ctgA', start: 0, end: 50000 },
      { minMaf: 0.05, maxMissing: 0.9 },
    )
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  120000,
)
