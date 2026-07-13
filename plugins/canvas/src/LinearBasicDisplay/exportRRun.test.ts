import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { geneFragment } from './exportRCode.ts'

// Only run when R + rtracklayer are installed (skipped in CI). Executes the
// *real* generated script so a codegen change that emits invalid or
// non-running R fails the test.
function rWithRtracklayer() {
  const probe = spawnSync(
    'Rscript',
    ['-e', 'cat(requireNamespace("rtracklayer", quietly = TRUE))'],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithRtracklayer() ? test : test.skip

maybe('generated gene-track R script runs and produces a figure', () => {
  const gff = resolve(process.cwd(), 'test_data/volvox/volvox.sort.gff3.gz')
  const fragment = geneFragment({
    trackId: 'genes',
    trackName: 'Volvox genes',
    uri: gff,
  })
  const script = assembleRScript(
    { refName: 'ctgA', start: 1000, end: 9000 },
    [fragment],
  )

  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-gff-'))
  const scriptPath = join(dir, 'view.R')
  writeFileSync(scriptPath, script)

  execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })

  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)
