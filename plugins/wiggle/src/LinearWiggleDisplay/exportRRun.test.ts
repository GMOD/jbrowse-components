import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { wiggleFragment } from './exportRCode.ts'

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

maybe(
  'generated R script runs and produces a figure',
  () => {
    const bw = resolve(process.cwd(), 'test_data/volvox/volvox.bw')
    const fragment = wiggleFragment({
      trackId: 'volvox',
      trackName: 'Volvox microarray',
      uri: bw,
      isDensity: false,
      isLine: false,
      useBicolor: false,
      color: '#2166ac',
      posColor: 'blue',
      negColor: 'red',
      bicolorPivot: 0,
    })
    const script = assembleRScript({ refName: 'ctgA', start: 0, end: 50000 }, [
      fragment,
    ])

    const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-'))
    const scriptPath = join(dir, 'view.R')
    // append a loop to prove plot_region() is reusable across regions
    writeFileSync(
      scriptPath,
      `${script}
for (r in list(c(0, 10000), c(14000, 20000))) {
  pr <- plot_region("ctgA", r[1], r[2])
  ggsave(sprintf("loop_%d.png", r[1]), pr, width = 8, height = 3, dpi = 72)
}
`,
    )

    // cwd = temp dir so the script's ggsave() outputs land there
    execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })

    expect(existsSync(join(dir, 'jbrowse_region.png'))).toBe(true)
    expect(existsSync(join(dir, 'loop_0.png'))).toBe(true)
    expect(existsSync(join(dir, 'loop_14000.png'))).toBe(true)
  },
  60000,
)
