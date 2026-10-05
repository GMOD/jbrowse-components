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

import { featureFields, featurePlot } from './featureToPlot.ts'
import { frameFor, sourceNotes } from './frameFor.ts'
import { fieldsRead, markPlot } from './markToPlot.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { assembleRScript, helpersIn } from './rScript.ts'
import { rStr } from './rplot.ts'

import type { FeatureDisplaySpec } from './featureToPlot.ts'
import type { ReaderName } from './frameFor.ts'
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
  'GenomicAlignments',
  'ggplot2',
  'patchwork',
]

const R = hasR()
const BIGWIG = path.resolve('test_data/volvox/volvox.bw')
const GFF = path.resolve('test_data/volvox/volvox.sort.gff3.gz')
const VCF = path.resolve('test_data/volvox/volvox.filtered.vcf.gz')
const BED = path.resolve('test_data/volvox/volvox-bed12.bed.gz')
const BAM = path.resolve('test_data/volvox/volvox-sorted.bam')
const PAIRED_BAM = path.resolve('test_data/volvox/volvox-sv.bam')
const MARKS_CONFIG = JSON.parse(
  readFileSync(path.resolve('test_data/volvox/config_marks.json'), 'utf8'),
) as { tracks: { trackId: string; displays: DisplaySpec[] }[] }

function marksDisplay(trackId: string) {
  return MARKS_CONFIG.tracks.find(t => t.trackId === trackId)!.displays[0]!
}

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
  type: ReaderName
  uri: string
  regions: Region[]
}

interface GeneBuild {
  display: FeatureDisplaySpec
  type: 'Gff3TabixAdapter' | 'BedTabixAdapter'
  uri: string
  regions: Region[]
}

function geneScript({ display, type, uri, regions }: GeneBuild, out?: string) {
  const f = frameFor({
    type,
    uri,
    name: 'genes',
    fields: featureFields(display, regions),
    wholeFeatures: true,
  })
  const { plot, notes } = featurePlot({ display, frame: f, regions })
  return assembleRScript({
    regions,
    panels: [{ variable: 'p1', plot }],
    notes: [...sourceNotes(uri), ...notes],
    out,
  })
}

function geneFigure(name: string, b: GeneBuild) {
  const png = path.join(CASES, `${name}.png`)
  return { name: register(name, geneScript(b, png)), png }
}

/** The gene panel's frames, built by R, and then `body` over them. */
function geneProbe(name: string, b: GeneBuild, body: string) {
  const script = geneScript(b)
  return register(
    name,
    `${script.slice(0, script.indexOf('p1 <- ggplot'))}\n${body}\n`,
  )
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
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: { value: 'steelblue' } },
        },
      ],
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
              domain: ['1', '-1'],
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

