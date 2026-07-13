import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { hicFragment } from './exportRCode.ts'

// Only run when R + strawr are actually installed (skipped in CI). This executes
// the *real* generated script so a codegen change that emits invalid or
// non-running R fails the test.
function rWithStrawr() {
  const probe = spawnSync(
    'Rscript',
    ['-e', 'cat(requireNamespace("strawr", quietly = TRUE))'],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithStrawr() ? test : test.skip

// extra_test_data/test.hic is an hg19 map (chroms "1".."22","X","Y","MT") with
// resolutions 2500000 and 100000.
maybe('Hi-C script runs and produces a figure', () => {
  const fragment = hicFragment({
    trackId: 'test_hic',
    trackName: 'Test Hi-C',
    uri: resolve(process.cwd(), 'extra_test_data/test.hic'),
    binsize: 100000,
    norm: 'NONE',
    useLogScale: true,
  })
  const script = assembleRScript({ refName: '1', start: 0, end: 5000000 }, [
    fragment,
  ])
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-hic-'))
  writeFileSync(join(dir, 'view.R'), script)
  execFileSync('Rscript', [join(dir, 'view.R')], { cwd: dir, stdio: 'pipe' })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)
