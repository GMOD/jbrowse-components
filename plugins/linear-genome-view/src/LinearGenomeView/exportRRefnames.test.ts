import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from './exportR.ts'

import type { RTrackFragment } from './types.ts'

// A minimal one-panel BigWig fragment, standing in for what a display's
// exportRCode builder returns, plus the refNameMap the view attaches when the
// track's file names contigs differently from the assembly.
function bigwigFragment(uri: string, refNameMap?: Record<string, string>) {
  const frag: RTrackFragment = {
    trackId: 'micro.array',
    trackName: 'Microarray',
    packages: ['rtracklayer', 'ggplot2'],
    helpers: ['read_bigwig', 'bp_axis'],
    setup: `bw <- ${JSON.stringify(uri)}`,
    plotVariable: 'p_bw',
    plotExpr: `{
  df <- read_bigwig(bw, chrom, start, end)
  ggplot(df) +
    geom_col(aes(start, score)) +
    coord_cartesian(xlim = c(start, end)) +
    bp_axis()
}`,
  }
  return refNameMap ? { ...frag, refNameMap } : frag
}

describe('refname alias codegen', () => {
  test('no refNameMap emits no aliasing code', () => {
    const script = assembleRScript({ refName: 'ctgA', start: 0, end: 1000 }, [
      bigwigFragment('x.bw'),
    ])
    expect(script).not.toContain('resolve_chrom')
    expect(script).not.toContain('_refnames')
    // the panel reads chrom directly
    expect(script).toContain('p_bw <- {')
  })

  test('refNameMap emits the helper, per-track vector, and local() wrap', () => {
    const script = assembleRScript({ refName: 'ctgA', start: 0, end: 1000 }, [
      bigwigFragment('x.bw', { ctgA: 'contigA', ctgB: 'contigB' }),
    ])
    expect(script).toContain('resolve_chrom <- function(chrom, aliases)')
    expect(script).toContain(
      'micro_array_refnames <- c(`ctgA` = "contigA", `ctgB` = "contigB")',
    )
    expect(script).toContain(
      'chrom <- resolve_chrom(chrom, micro_array_refnames)',
    )
    // the reader still references the (now-translated) chrom
    expect(script).toContain('read_bigwig(bw, chrom, start, end)')
  })

  test('panels from different tracks each get their own vector', () => {
    const script = assembleRScript({ refName: 'ctgA', start: 0, end: 1000 }, [
      { ...bigwigFragment('a.bw', { ctgA: 'contigA' }), trackId: 'a' },
      { ...bigwigFragment('b.bw', { ctgA: 'chrA' }), trackId: 'b' },
    ])
    expect(script).toContain('a_refnames <- c(`ctgA` = "contigA")')
    expect(script).toContain('b_refnames <- c(`ctgA` = "chrA")')
  })
})

// Only run when R + rtracklayer are installed (skipped in CI). This proves the
// alias mechanism end-to-end: volvox_microarray.altname.bw names its contig
// "contigA", while the view's canonical name is "ctgA" (per the volvox
// refNameAliases). Reading with the canonical name must go through
// resolve_chrom to hit real data.
function haveRtracklayer() {
  const probe = spawnSync(
    'Rscript',
    ['-e', 'cat(requireNamespace("rtracklayer", quietly = TRUE))'],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = haveRtracklayer() ? test : test.skip

maybe('alias translation makes the canonical name read real data', () => {
  const bw = resolve(
    process.cwd(),
    'test_data/volvox/volvox_microarray.altname.bw',
  )
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-alias-'))

  // with the alias map "ctgA" resolves to the file's "contigA" and reads rows
  const withAlias = assembleRScript({ refName: 'ctgA', start: 0, end: 50000 }, [
    bigwigFragment(bw, { ctgA: 'contigA' }),
  ])
  const withPath = join(dir, 'with.R')
  writeFileSync(
    withPath,
    `${withAlias}\ncat("ROWS", nrow(read_bigwig(bw, resolve_chrom("ctgA", micro_array_refnames), 0, 50000)), "\\n")`,
  )
  const withOut = execFileSync('Rscript', [withPath], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  expect(withOut).toMatch(/ROWS 500/)

  // without the map the canonical "ctgA" isn't in the file, so zero rows: this
  // is the failure the alias system fixes
  const noAlias = assembleRScript({ refName: 'ctgA', start: 0, end: 50000 }, [
    bigwigFragment(bw),
  ])
  const noPath = join(dir, 'no.R')
  writeFileSync(
    noPath,
    `${noAlias}\ncat("ROWS", nrow(read_bigwig(bw, "ctgA", 0, 50000)), "\\n")`,
  )
  const noOut = execFileSync('Rscript', [noPath], {
    cwd: dir,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  expect(noOut).toMatch(/ROWS 0/)

  // and the real generated script (which calls plot_region with the canonical
  // name and translates internally via resolve_chrom) runs and draws a figure
  const runScript = readFileSync(withPath, 'utf8')
  expect(runScript).toContain('resolve_chrom(chrom, micro_array_refnames)')
  execFileSync('Rscript', [withPath], { cwd: dir, stdio: 'pipe' })
})