maybe('the marks main’s grammar added run', () => {
  const lines = figure('lines', {
    display: {
      marks: [
        { mark: 'line', encoding: { y: 'score', size: 2 } },
        {
          mark: 'line',
          interpolate: 'linear',
          encoding: { y: 'score', color: { value: 'tomato' } },
        },
      ],
    },
    type: 'BigWigAdapter',
    uri: BIGWIG,
    regions: [
      { refName: 'ctgA', start: 0, end: 2000 },
      { refName: 'ctgA', start: 20000, end: 22000 },
    ],
  })
  it('draws a step and a linear line over two regions', () => {
    ran(lines.name)
    expect(existsSync(lines.png)).toBe(true)
  })

  const stepPath = helperProbe(
    'steppath',
    `
df <- data.frame(start = c(0, 10, 30), end = c(10, 20, 40), score = c(5, 7, 3), .region = 1)
p <- step_path(df, "start", "end", "score", origin = 0)
cat(paste(p$.x, p$.y, sep = ":"))
`,
  )
  it('holds each value across its span and drops to the origin across a gap', () => {
    expect(ran(stepPath)).toBe(
      '0:0 0:5 10:5 10:7 20:7 20:0 30:0 30:3 40:3 40:0',
    )
  })

  const strand = figure('strand', {
    display: {
      transform: [{ type: 'pileup' }],
      marks: [
        { mark: 'span', rowProportion: 0.8, encoding: { color: 'strand' } },
      ],
    },
    type: 'Gff3TabixAdapter',
    uri: GFF,
    regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
  })
  const strandValues = helperProbe(
    'strandvalues',
    `
df <- read_gff(${rStr(GFF)}, "ctgA", 0, 50000)
cat(all(df$strand %in% c(-1, 0, 1)), all(c(-1, 1) %in% df$strand))
`,
  )
  it('reads strand as the numbers a config’s strand domain names', () => {
    expect(ran(strandValues)).toBe('TRUE TRUE')
    expect(strand.source).toContain('"1" = "tomato"')
    ran(strand.name)
    expect(existsSync(strand.png)).toBe(true)
  })

  const depth = figure('depth', {
    display: {
      transform: [{ type: 'coverage' }],
      marks: [{ mark: 'bar' }],
    },
    type: 'Gff3TabixAdapter',
    uri: GFF,
    regions: [{ refName: 'ctgA', start: 0, end: 50000 }],
  })
  it('plots the depth a coverage step wrote for a bar naming no y', () => {
    expect(depth.source).toContain('ymax = coverage')
    ran(depth.name)
    expect(existsSync(depth.png)).toBe(true)
  })

  const weighted = frameProbe(
    'weighted',
    {
      display: {
        transform: [
          { type: 'bin', step: 1000, fields: ['start', 'end'] },
          {
            type: 'aggregate',
            ops: [
              { op: 'count', weight: 'overlap', as: 'bases' },
              { op: 'mean', field: 'score', weight: 'overlap', as: 'm' },
            ],
          },
        ],
        marks: [{ mark: 'bar', encoding: { y: 'm' } }],
      },
      type: 'BigWigAdapter',
      uri: BIGWIG,
      regions: ONE_REGION,
    },
    `raw <- read_bigwig(${rStr(BIGWIG)}, "ctgA", 0, 5000)
cat(all(df$bases <= 1000), sum(df$bases) == sum(raw$end - raw$start),
  all(df$start %% 1000 == 0), all(df$end - df$start == 1000))`,
  )
  it('cuts each bin’s intervals at its edges and weights the mean by bases', () => {
    expect(ran(weighted)).toBe('TRUE TRUE TRUE TRUE')
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

const GENE_WINDOW = [{ refName: 'ctgA', start: 0, end: 24000 }]

maybe('the gene glyph runs', () => {
  const genes = geneFigure('genes', {
    display: { showOnlyGenes: true },
    type: 'Gff3TabixAdapter',
    uri: GFF,
    regions: GENE_WINDOW,
  })
  it('draws the volvox gene models', () => {
    ran(genes.name)
    expect(existsSync(genes.png)).toBe(true)
  })

  const lanes = geneProbe(
    'genelanes',
    {
      display: { showOnlyGenes: true },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: GENE_WINDOW,
    },
    `
utr <- genes_parts[genes_parts$lane == "cds-Apple2" & genes_parts$part == "UTR", ]
cat(sum(genes_lanes$gene == "EDEN"), paste(utr$start, utr$end, collapse = ","),
  any(genes_lanes$type == "match"))
`,
  )
  it('stacks a gene’s transcripts and implies the UTRs an mRNA leaves unnamed', () => {
    // Apple2 is "mRNA with CDSs but no UTRs": 13000-17200 around CDS 13500-17000
    expect(ran(lanes)).toBe('3 12999 13499,17000 17200 FALSE')
  })

  const longest = geneProbe(
    'longest',
    {
      display: { showOnlyGenes: true, geneGlyphMode: 'longestCoding' },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: GENE_WINDOW,
    },
    `
cat(genes_lanes$id[genes_lanes$gene == "EDEN"],
  sum(genes_parts$lane == "cds-Apple2" & genes_parts$part == "CDS"))
`,
  )
  it('keeps the longest coding isoform and leaves a lone mRNA its CDS', () => {
    expect(ran(longest)).toBe('EDEN.1 3')
  })

  const cut = geneProbe(
    'cut',
    {
      display: { showOnlyGenes: true },
      type: 'Gff3TabixAdapter',
      uri: GFF,
      regions: [{ refName: 'ctgA', start: 4000, end: 14000 }],
    },
    `
e1 <- genes_parts[genes_parts$lane == "EDEN.1", ]
cat(sum(e1$part == "CDS"), min(e1$start))
`,
  )
  it('reads a transcript whole when the window cuts it', () => {
    // two of EDEN.1's four CDS lie left of the window
    expect(ran(cut)).toBe('4 1049')
  })

  const two = {
    display: { showOnlyGenes: true },
    type: 'Gff3TabixAdapter' as const,
    uri: GFF,
    regions: [
      { refName: 'ctgA', start: 1000, end: 9500 },
      { refName: 'ctgA', start: 17000, end: 23500 },
    ],
  }
  const twoFigure = geneFigure('genetwo', two)
  const twoClipped = geneProbe(
    'genetwoclipped',
    two,
    `
inside <- function(d) all(d$start >= regions$cum_start[d$.region] &
  d$end <= regions$cum_end[d$.region])
cat(inside(genes_parts), inside(genes_lines), nrow(genes_parts) > 0)
`,
  )
  it('clips each region’s glyphs to that region on the shared axis', () => {
    ran(twoFigure.name)
    expect(ran(twoClipped)).toBe('TRUE TRUE TRUE')
  })

  const bed = geneFigure('bedgenes', {
    display: {},
    type: 'BedTabixAdapter',
    uri: BED,
    regions: GENE_WINDOW,
  })
  const bedParts = geneProbe(
    'bedparts',
    { display: {}, type: 'BedTabixAdapter', uri: BED, regions: GENE_WINDOW },
    `
e1 <- genes_parts[genes_parts$lane == genes_lanes$id[genes_lanes$name == "EDEN.1"], ]
cat(nrow(genes_lanes), sum(e1$part == "CDS"), sum(e1$part == "UTR"))
`,
  )
  it('draws a BED12 record as a transcript', () => {
    ran(bed.name)
    expect(existsSync(bed.png)).toBe(true)
    // EDEN.1: four blocks, thick 1200-7608, so a UTR either end
    expect(ran(bedParts)).toBe('4 4 2')
  })
})

maybe('the BED mark tracks run', () => {
  const config = JSON.parse(
    readFileSync(path.resolve('test_data/volvox/config_marks.json'), 'utf8'),
  ) as {
    tracks: {
      trackId: string
      adapter: { type: string }
      displays: DisplaySpec[]
    }[]
  }
  const beds = config.tracks.filter(t => t.adapter.type === 'BedTabixAdapter')
  const cases = beds.map(t =>
    figure(t.trackId, {
      display: t.displays[0]!,
      type: 'BedTabixAdapter',
      uri: BED,
      regions: GENE_WINDOW,
    }),
  )
  it('translates every volvox BedTabix mark track', () => {
    expect(beds.map(t => t.trackId).sort()).toEqual([
      'marks_bars',
      'marks_line',
      'marks_points',
      'marks_text',
    ])
    for (const c of cases) {
      ran(c.name)
      expect(existsSync(c.png)).toBe(true)
    }
  })
})

maybe('a BAM reads as a mark display’s features', () => {
  const region = [{ refName: 'ctgA', start: 1000, end: 6000 }]
  const bamFigure = (trackId: string) =>
    figure(trackId, {
      display: marksDisplay(trackId),
      type: 'BamAdapter',
      uri: BAM,
      regions: region,
    })
  const pileup = bamFigure('marks_pileup')
  const ramp = bamFigure('marks_ramp')
  const twoAxes = bamFigure('marks_two_axes')
  it('draws the volvox mark tracks over a BAM', () => {
    for (const f of [pileup, ramp, twoAxes]) {
      ran(f.name)
      expect(existsSync(f.png)).toBe(true)
    }
  })

  it('reports the facet track’s jexl formula rather than drawing it', () => {
    const { notes } = translate({
      display: marksDisplay('marks_facet'),
      type: 'BamAdapter',
      uri: BAM,
      regions: region,
    })
    expect(notes.join('\n')).toContain('formula writes nm from a jexl callback')
  })

  const reads = helperProbe(
    'bamreads',
    `
df <- read_bam(${rStr(BAM)}, "ctgA", 1000, 6000, tags = c("NM", "XX"))
cat(nrow(df), sum(df$strand == 1), sum(df$strand == -1), sum(df$score == 37),
  is.numeric(df[["tags.NM"]]), sum(df[["tags.NM"]]), all(is.na(df[["tags.XX"]])),
  all(is.na(df$pair_orientation)))
`,
  )
  it('answers the fields a JBrowse read does, under its names', () => {
    // the counts BamAdapter.getFeatures gives over the same window
    expect(ran(reads)).toBe('982 477 505 948 TRUE 1952 TRUE TRUE')
  })

  const orientation = helperProbe(
    'bamorientation',
    `
df <- read_bam(${rStr(PAIRED_BAM)}, "ctgA", 1000, 6000)
t <- table(df$pair_orientation)
cat(paste(names(t), t, sep = "=", collapse = " "))
`,
  )
  it('codes pair orientation as BamRecord does', () => {
    expect(ran(orientation)).toBe(
      'F1R2=107 F2R1=113 R1F2=1 R1R2=16 R2F1=4 R2R1=16',
    )
  })

  const absent = helperProbe(
    'bamabsent',
    `cat(nrow(read_bam(${rStr(BAM)}, "nope", 0, 100, tags = "NM")))`,
  )
  it('reads a contig the BAM lacks as no reads', () => {
    expect(ran(absent)).toBe('0')
  })
})
