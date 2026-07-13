import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { alignmentsFragments } from './exportRCode.ts'

// Only run when R + the Bioconductor alignment stack are installed (skipped in
// CI). Executes the *real* generated script so a codegen change that emits
// invalid or non-running R fails the test.
function rWithAlignmentStack() {
  const probe = spawnSync(
    'Rscript',
    [
      '-e',
      'cat(requireNamespace("GenomicAlignments", quietly = TRUE) && requireNamespace("Rsamtools", quietly = TRUE))',
    ],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithAlignmentStack() ? test : test.skip

maybe('generated alignments R script runs and produces a figure', () => {
  const bam = resolve(process.cwd(), 'test_data/volvox/volvox-sorted.bam')
  const fragments = alignmentsFragments({
    trackId: 'aln',
    trackName: 'Volvox reads',
    uri: bam,
    showCoverage: true,
    showPileup: true,
  })
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 5000 }, fragments)

  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-bam-'))
  const scriptPath = join(dir, 'view.R')
  writeFileSync(scriptPath, script)

  execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })

  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 90000)
