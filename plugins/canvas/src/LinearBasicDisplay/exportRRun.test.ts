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

function runsToFigure(uri: string, format: 'gff' | 'bed') {
  const fragment = geneFragment({
    trackId: 'genes',
    trackName: 'Volvox genes',
    uri: resolve(process.cwd(), uri),
    format,
  })
  const script = assembleRScript({ refName: 'ctgA', start: 1000, end: 9000 }, [
    fragment,
  ])
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-${format}-`))
  const scriptPath = join(dir, 'view.R')
  writeFileSync(scriptPath, script)
  execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })
  return existsSync(join(dir, 'jbrowse_region.png'))
}

maybe(
  'generated GFF3 gene-track R script runs and produces a figure',
  () => {
    expect(runsToFigure('test_data/volvox/volvox.sort.gff3.gz', 'gff')).toBe(
      true,
    )
  },
  60000,
)

maybe(
  'generated BED12 gene-track R script runs and produces a figure',
  () => {
    expect(runsToFigure('test_data/volvox/volvox-bed12.bed.gz', 'bed')).toBe(
      true,
    )
  },
  60000,
)
