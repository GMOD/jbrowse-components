import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { frameFor, sourceNotes } from './frameFor.ts'
import { fieldsRead, markPlot } from './markToPlot.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { assembleRScript, helpersIn } from './rScript.ts'
import { rStr } from './rplot.ts'

import type { DisplaySpec } from './markToPlot.ts'
import type { Region } from './rScript.ts'

/**
 * Codegen string checks miss the bugs that matter — a script that exits 0 and
 * draws the wrong picture. These run the real emitted script through Rscript
 * and then ask R what it read, which is the technique
 * agent-docs/reference/R_EXPORT.md §Verification describes.
 *
 * One R session runs every case: attaching Bioconductor takes ~25 s, and a
 * session per case made this suite a seven-minute gate. Each case registers at
 * module load, `beforeAll` runs them all, and each test reads its own result.
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

const DIR = mkdtempSync(path.join(tmpdir(), 'rexport-'))
const CASES = path.join(DIR, 'cases')
mkdirSync(CASES)
const registered = new Set<string>()
const results = new Map<string, { error: string; out: string }>()

function register(name: string, source: string) {
  if (registered.has(name)) {
    throw new Error(`two cases named ${name}`)
  }
  registered.add(name)
  writeFileSync(path.join(CASES, `${name}.R`), source)
  return name
}

function runAll() {
  const runner = path.join(DIR, 'run.R')
  writeFileSync(
    runner,
    `suppressPackageStartupMessages({ ${PACKAGES.map(p => `library(${p})`).join('; ')} })
for (f in list.files(${rStr(CASES)}, pattern = "\\\\.R$", full.names = TRUE)) {
  name <- sub("\\\\.R$", "", basename(f))
  out <- file(file.path(dirname(f), paste0(name, ".out")), "w")
  sink(out)
  error <- tryCatch({ source(f, local = new.env()); "" },
    error = function(e) paste(conditionMessage(e), deparse1(conditionCall(e)), sep = "\\n  in "))
  sink()
  close(out)
  writeLines(error, file.path(dirname(f), paste0(name, ".err")))
}
`,
  )
  execFileSync('Rscript', [runner], { stdio: 'pipe', encoding: 'utf8' })
  for (const name of registered) {
    const read = (ext: string) =>
      readFileSync(path.join(CASES, `${name}.${ext}`), 'utf8').trim()
    results.set(name, { error: read('err'), out: read('out') })
  }
}

/** What the case printed, or the R error it died with. */
function ran(name: string) {
  const r = results.get(name)
  if (!r) {
    throw new Error(`${name} never ran`)
  }
  if (r.error) {
    throw new Error(`${name}.R failed: ${r.error}`)
  }
  return r.out
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

function build(b: Build, out: string) {
  const { plot, notes } = translate(b)
  return assembleRScript({
    regions: b.regions,
    panels: [{ variable: 'p1', plot }],
    notes,
    out,
  })
}

/** A whole emitted script, saving its figure beside the cases. */
function figure(name: string, b: Build) {
  const png = path.join(CASES, `${name}.png`)
  const source = build(b, png)
  return { name: register(name, source), png, source }
}

/**
 * The frame a display's first mark reads, built by R, and then `body` over
 * it: the transform stage asked what it produced rather than whether a
 * picture came out.
 */
function frameProbe(name: string, b: Build, body: string) {
  const { plot } = translate(b)
  const script = assembleRScript({
    regions: b.regions,
    panels: [{ variable: 'p1', plot }],
  })
  const head = script.slice(0, script.indexOf('p1 <- ggplot'))
  return register(name, `${head}\n${body}\n`)
}

/** One helper called by hand, and a fact about the file asserted over it. */
function helperProbe(name: string, body: string) {
  const defs = helpersIn(body)
    .map(h => HELPERS[h])
    .join('\n\n')
  return register(name, `${defs}\n${body}\n`)
}

const maybe = R ? describe : describe.skip

beforeAll(() => {
  if (R) {
    runAll()
  }
}, 600_000)

const ONE_REGION = [{ refName: 'ctgA', start: 0, end: 5000 }]

maybe('the emitted script runs', () => {
  const bigwig = figure('bigwig', {
    display: {
      marks: [{ mark: 'bar', encoding: { y: 'score', color: 'steelblue' } }],
    },
    type: 'BigWigAdapter',
    uri: BIGWIG,
    regions: ONE_REGION,
  })
  it('draws a BigWig bar panel', () => {
    ran(bigwig.name)
    expect(existsSync(bigwig.png)).toBe(true)
  })

  const ramp = figure('ramp', {
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
    regions: ONE_REGION,
  })
  it('draws a colour ramp over the same data', () => {
    ran(ramp.name)
    expect(existsSync(ramp.png)).toBe(true)
  })

  const multi = figure('multi', {
    display: { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
    type: 'BigWigAdapter',
    uri: BIGWIG,
    regions: [
      { refName: 'ctgA', start: 0, end: 2000 },
      { refName: 'ctgA', start: 20000, end: 22000 },
    ],
  })
  it('spans two regions on one cumulative axis', () => {
    ran(multi.name)
    expect(existsSync(multi.png)).toBe(true)
  })

  const gffspans = figure('gffspans', {
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
  it('stacks GFF features as spans on their rows', () => {
    ran(gffspans.name)
    expect(existsSync(gffspans.png)).toBe(true)
  })

  const threshold = figure('threshold', {
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
    regions: ONE_REGION,
  })
  it('draws a threshold scale over real data', () => {
    ran(threshold.name)
    expect(existsSync(threshold.png)).toBe(true)
  })

  const twoframes = figure('twoframes', {
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
    regions: ONE_REGION,
  })
  it('gives each mark its own frame when their transforms differ', () => {
    // the derived frame is its own binding, and the mark without a transform
    // still reads the frame it was derived from
    expect(twoframes.source).toContain('df_1 <- df')
    expect(twoframes.source).toContain('data = df')
    ran(twoframes.name)
    expect(existsSync(twoframes.png)).toBe(true)
  })

  const shapes = figure('shapes', {
    display: {
      marks: [
        {
          mark: 'point',
          encoding: { y: 'QUAL', shape: { field: 'type' } },
        },
      ],
    },
    type: 'VcfTabixAdapter',
    uri: VCF,
    regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
  })
  it('cycles the shape list over a domain the config leaves unlisted', () => {
    expect(shapes.source).toContain('discrete_scale("shape"')
    ran(shapes.name)
    expect(existsSync(shapes.png)).toBe(true)
  })
})

maybe('the transform stage runs', () => {
  const binned = figure('binned', {
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
    regions: ONE_REGION,
  })
  it('bins and aggregates a BigWig into one bar per window', () => {
    ran(binned.name)
    expect(existsSync(binned.png)).toBe(true)
  })

  const pileup = figure('pileup', {
    display: {
      transform: [{ type: 'pileup', padding: 2 }],
      marks: [{ mark: 'span', encoding: { row: 'row' } }],
    },
    type: 'Gff3TabixAdapter',
    uri: GFF,
    regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
  })
  it('packs GFF features into rows a span mark stands on', () => {
    ran(pileup.name)
    expect(existsSync(pileup.png)).toBe(true)
  })

  const emptyWindow: Build = {
    display: {
      transform: [
        { type: 'bin', step: 100 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      marks: [{ mark: 'bar', encoding: { y: 'count' } }],
    },
    type: 'VcfTabixAdapter',
    uri: VCF,
    // the first record sits at POS 277
    regions: [{ refName: 'ctgA', start: 0, end: 200 }],
  }
  const empty = figure('empty', emptyWindow)
  const emptyFrame = frameProbe(
    'emptyframe',
    emptyWindow,
    'cat(nrow(df), "count" %in% names(df), ".region" %in% names(df))',
  )
  it('draws an empty panel for a window holding nothing, as the browser does', () => {
    // an aggregate over no rows is a frame with the aggregate's columns and no
    // rows, not the NULL that do.call(rbind, list()) answers
    expect(ran(emptyFrame)).toBe('0 TRUE TRUE')
    ran(empty.name)
    expect(existsSync(empty.png)).toBe(true)
  })

  const twoRegions: Build = {
    display: {
      transform: [
        { type: 'bin', step: 1000 },
        { type: 'aggregate', ops: [{ op: 'count' }] },
      ],
      marks: [{ mark: 'bar', encoding: { y: 'count' } }],
    },
    type: 'Gff3TabixAdapter',
    uri: GFF,
    regions: [
      { refName: 'ctgA', start: 500, end: 3500 },
      { refName: 'ctgA', start: 20000, end: 23000 },
    ],
  }
  const perRegion = frameProbe(
    'perregion',
    twoRegions,
    `offset <- (regions$offset - regions$start)[df$.region]
cat(sort(unique(df$.region)), all((df$start - offset) %% 1000 == 0))`,
  )
  it('bins each region on genomic multiples and folds no two regions together', () => {
    // the browser runs each region's steps alone; a bin on the shared axis
    // takes the region's offset out before it floors, and puts it back
    expect(ran(perRegion)).toBe('1 2 TRUE')
  })
})

/**
 * What the figure claims, checked against R rather than against the emitter.
 * A probe calls one helper and asserts a fact about the data, so a reader that
 * silently returns the wrong window fails here rather than in a picture.
 */
maybe('the readers agree with the file', () => {
  const gaps = helperProbe(
    'gaps',
    `
df <- read_bigwig(${rStr(BIGWIG)}, "ctgA", 0, 5000)
df <- df[order(df$start), ]
cat(sum(df$start[-1] != head(df$end, -1)))
`,
  )
  it('hands back 0-based half-open bins that abut', () => {
    expect(ran(gaps)).toBe('0')
  })

  /**
   * Each reader converts rtracklayer's 1-based inclusive coordinates to the
   * repo's 0-based half-open, and a sabotage sweep found every one of these
   * mutations green before these probes existed. The doc calls that seam the
   * bug that cost a wrong figure.
   */
  const gffCoords = helperProbe(
    'gffcoords',
    `
df <- read_gff(${rStr(GFF)}, "ctgA", 0, 50000)
g <- df[df$type == "gene", ]
cat(min(g$start), max(g$end))
`,
  )
  it('reads GFF features at the coordinates the file states', () => {
    const [start, end] = ran(gffCoords).split(' ').map(Number)
    // volvox's first gene starts at 1049 0-based; a lost conversion reads 1050
    expect(start).toBe(1049)
    expect(end).toBeLessThanOrEqual(50000)
  })

  const shifted = helperProbe(
    'shifted',
    `
regions <- region_layout(data.frame(
  chrom = c("ctgA", "ctgA"), start = c(0, 20000), end = c(2000, 22000)))
df <- read_regions(
  function(chrom, start, end) read_bigwig(${rStr(BIGWIG)}, chrom, start, end),
  regions, c("start", "end"))
cat(min(df$start), max(df$end), max(regions$cum_end))
`,
  )
  it('shifts and clips two regions onto the cumulative axis', () => {
    const [lo, hi, cumEnd] = ran(shifted).split(' ').map(Number)
    // the second region lands beside the first, not at its genomic 20000
    expect(lo).toBe(0)
    expect(hi).toBeLessThanOrEqual(cumEnd!)
    expect(hi).toBeLessThan(20000)
  })

  const unclipped = helperProbe(
    'unclipped',
    `
regions <- region_layout(data.frame(chrom = "ctgA", start = 1000, end = 2000))
df <- read_regions(
  function(chrom, start, end) read_gff(${rStr(GFF)}, chrom, start, end),
  regions, c("start", "end"))
cat(min(df$start) < 1000, max(df$end) > 2000)
`,
  )
  it('leaves a lone region unclipped, as the browser hands its steps the whole feature', () => {
    expect(ran(unclipped)).toBe('TRUE TRUE')
  })

  const packed = helperProbe(
    'packed',
    `
df <- read_gff(${rStr(GFF)}, "ctgA", 0, 50000)
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
  it('packs a pileup into rows that do not overlap', () => {
    expect(ran(packed)).toBe('0 0')
  })

  const window = helperProbe(
    'window',
    `
df <- read_bigwig(${rStr(BIGWIG)}, "ctgA", 100, 200)
cat(min(df$start), max(df$end))
`,
  )
  it('reads the window it was asked for, not one shifted by a base', () => {
    const [start, end] = ran(window).split(' ').map(Number)
    expect(start).toBeGreaterThanOrEqual(100)
    expect(end).toBeLessThanOrEqual(200)
  })

  const absent = helperProbe(
    'absent',
    `
cat(nrow(read_gff(${rStr(GFF)}, "ctgC", 0, 100)), nrow(read_vcf(${rStr(VCF)}, "ctgB", 0, 100)))
`,
  )
  it('reads a contig the index lacks as nothing, not as an error', () => {
    expect(ran(absent)).toBe('0 0')
  })
})

maybe('the fields the display names reach R', () => {
  const gffattr = figure('gffattr', {
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
  it('colours GFF spans by an attribute the file carries', () => {
    expect(gffattr.source).toContain('attrs = c("Note")')
    ran(gffattr.name)
    expect(existsSync(gffattr.png)).toBe(true)
  })

  const vcfinfo = figure('vcfinfo', {
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
  it('plots a VCF INFO field on the value axis', () => {
    expect(vcfinfo.source).toContain('info = c("DP")')
    ran(vcfinfo.name)
    expect(existsSync(vcfinfo.png)).toBe(true)
  })
})

maybe('the display-level settings run', () => {
  const facetRows = frameProbe(
    'facetrows',
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
  it('packs each facet section on its own rows', () => {
    const [sections, fromZero] = ran(facetRows).split(' ').map(Number)
    expect(sections).toBeGreaterThan(1)
    expect(fromZero).toBe(sections)
  })

  const naGroup = frameProbe(
    'nagroup',
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
    'cat(sum(is.na(df$Note)), sum(df$count))',
  )
  it('keeps an aggregate group whose key is missing', () => {
    const [naGroups, total] = ran(naGroup).split(' ').map(Number)
    // the features without a Note fold into one group rather than vanishing
    expect(naGroups).toBe(1)
    expect(total).toBeGreaterThan(100)
  })

  const rowsrules = figure('rowsrules', {
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
    regions: ONE_REGION,
  })
  it('draws rows as panels, rules as lines, and a log axis floored by the data', () => {
    expect(rowsrules.source).toContain('facet_wrap(~strand')
    expect(rowsrules.source).toContain('geom_hline(yintercept = 20')
    ran(rowsrules.name)
    expect(existsSync(rowsrules.png)).toBe(true)
  })

  const autobin = figure('autobin', {
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
  it('follows the figure width with an auto bin', () => {
    // 50 kb over 1500 px is 33 bp/px, four of which snap up to 200
    expect(autobin.source).toContain('/ 200)')
    ran(autobin.name)
    expect(existsSync(autobin.png)).toBe(true)
  })
})

maybe('the readers answer the fields they were asked for', () => {
  const attrs = helperProbe(
    'attrs',
    `
df <- read_gff(${rStr(GFF)}, "ctgA", 0, 50000, attrs = c("note", "Index", "absent"))
cat(sum(!is.na(df$note)), is.numeric(df$Index), all(is.na(df$absent)), is.numeric(df$score))
`,
  )
  it('matches a GFF attribute without regard to case and types a numeric one', () => {
    const [notes, indexNumeric, absentNa, scoreNumeric] = ran(attrs).split(' ')
    expect(Number(notes)).toBeGreaterThan(0)
    expect(indexNumeric).toBe('TRUE')
    expect(absentNa).toBe('TRUE')
    expect(scoreNumeric).toBe('TRUE')
  })

  const info = helperProbe(
    'info',
    `
df <- read_vcf(${rStr(VCF)}, "ctgA", 0, 1000, info = c("DP"))
cat(df$start[1], df[["INFO.DP"]][1], is.numeric(df[["INFO.DP"]]), df$QUAL[1])
`,
  )
  it('reads a VCF INFO key as a typed column under its dotted name', () => {
    // the first record sits at POS 277 with DP=3 and QUAL 10.4
    expect(ran(info)).toBe('276 3 TRUE 10.4')
  })

  const inverted = helperProbe(
    'inverted',
    `
df <- data.frame(start = c(10, 50), end = c(5, 60))
df$row <- IRanges::disjointBins(IRanges(df$start + 1L, pmax(df$end, df$start))) - 1L
cat(df$row)
`,
  )
  it('survives a feature whose end precedes its start', () => {
    expect(ran(inverted)).toBe('0 0')
  })
})
