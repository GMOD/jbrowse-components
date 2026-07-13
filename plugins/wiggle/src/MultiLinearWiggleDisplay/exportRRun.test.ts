import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { multiWiggleFragment } from './exportRCode.ts'

import type { MultiWiggleRParams } from './exportRCode.ts'

// Only run when R + rtracklayer are actually installed (skipped in CI). This
// executes the *real* generated script so a codegen change that emits invalid
// or non-running R fails the test.
function rWithRtracklayer() {
  const probe = spawnSync(
    'Rscript',
    ['-e', 'cat(requireNamespace("rtracklayer", quietly = TRUE))'],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithRtracklayer() ? test : test.skip

function sources(): MultiWiggleRParams['sources'] {
  return [1, 2, 3, 4].map(i => ({
    name: `rep${i}`,
    uri: resolve(process.cwd(), `test_data/volvox/posneg_rw${i}.bw`),
    color: ['#e6194b', '#3cb44b', '#4363d8', '#f58231'][i - 1]!,
  }))
}

function runFragment(name: string, params: MultiWiggleRParams) {
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 50000 }, [
    multiWiggleFragment(params),
  ])
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-${name}-`))
  const scriptPath = join(dir, 'view.R')
  writeFileSync(scriptPath, script)
  execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })
  return dir
}

const base: MultiWiggleRParams = {
  trackId: 'volvox_multi',
  trackName: 'Volvox replicates',
  sources: sources(),
  renderingType: 'multirowxy',
  isOverlay: false,
}

maybe('multi-row XY script runs and produces a figure', () => {
  const dir = runFragment('rowxy', base)
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)

maybe('overlay line script runs', () => {
  const dir = runFragment('overlay', {
    ...base,
    renderingType: 'multiline',
    isOverlay: true,
  })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)

maybe('density heatmap script runs', () => {
  const dir = runFragment('density', {
    ...base,
    renderingType: 'multirowdensity',
  })
  expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
}, 60000)
