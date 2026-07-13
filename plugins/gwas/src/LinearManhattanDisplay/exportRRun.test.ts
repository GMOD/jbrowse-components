import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { manhattanFragment } from './exportRCode.ts'

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

function runGwas(name: string, file: string, region: [string, number, number]) {
  const fragment = manhattanFragment({
    trackId: `gwas_${name}`,
    trackName: `GWAS ${name}`,
    uri: resolve(process.cwd(), file),
    scoreColumn: 'neg_log_pvalue',
    color: '#0068d1',
    pointSize: 4,
  })
  const script = assembleRScript(
    { refName: region[0], start: region[1], end: region[2] },
    [fragment],
  )
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-gwas-${name}-`))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  return dir
}

// point-only BED (chromStart, no end column) — the LocusZoom / GWAS summary
// stats layout, position resolved from the tabix index's begin column
maybe('point GWAS BED script runs and produces a figure', () => {
  const dir = runGwas('sle', 'test_data/gwas/SLE_gwas.bed.gz', [
    '2', 191794000, 191900000,
  ])
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)

// BED with an explicit end column and a named score column
maybe('interval GWAS BED script runs and produces a figure', () => {
  const dir = runGwas('volvox', 'test_data/volvox/volvox.gwas.tsv.gz', [
    'ctgA', 0, 50000,
  ])
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)
