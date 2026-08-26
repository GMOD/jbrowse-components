import { assembleRScript, resolveHelpers } from './exportR.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { BROWSER_LOCAL_FILE_REASON } from './rexportLocalFiles.ts'

import type { RTrackFragment } from './types.ts'

/** The R code of a helper: its definition with comment-only lines removed, so
 * a helper merely *named in prose* ("the same primitive pileup_layout uses")
 * isn't mistaken for a call. */
function helperCode(name: string) {
  return HELPERS[name]!.split('\n')
    .filter(line => !/^\s*#/.test(line))
    .join('\n')
}

/** Helpers whose code `name` actually calls. */
function calledHelpers(name: string) {
  return Object.keys(HELPERS).filter(
    other =>
      other !== name && new RegExp(`\\b${other}\\b`).test(helperCode(name)),
  )
}

// The invariant behind HELPER_DEPS: a fragment declares only the helpers its own
// plot code calls, and assembleRScript closes over helper-to-helper calls. If a
// helper gains a call to another one and the edge isn't declared, the emitted
// script references an undefined function — R fails at run time, deep inside a
// generated file. This catches it at build time instead.
test.each(Object.keys(HELPERS))('%s declares the helpers it calls', name => {
  expect([...resolveHelpers([name])]).toEqual(
    expect.arrayContaining(calledHelpers(name)),
  )
})

test('resolveHelpers pulls in transitive calls', () => {
  // read_multibigwig calls read_bigwig; mismatch_fade_alpha calls
  // snp_freq_threshold. A caller declares neither.
  expect(resolveHelpers(['read_multibigwig'])).toEqual(
    new Set(['read_multibigwig', 'read_bigwig']),
  )
  expect(resolveHelpers(['mismatch_fade_alpha'])).toEqual(
    new Set(['mismatch_fade_alpha', 'snp_freq_threshold']),
  )
})

const region = { refName: 'ctgA', start: 0, end: 100 }

function fragment(helpers: string[]): RTrackFragment {
  return {
    trackId: 'track1',
    trackName: 'Track 1',
    packages: ['rtracklayer', 'ggplot2'],
    helpers,
    setup: 'bw <- "volvox.bw"',
    plotVariable: 'p_track1',
    plotExpr: 'ggplot()',
  }
}

test('a fragment gets its helpers definitions, closed over their calls', () => {
  const script = assembleRScript(region, [fragment(['read_multibigwig'])])
  expect(script).toContain('read_multibigwig <- function')
  expect(script).toContain('read_bigwig <- function')
})

test('unreferenced helpers are left out', () => {
  const script = assembleRScript(region, [fragment(['read_bigwig'])])
  expect(script).toContain('read_bigwig <- function')
  expect(script).not.toContain('read_multibigwig <- function')
  expect(script).not.toContain('hic_regions <- function')
})

test('helper defs are emitted once, before the code that calls them', () => {
  const script = assembleRScript(region, [
    fragment(['read_multibigwig']),
    { ...fragment(['read_bigwig']), plotVariable: 'p_track2' },
  ])
  expect(script.match(/^read_bigwig <- function/gm)).toHaveLength(1)
  expect(script.indexOf('read_bigwig <- function')).toBeLessThan(
    script.indexOf('# Data sources'),
  )
})

// The figure height is the sum of the panels' weights, and a multi-wiggle
// weights itself by source count — so a 2504-sample cohort asked ggsave() for
// 5008 inches, which it refuses outright. The script then died at its very last
// line, after every read.
test('the emitted ggsave height stays inside ggplot2 own 50-inch limit', () => {
  const region = { refName: 'chr1', start: 0, end: 1000 }
  const panels = Array.from({ length: 2504 }, (_, i) => ({
    trackId: `t${i}`,
    trackName: `T${i}`,
    packages: [],
    helpers: [],
    setup: `t${i} <- "x.bw"`,
    plotVariable: `p_t${i}`,
    plotExpr: 'ggplot()',
    heightWeight: 2,
  }))
  const script = assembleRScript(region, panels)
  for (const height of script.matchAll(/height = ([\d.]+)/g)) {
    expect(Number(height[1])).toBeLessThanOrEqual(50)
  }
})

// A track the exporter contributed nothing for used to vanish from the figure
// with nothing anywhere saying so — including in the .R the reader keeps.
test('a track with no R panel is named in the script header', () => {
  const script = assembleRScript(
    { refName: 'chr1', start: 0, end: 1000 },
    [
      {
        trackId: 't',
        trackName: 'T',
        packages: [],
        helpers: [],
        setup: 't <- "x.bw"',
        plotVariable: 'p_t',
        plotExpr: 'ggplot()',
      },
    ],
    [{ name: 'UCSC CpG islands', displayType: 'LinearBasicDisplay' }],
  )
  expect(script).toContain('#   - UCSC CpG islands (LinearBasicDisplay)')
  // and it stays inside the header comment block, not glued to the timestamp
  expect(script).not.toMatch(/^# Generated: \S+#/m)
})

// A panel that knows its own size says so in R, where it has read the data —
// so the figure's total height has to be computed there too, not written in as
// a constant the generator could not have known.
describe('a fragment that binds its data', () => {
  const bound = {
    trackId: 'genes',
    trackName: 'Genes',
    packages: [],
    helpers: [],
    setup: 'genes <- "x.gff.gz"',
    plotVariable: 'p_genes',
    dataExpr: 'gene_layout(read_gff(genes))',
    plotExpr: 'ggplot(d_genes)',
    heightWeightExpr: 'max(2, max(c(d_genes$row, 0), na.rm = TRUE) / 4)',
  }
  const region = { refName: 'chr1', start: 0, end: 1000 }

  test('is assigned to d_<name> before its plot', () => {
    const script = assembleRScript(region, [bound])
    expect(script).toContain('  d_genes <- gene_layout(read_gff(genes))')
    expect(script.indexOf('d_genes <-')).toBeLessThan(
      script.indexOf('p_genes <-'),
    )
  })

  test('contributes its height expression to the patchwork heights', () => {
    const script = assembleRScript(region, [bound])
    expect(script).toContain(
      'heights <- c(max(2, max(c(d_genes$row, 0), na.rm = TRUE) / 4))',
    )
    // and the figure height follows from those, in R
    expect(script).toContain('attr(out, "jb_height_in") <-')
    expect(script).toContain('height = fig_height')
    expect(script).not.toMatch(/height = \d+(\.\d+)?,/)
  })

  // The alias wrapper has to go around whichever statement does the READING,
  // which for a bound fragment is the data, not the plot.
  test('a refname-aliased bound fragment resolves chrom around the read', () => {
    const script = assembleRScript(region, [
      { ...bound, refNameMap: { chr1: '1' } },
    ])
    expect(script).toMatch(/d_genes <- local\(\{\n\s+regions\$chrom <-/)
    expect(script).toContain('p_genes <- ggplot(d_genes)')
  })
})

// Text width cannot be measured inside a ggplot, so panels estimate it from the
// figure's pixel width — which has to be the same number the ggsave() at the
// bottom uses, or label decimation silently mis-tunes.
test('the figure geometry is emitted once, as variables', () => {
  const script = assembleRScript({ refName: 'chr1', start: 0, end: 1000 }, [
    {
      trackId: 't',
      trackName: 'T',
      packages: [],
      helpers: [],
      setup: 't <- "x.bw"',
      plotVariable: 'p_t',
      plotExpr: 'ggplot()',
    },
  ])
  expect(script).toContain('fig_width <- 12')
  expect(script).toContain('fig_dpi <- 150')
  expect(script).toContain('fig_width_px <- round(fig_width * fig_dpi * 0.96)')
  expect(script).toContain(
    'width = fig_width, height = fig_height, dpi = fig_dpi',
  )
})

// A track that IS in the figure but was drawn with a setting the export can't
// reproduce — a grouped pileup comes out as one undifferentiated block, and
// nothing said so.
test('a setting the panel could not reproduce is named in the header', () => {
  const script = assembleRScript({ refName: 'chr1', start: 0, end: 1000 }, [
    {
      trackId: 'reads',
      trackName: 'HG002 ONT reads',
      packages: [],
      helpers: [],
      setup: 'reads <- "x.bam"',
      plotVariable: 'p_reads',
      plotExpr: 'ggplot()',
      unreproduced: ['"Group by" tag HP — the pileup is drawn ungrouped'],
    },
  ])
  expect(script).toContain(
    '#   - HG002 ONT reads: "Group by" tag HP — the pileup is drawn ungrouped',
  )
  expect(script).toContain('does not reproduce')
})

test('nothing is said when every setting made it across', () => {
  const script = assembleRScript({ refName: 'chr1', start: 0, end: 1000 }, [
    {
      trackId: 'reads',
      trackName: 'Reads',
      packages: [],
      helpers: [],
      setup: 'reads <- "x.bam"',
      plotVariable: 'p_reads',
      plotExpr: 'ggplot()',
    },
  ])
  expect(script).not.toContain('does not reproduce')
})

// The other silence: a track that isn't in the figure at all. A local file
// opened in jbrowse-web can never be — the browser gives it no path — so the
// header has to say which track, and what to do instead, or the only symptom
// is a figure one panel short.
test('a skipped track carries its reason into the header', () => {
  const script = assembleRScript(
    { refName: 'chr1', start: 0, end: 1000 },
    [fragment([])],
    [
      {
        name: 'My local reads',
        displayType: 'LinearAlignmentsDisplay',
        reason: BROWSER_LOCAL_FILE_REASON,
      },
      { name: 'Something else', displayType: 'LinearFooDisplay' },
    ],
  )
  expect(script).toContain(
    '#   - My local reads (LinearAlignmentsDisplay)\n#       opened from a local file',
  )
  expect(script).toContain('JBrowse Desktop')
  // a reasonless skip still gets its line, and gains nothing else
  expect(script).toContain('#   - Something else (LinearFooDisplay)\n')
  // the reason is wrapped into the comment column, not run off the side
  for (const line of script.split('\n')) {
    expect(line.startsWith('#       ') ? line.length : 0).toBeLessThan(80)
  }
})
