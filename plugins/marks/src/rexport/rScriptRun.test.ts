import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { frameFor, helpersFor, sourceNotes } from './frameFor.ts'
import { fieldsRead, markPlot } from './markToPlot.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { assembleRScript, resolveHelpers } from './rScript.ts'
import { frameChain } from './rplot.ts'

import type { DisplaySpec } from './markToPlot.ts'
import type { Region } from './rScript.ts'

/**
 * Codegen string checks miss the bugs that matter — a script that exits 0 and
 * draws the wrong picture. These run the real emitted script through Rscript
 * and then ask R what it read, which is the technique
 * agent-docs/reference/R_EXPORT.md §Verification describes.
 */
/** Every package an emitted script can load, so the skip is as wide as the suite. */
const PACKAGES = [
  'rtracklayer',
  'GenomicRanges',
  'IRanges',
  'Rsamtools',
  'ggplot2',
  'patchwork',
]

const R = hasR()
const BIGWIG = path.resolve('test_data/volvox/volvox.bw')
const GFF = path.resolve('test_data/volvox/volvox.sort.gff3.gz')
const VCF = path.resolve('test_data/volvox/volvox.filtered.vcf.gz')

function hasR() {
  try {
    execFileSync(
      'Rscript',
      ['-e', PACKAGES.map(p => `library(${p})`).join('; ')],
      { stdio: 'ignore' },
    )
    return true
  } catch {
    return false
  }
}

/**
 * Rscript, with a failure reported as R's own last lines rather than the
 * library-loading noise every Bioconductor session prints first.
 */
