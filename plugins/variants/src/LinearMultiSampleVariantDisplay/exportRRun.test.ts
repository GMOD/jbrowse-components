import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { variantRowFragment } from './exportRCode.ts'

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

function runRows(
  name: string,
  file: string,
  region: { refName: string; start: number; end: number },
  opts?: { phased?: boolean },
) {
  const fragment = variantRowFragment({
    trackId: `vcf_${name}`,
    trackName: `Volvox ${name}`,
    uri: resolve(process.cwd(), `test_data/volvox/${file}`),
    minMaf: 0,
    maxMissing: 1,
    phased: opts?.phased ?? false,
  })
  const script = assembleRScript(region, [fragment])
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-vrows-${name}-`))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  return dir
}

// 20-sample symbolic SVs (<DEL>/<INV>/<INS>) — exercises the INFO END span path
// (each variant a genomic-width rect) and per-sample y labels
maybe(
  '20-sample SV row display runs and produces a figure',
  () => {
    const dir = runRows('sv', 'volvox.sv.vcf.gz', {
      refName: 'ctgA',
      start: 1000,
      end: 24000,
    })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  120000,
)

// 1094-sample panel — exercises the many-sample y-label-hidden path
maybe(
  '1094-sample row display runs and produces a figure',
  () => {
    const dir = runRows('test', 'volvox.test.vcf.gz', {
      refName: 'contigA',
      start: 3000,
      end: 12738,
    })
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  120000,
)

// phased mode: the diploid panel expands to HP0/HP1 haplotype rows (2188 rows),
// exercising the per-haplotype single-allele classing at genomic position
maybe(
  '1094-sample phased row display runs and produces a figure',
  () => {
    const dir = runRows(
      'test_phased',
      'volvox.test.vcf.gz',
      { refName: 'contigA', start: 3000, end: 12738 },
      { phased: true },
    )
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  120000,
)
