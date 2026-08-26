import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { variantFragment } from './exportRCode.ts'

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

function runVcf(name: string, file: string) {
  const fragment = variantFragment({
    trackId: `vcf_${name}`,
    trackName: `Volvox ${name}`,
    uri: resolve(process.cwd(), `test_data/volvox/${file}`),
  })
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 20000 }, [
    fragment,
  ])
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-vcf-${name}-`))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  return dir
}

// SNVs + a sequence indel
maybe(
  'SNV VCF script runs and produces a figure',
  () => {
    const dir = runVcf('snv', 'volvox.filtered.vcf.gz')
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  60000,
)

// symbolic structural variants (<DEL>/<INV>/<INS>) with END-derived spans
maybe(
  'structural-variant VCF script runs and produces a figure',
  () => {
    const dir = runVcf('sv', 'volvox.sv.vcf.gz')
    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
  },
  60000,
)