function rscript(file: string) {
  try {
    return execFileSync('Rscript', [file], {
      cwd: path.dirname(file),
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim()
  } catch (e) {
    const lines = String((e as { stderr?: string }).stderr ?? '')
      .trim()
      .split('\n')
    const at = lines.findLastIndex(l => l.startsWith('Error'))
    throw new Error(
      `${file} failed:\n${lines.slice(Math.max(0, at), at + 12).join('\n')}`,
      { cause: e },
    )
  }
}

function runR(source: string, name: string) {
  const dir = mkdtempSync(path.join(tmpdir(), 'rexport-'))
  const script = path.join(dir, `${name}.R`)
  const out = path.join(dir, `${name}.png`)
  writeFileSync(script, source.replace('figure.png', out))
  rscript(script)
  return out
}

interface Build {
  display: DisplaySpec
  type: 'BigWigAdapter' | 'Gff3TabixAdapter' | 'VcfTabixAdapter'
  uri: string
  regions: Region[]
}

function translate({ display, type, uri, regions }: Build) {
  const f = frameFor({ type, uri, fields: fieldsRead(display) })
  const { plot, notes } = markPlot({ display, frame: f, regions })
  return { plot, notes: [...sourceNotes(uri), ...notes] }
}

function build(b: Build) {
  const { plot, notes } = translate(b)
  return assembleRScript({
    regions: b.regions,
    panels: [{ variable: 'p1', plot, helpers: helpersFor(b.type) }],
    notes,
  })
}

/**
 * The frame a display's first mark reads, built by R, and then `body` over
 * it: the transform stage asked what it produced rather than whether a
 * picture came out.
 */
function probeFrame(b: Build, body: string) {
  const { plot } = translate(b)
  const frames = frameChain(plot.layers[0]!.frame)
  const script = assembleRScript({
    regions: b.regions,
    panels: [{ variable: 'p1', plot, helpers: helpersFor(b.type) }],
  })
  const head = script.slice(0, script.indexOf('p1 <- ggplot'))
  const dir = mkdtempSync(path.join(tmpdir(), 'rexport-frame-'))
  const file = path.join(dir, 'frame.R')
  writeFileSync(file, `${head}\n${body}\n`)
  return { out: rscript(file), frame: frames.at(-1)! }
}

const maybe = R ? describe : describe.skip

maybe('the emitted script runs', () => {
  it('draws a BigWig bar panel', () => {
    const source = build({
      display: {
        marks: [{ mark: 'bar', encoding: { y: 'score', color: 'steelblue' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'bigwig'))).toBe(true)
  })

  it('draws a colour ramp over the same data', () => {
    const source = build({
      display: {
        marks: [
          {
            mark: 'bar',
            encoding: {
              y: 'score',
              color: { field: 'score', scale: 'linear', scheme: 'viridis' },
            },
          },
        ],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'ramp'))).toBe(true)
  })

  it('spans two regions on one cumulative axis', () => {
    const source = build({
      display: { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [
        { refName: 'ctgA', start: 0, end: 2000 },
        { refName: 'ctgA', start: 20000, end: 22000 },
      ],
    })
    expect(existsSync(runR(source, 'multi'))).toBe(true)
  })

  it('stacks GFF features as spans on their rows', () => {
    const source = build({
      display: {
        transform: [{ type: 'pileup' }],
        marks: [
          {
            mark: 'span',
            encoding: {
              row: 'row',
              color: {
                field: 'strand',
                domain: ['+', '-'],
                range: ['blue', 'red'],
              },
            },
          },
        ],
      },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    expect(existsSync(runR(source, 'gffspans'))).toBe(true)
  })

  it('draws a threshold scale over real data', () => {
    const source = build({
      display: {
        marks: [
          {
            mark: 'point',
            encoding: {
              y: 'score',
              color: {
                field: 'score',
                scale: 'threshold',
                domain: ['10', '50'],
                range: ['#357ebd', '#eea236', '#d43f3a'],
              },
            },
          },
        ],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'threshold'))).toBe(true)
  })

  it('gives each mark its own frame when their transforms differ', () => {
    const source = build({
      display: {
        marks: [
          {
            mark: 'bar',
            transform: [
              { type: 'bin', step: 500, field: 'start', as: ['start', 'end'] },
              {
                type: 'aggregate',
                ops: [{ op: 'mean', field: 'score', as: 'binned' }],
              },
            ],
            encoding: { y: 'binned' },
          },
          { mark: 'point', encoding: { y: 'score' } },
        ],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    // the derived frame is its own binding, and the mark without a transform
    // still reads the frame it was derived from
    expect(source).toContain('df_1 <- df')
    expect(source).toContain('data = df')
    expect(existsSync(runR(source, 'twoframes'))).toBe(true)
  })
})

maybe('the transform stage runs', () => {
  it('bins and aggregates a BigWig into one bar per window', () => {
    const source = build({
      display: {
        transform: [
          { type: 'bin', step: 500, field: 'start', as: ['start', 'end'] },
          {
            type: 'aggregate',
            ops: [{ op: 'mean', field: 'score', as: 'meanScore' }],
          },
        ],
        marks: [{ mark: 'bar', encoding: { y: 'meanScore' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(existsSync(runR(source, 'binned'))).toBe(true)
  })

  it('packs GFF features into rows a span mark stands on', () => {
    const source = build({
      display: {
        transform: [{ type: 'pileup', padding: 2 }],
        marks: [{ mark: 'span', encoding: { row: 'row' } }],
      },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    expect(existsSync(runR(source, 'pileup'))).toBe(true)
  })
})

/**
 * What the figure claims, checked against R rather than against the emitter.
 * A probe calls one helper and asserts a fact about the data, so a reader that
 * silently returns the wrong window fails here rather than in a picture.
 */
maybe('the readers agree with the file', () => {
  const probe = (needs: string[], body: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rexport-probe-'))
    const script = path.join(dir, 'probe.R')
    const defs = resolveHelpers(needs)
      .map(h => HELPERS[h])
      .join('\n\n')
    writeFileSync(
      script,
      `suppressMessages({library(rtracklayer); library(GenomicRanges); library(IRanges)})\n${defs}\n${body}\n`,
    )
    return rscript(script)
  }

  it('hands back 0-based half-open bins that abut', () => {
    const gaps = probe(
      ['read_bigwig'],
      `
df <- read_bigwig(${JSON.stringify(BIGWIG)}, "ctgA", 0, 5000)
df <- df[order(df$start), ]
cat(sum(df$start[-1] != head(df$end, -1)))
`,
    )
    expect(gaps).toBe('0')
  })

  /**
   * Each reader converts rtracklayer's 1-based inclusive coordinates to the
   * repo's 0-based half-open, and a sabotage sweep found every one of these
   * mutations green before these probes existed. The doc calls that seam the
   * bug that cost a wrong figure.
   */
  it('reads GFF features at the coordinates the file states', () => {
    const out = probe(
      ['read_gff'],
      `
df <- read_gff(${JSON.stringify(GFF)}, "ctgA", 0, 50000)
g <- df[df$type == "gene", ]
cat(min(g$start), max(g$end))
`,
    )
    const [start, end] = out.split(' ').map(Number)
    // volvox's first gene starts at 1049 0-based; a lost conversion reads 1050
    expect(start).toBe(1049)
    expect(end).toBeLessThanOrEqual(50000)
  })

  it('shifts and clips a region onto the cumulative axis', () => {
    const out = probe(
      ['read_regions', 'read_bigwig'],
      `
regions <- region_layout(data.frame(
  chrom = c("ctgA", "ctgA"), start = c(0, 20000), end = c(2000, 22000)))
df <- read_regions(
  function(chrom, start, end) read_bigwig(${JSON.stringify(BIGWIG)}, chrom, start, end),
  regions, c("start", "end"))
cat(min(df$start), max(df$end), max(regions$cum_end))
`,
    )
    const [lo, hi, cumEnd] = out.split(' ').map(Number)
    // the second region lands beside the first, not at its genomic 20000
    expect(lo).toBe(0)
    expect(hi).toBeLessThanOrEqual(cumEnd!)
    expect(hi).toBeLessThan(20000)
  })

  it('packs a pileup into rows that do not overlap', () => {
    const out = probe(
      ['read_gff'],
      `
df <- read_gff(${JSON.stringify(GFF)}, "ctgA", 0, 50000)
df$row <- IRanges::disjointBins(IRanges(df$start + 1L, df$end)) - 1L
bad <- 0
for (r in unique(df$row)) {
  g <- df[df$row == r, ]
  g <- g[order(g$start), ]
  if (nrow(g) > 1) bad <- bad + sum(head(g$end, -1) > g$start[-1])
}
cat(bad, min(df$row))
`,
    )
    expect(out).toBe('0 0')
  })

  it('reads the window it was asked for, not one shifted by a base', () => {
    const first = probe(
      ['read_bigwig'],
      `
df <- read_bigwig(${JSON.stringify(BIGWIG)}, "ctgA", 100, 200)
cat(min(df$start), max(df$end))
`,
    )
    const [start, end] = first.split(' ').map(Number)
    expect(start).toBeGreaterThanOrEqual(100)
    expect(end).toBeLessThanOrEqual(200)
  })
})

maybe('the fields the display names reach R', () => {
  it('colours GFF spans by an attribute the file carries', () => {
    const source = build({
      display: {
        transform: [{ type: 'pileup' }],
        marks: [
          { mark: 'span', encoding: { row: 'row', color: { field: 'Note' } } },
        ],
      },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    expect(source).toContain('attrs = c("Note")')
    expect(existsSync(runR(source, 'gffattr'))).toBe(true)
  })

  it('plots a VCF INFO field on the value axis', () => {
    const source = build({
      display: {
        marks: [
          {
            mark: 'point',
            encoding: {
              y: 'INFO.DP',
              color: { field: 'QUAL', scale: 'linear', scheme: 'viridis' },
            },
          },
        ],
      },
      type: 'VcfTabixAdapter',
      uri: VCF,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    expect(source).toContain('info = c("DP")')
    expect(existsSync(runR(source, 'vcfinfo'))).toBe(true)
  })
})

maybe('the display-level settings run', () => {
  it('packs each facet section on its own rows', () => {
    const { out } = probeFrame(
      {
        display: {
          facet: { field: 'type', transform: [{ type: 'pileup' }] },
          marks: [{ mark: 'span', encoding: { row: 'row' } }],
        },
        type: 'Gff3TabixAdapter',
        uri: GFF,
        regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
      },
      `firsts <- tapply(df$row, df$type, min)
cat(length(firsts), sum(firsts == 0))`,
    )
    const [sections, fromZero] = out.split(' ').map(Number)
    expect(sections).toBeGreaterThan(1)
    expect(fromZero).toBe(sections)
  })

  it('keeps an aggregate group whose key is missing', () => {
    const { out } = probeFrame(
      {
        display: {
          transform: [
            { type: 'aggregate', groupby: ['Note'], ops: [{ op: 'count' }] },
          ],
          marks: [{ mark: 'bar', encoding: { y: 'count' } }],
        },
        type: 'Gff3TabixAdapter',
        uri: GFF,
        regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
      },
      `cat(sum(is.na(df$Note)), sum(df$count))`,
    )
    const [naGroups, total] = out.split(' ').map(Number)
    // the features without a Note fold into one group rather than vanishing
    expect(naGroups).toBe(1)
    expect(total).toBeGreaterThan(100)
  })

  it('draws rows as panels, rules as lines, and a log axis floored by the data', () => {
    const source = build({
      display: {
        rows: 'strand',
        scales: {
          y: {
            type: 'log',
            domainMin: 0,
            rules: [{ value: 20, label: 'twenty' }],
          },
        },
        marks: [{ mark: 'point', encoding: { y: 'score' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 5000 }],
    })
    expect(source).toContain('facet_wrap(~strand')
    expect(source).toContain('geom_hline(yintercept = 20')
    expect(existsSync(runR(source, 'rowsrules'))).toBe(true)
  })

  it('follows the figure width with an auto bin', () => {
    const source = build({
      display: {
        transform: [
          { type: 'bin', step: 'auto' },
          { type: 'aggregate', ops: [{ op: 'mean', field: 'score' }] },
        ],
        marks: [{ mark: 'bar', encoding: { y: 'mean_score' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
    })
    // 50 kb over 1500 px is 33 bp/px, four of which snap up to 200
    expect(source).toContain('/ 200)')
    expect(existsSync(runR(source, 'autobin'))).toBe(true)
  })
})

maybe('the readers answer the fields they were asked for', () => {
  const probe = (needs: string[], body: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'rexport-probe-'))
    const script = path.join(dir, 'probe.R')
    const defs = resolveHelpers(needs)
      .map(h => HELPERS[h])
      .join('\n\n')
    writeFileSync(
      script,
      `suppressMessages({library(rtracklayer); library(GenomicRanges); library(IRanges); library(Rsamtools)})\n${defs}\n${body}\n`,
    )
    return rscript(script)
  }

  it('matches a GFF attribute without regard to case and types a numeric one', () => {
    const out = probe(
      ['read_gff'],
      `
df <- read_gff(${JSON.stringify(GFF)}, "ctgA", 0, 50000, attrs = c("note", "Index", "absent"))
cat(sum(!is.na(df$note)), is.numeric(df$Index), all(is.na(df$absent)), is.numeric(df$score))
`,
    )
    const [notes, indexNumeric, absentNa, scoreNumeric] = out.split(' ')
    expect(Number(notes)).toBeGreaterThan(0)
    expect(indexNumeric).toBe('TRUE')
    expect(absentNa).toBe('TRUE')
    expect(scoreNumeric).toBe('TRUE')
  })

  it('reads a VCF INFO key as a typed column under its dotted name', () => {
    const out = probe(
      ['read_vcf'],
      `
df <- read_vcf(${JSON.stringify(VCF)}, "ctgA", 0, 1000, info = c("DP"))
cat(df$start[1], df[["INFO.DP"]][1], is.numeric(df[["INFO.DP"]]), df$QUAL[1])
`,
    )
    // the first record sits at POS 277 with DP=3 and QUAL 10.4
    expect(out).toBe('276 3 TRUE 10.4')
  })

  it('survives a feature whose end precedes its start', () => {
    const out = probe(
      [],
      `
df <- data.frame(start = c(10, 50), end = c(5, 60))
df$row <- IRanges::disjointBins(IRanges(df$start + 1L, pmax(df$end, df$start))) - 1L
cat(df$row)
`,
    )
    expect(out).toBe('0 0')
  })
})
