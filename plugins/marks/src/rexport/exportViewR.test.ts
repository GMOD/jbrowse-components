import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  categoricalPalette,
  categoricalValueColor,
} from '@jbrowse/core/ui/colors'
import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { MEASURE_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'
import { colorEncodingOf } from '@jbrowse/display-kit/colorConfigSchema'

import {
  REGIONS,
  VOLVOX,
  available,
  configTracks,
  hasR,
  runCases,
  track,
} from './exportView.fixture.ts'
import { exportTracksToR } from './exportView.ts'
import { HELPERS } from './rHelpers.generated.ts'

import type { RCase } from './exportView.fixture.ts'
import type { RExportTrack } from './exportView.ts'
import type { Region } from './rScript.ts'

const marks = configTracks('config_marks.json')
const main = configTracks('config.json')
const dir = mkdtempSync(path.join(tmpdir(), 'rexport-fix-'))
const out = path.join(dir, 'f.png')

function scriptFor(tracks: RExportTrack[], regions: Region[] = REGIONS) {
  const { script } = exportTracksToR({ tracks, regions, out })
  return script!
}

function markDisplay(trackId: string) {
  return marks.get(trackId)!.displays![0]!
}

const cases: RCase[] = []
const results = new Map<string, string>()
const maybe = hasR() ? describe : describe.skip

function register(name: string, script: string, probe: string) {
  cases.push({ name, script, probe })
  return name
}

const absentContig = register(
  'absent_contig',
  scriptFor(
    [track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {})],
    [{ refName: 'ctgB', start: 0, end: 5000 }],
  ),
  '{ a <- aln_volvox_alignments; c(nrow(a$reads), nrow(a$coverage), nrow(a$mismatches)) }',
)

const READ_NAME = 'ctgA_1405_1888_3:0:0_5:0:0_21c4'
const filtered = register(
  'aln_filter',
  scriptFor([
    track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
      filter: { flagExclude: 1540 + 16, readName: READ_NAME },
    }),
  ]),
  '{ r <- aln_volvox_alignments$reads; c(unique(r$name), unique(r$strand)) }',
)

const SPLICED_REGION = [{ refName: 'ctgA', start: 400, end: 1200 }]
const splicedReads = (spliced: 'only' | 'exclude') =>
  register(
    `aln_spliced_${spliced}`,
    scriptFor(
      [
        track(main, 'spliced', 'LinearAlignmentsDisplay', {
          filter: { spliced },
        }),
      ],
      SPLICED_REGION,
    ),
    '{ a <- aln_spliced; c(nrow(a$reads), sum(seq_len(nrow(a$reads)) %in% a$gaps$read[a$gaps$type == "skip"])) }',
  )
const splicedOnly = splicedReads('only')
const splicedExcluded = splicedReads('exclude')

const chainFilterNotes = exportTracksToR({
  tracks: [
    track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
      filter: { properPairs: 'exclude', split: 'only' },
    }),
  ],
  regions: REGIONS,
}).notes

const TWO_REGIONS = [
  { refName: 'ctgA', start: 1000, end: 3000 },
  { refName: 'ctgA', start: 3000, end: 3500 },
]
/** A table's rows in region `k`, which a lone region's tables, read directly, hold all of. */
const inRegion = `in_region <- function(d, k) d[if (is.null(d$.region)) rep(k == 1, nrow(d)) else d$.region == k, , drop = FALSE]`
const regionTotals = (region: string) =>
  `{ ${inRegion}
  a <- aln_volvox_alignments; lo <- regions$cum_start[${region}]; hi <- regions$cum_end[${region}]
  d <- in_region(a$coverage, ${region}); d <- d[d$end > lo & d$start < hi, ]
  d$start <- pmax(d$start, lo); d$end <- pmin(d$end, hi)
  m <- in_region(a$mismatches, ${region}); m <- m[m$position >= lo & m$position < hi, ]
  r <- in_region(a$reads, ${region})
  c(nrow(r), sum((d$end - d$start) * d$depth), max(d$depth), nrow(m)) }`
const alignmentsOver = (regions: Region[]) =>
  scriptFor(
    [track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {})],
    regions,
  )
const bothRegions = TWO_REGIONS.map((_, i) =>
  register(
    `aln_two_regions_${i + 1}`,
    alignmentsOver(TWO_REGIONS),
    regionTotals(`${i + 1}`),
  ),
)
const eachAlone = TWO_REGIONS.map((r, i) =>
  register(`aln_region_alone_${i + 1}`, alignmentsOver([r]), regionTotals('1')),
)
const crossRegionTicks = register(
  'aln_two_regions_ticks',
  alignmentsOver(TWO_REGIONS),
  `{ a <- aln_volvox_alignments; m <- a$mismatches; r <- a$reads; i <- m$read
  c(nrow(m) > 0, all(m$position >= r$start[i] & m$position < r$end[i]), all(m$row == r$row[i]), all(m$.region == r$.region[i])) }`,
)

function samtools(...args: string[]) {
  return execFileSync('samtools', args, { stdio: ['ignore', 'pipe', 'ignore'] })
}
const hasSamtools = available('samtools', () => samtools('--version'))

function splicedFrom(bam: string, refNames?: Record<string, string>) {
  return {
    ...track(main, 'spliced', 'LinearAlignmentsDisplay', {}),
    adapter: {
      type: 'BamAdapter',
      bamLocation: { localPath: bam },
      index: { location: { localPath: `${bam}.bai` } },
    },
    refNames,
  }
}

const spliced = path.join(dir, 'spliced-calmd.bam')
const noMd = path.join(dir, 'spliced-nomd.bam')
const aliasedNoMd = path.join(dir, 'spliced-chrA-nomd.bam')
if (hasSamtools) {
  samtools(
    'view',
    '-b',
    '--remove-tag',
    'MD',
    '-o',
    noMd,
    path.join(VOLVOX, 'spliced.bam'),
  )
  writeFileSync(
    spliced,
    samtools('calmd', '-b', noMd, path.join(VOLVOX, 'volvox.fa')),
  )
  samtools('index', spliced)
  samtools('index', noMd)
  const header = path.join(dir, 'chrA.sam')
  writeFileSync(
    header,
    samtools('view', '-H', spliced).toString().replace('SN:ctgA', 'SN:chrA'),
  )
  writeFileSync(aliasedNoMd, samtools('reheader', header, noMd))
  samtools('index', aliasedNoMd)
}
const tickSet =
  '{ m <- aln_spliced$mismatches; m <- m[m$position >= 400 & m$position < 1200, ]; paste(sort(paste(m$position, m$base)), collapse = " ") }'
const splicedTicks = [
  splicedFrom(spliced),
  splicedFrom(noMd),
  splicedFrom(aliasedNoMd, { ctgA: 'chrA' }),
].map((t, i) =>
  hasSamtools
    ? register(
        `aln_spliced_ticks_${i}`,
        scriptFor([t], SPLICED_REGION),
        tickSet,
      )
    : '',
)

const SV_REGIONS = [
  { refName: 'ctgA', start: 0, end: 50000 },
  { refName: 'ctgB', start: 0, end: 6000 },
]
const insertClasses = (name: string, regions: Region[], region: number) =>
  register(
    `insert_classes_${name}`,
    scriptFor(
      [
        track(main, 'volvox_sv', 'LinearAlignmentsDisplay', {
          color: { field: 'insertSize' },
        }),
      ],
      regions,
    ),
    `{ ${inRegion}; r <- in_region(aln_volvox_sv$reads, ${region})
  paste(names(table(r$category)), table(r$category), collapse = " ") }`,
  )
const pooledInsertClasses = SV_REGIONS.map((_, i) =>
  insertClasses(`pooled_${i + 1}`, SV_REGIONS, i + 1),
)
const aloneInsertClasses = SV_REGIONS.map((r, i) =>
  insertClasses(`alone_${i + 1}`, [r], 1),
)

const deletions = register(
  'aln_deletions',
  scriptFor([track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {})]),
  `{ a <- aln_volvox_alignments; d <- a$gaps[a$gaps$type == "deletion", ]; r <- a$reads
  c(nrow(d) > 0, all(d$start >= r$start[d$read] & d$end <= r$end[d$read])) }`,
)

const collidingIds = register(
  'colliding_ids',
  scriptFor(
    ['a-b', 'a_b'].map(trackId => ({
      ...track(marks, 'marks_line_posneg', 'LinearMarkDisplay', {
        ...markDisplay('marks_line_posneg'),
      }),
      trackId,
    })),
  ),
  'c(nrow(df_a_b) > 0, nrow(df_a_b_2) > 0)',
)

const reservedAttr = register(
  'reserved_attr',
  scriptFor([
    track(marks, 'marks_density', 'LinearMarkDisplay', {
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: { field: 'function' } },
        },
      ],
    }),
  ]),
  'nrow(df_marks_density) > 0',
)

copyFileSync(path.join(VOLVOX, 'volvox.bw'), path.join(dir, 'x.bw?sig=1'))

const presigned = register(
  'presigned_bigwig',
  scriptFor([
    {
      ...track(marks, 'marks_line_posneg', 'LinearMarkDisplay', {
        ...markDisplay('marks_line_posneg'),
      }),
      adapter: {
        type: 'BigWigAdapter',
        bigWigLocation: { localPath: path.join(dir, 'x.bw?sig=1') },
      },
    },
  ]),
  'nrow(df_marks_line_posneg) > 0',
)

const insertCuts = register(
  'insert_cuts',
  scriptFor([
    track(main, 'volvox_sv', 'LinearAlignmentsDisplay', {
      color: { field: 'insertSize', domain: ['300', '600'] },
    }),
  ]),
  `{ r <- aln_volvox_sv$reads; t <- abs(r$insert_size)
  c(all(r$category[t > 600] == "longInsert"), all(r$category[t > 0 & t < 300] == "shortInsert"),
    all(r$category[t >= 300 & t <= 600] == "normalInsert"), sum(t > 600) > 0, sum(t > 0 & t < 300) > 0) }`,
)

copyFileSync(
  path.join(VOLVOX, 'volvox.sort.gff3.gz'),
  path.join(dir, 'genes.gff3.gz'),
)
copyFileSync(
  path.join(VOLVOX, 'volvox.sort.gff3.gz.tbi'),
  path.join(dir, 'genes.index'),
)

const renamedIndex = register(
  'renamed_index',
  scriptFor([
    {
      ...track(main, 'gff3tabix_genes', 'LinearBasicDisplay', {}),
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: { localPath: path.join(dir, 'genes.gff3.gz') },
        index: { location: { localPath: path.join(dir, 'genes.index') } },
      },
    },
  ]),
  'nrow(genes_gff3tabix_genes$features) > 0',
)

const drawnRows = `sum(vapply(
  Filter(function(o) inherits(o, "ggplot"), mget(ls(), inherits = FALSE)),
  function(p) sum(vapply(ggplot_build(p)$data, nrow, 1)), 1))`

const wide = [{ refName: 'ctgA', start: 0, end: 50000 }]
const NEEDS_JEXL_FORMULA = new Set(['marks_facet'])
const everyMark = new Map<string, string>()
for (const [trackId, conf] of marks) {
  const display = conf.displays?.[0]
  if (display?.type === 'LinearMarkDisplay') {
    const result = exportTracksToR({
      tracks: [track(marks, trackId, 'LinearMarkDisplay', display)],
      regions: wide,
      out,
    })
    if (result.script) {
      everyMark.set(
        trackId,
        register(`mark_${trackId}`, result.script, drawnRows),
      )
    }
  }
}

const strandColors = register(
  'strand_colors',
  scriptFor([
    track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
      color: { field: 'strand' },
    }),
  ]),
  'sort(unique(ggplot_build(pileup_volvox_alignments)$data[[1]]$fill))',
)

const mapqBins = register(
  'mapq_bins',
  scriptFor([
    track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
      color: { field: 'mapq' },
    }),
  ]),
  `{ b <- ggplot_build(pileup_volvox_alignments)
  u <- unique(data.frame(m = aln_volvox_alignments$reads$mapq, f = b$data[[1]]$fill))
  paste(c(paste(u$m, u$f)[order(u$m)], b$plot$scales$get_scales("fill")$get_labels()), collapse = "|") }`,
)

const defaultMark = register(
  'default_mark',
  scriptFor(
    [
      track(marks, 'marks_bars', 'LinearMarkDisplay', {
        marks: [{ encoding: { y: 'score', color: { field: 'name' } } }],
      }),
    ],
    wide,
  ),
  drawnRows,
)

const variantTypes = register(
  'variant_types',
  scriptFor(
    [
      track(
        marks,
        'marks_variants',
        'LinearMarkDisplay',
        markDisplay('marks_variants'),
      ),
    ],
    wide,
  ),
  `{ t <- table(df_marks_variants$type)
  paste(paste(names(t), t)[order(tolower(names(t)))], collapse = "|") }`,
)

function wiggle(display: Record<string, unknown>) {
  return scriptFor(
    [track(main, 'wiggle_track_posneg', 'LinearWiggleDisplay', display)],
    [{ refName: 'ctgA', start: 0, end: 50000 }],
  )
}

const drawn = 'Filter(nrow, ggplot_build(p_wig_wiggle_track_posneg)$data)'
const layerRows = `sum(vapply(${drawn}, nrow, 1))`
const layerColors = (aes: string) =>
  `sort(unique(unlist(lapply(${drawn}, function(d) as.character(d$${aes})))))`

const wiggleBar = register('wiggle_bar', wiggle({}), layerColors('fill'))
const wiggleBarRows = register('wiggle_bar_rows', wiggle({}), layerRows)
const wiggleLine = register(
  'wiggle_line',
  wiggle({ mark: 'line' }),
  layerColors('colour'),
)
const wiggleHeat = register(
  'wiggle_heatmap',
  wiggle({ mark: 'span' }),
  `length(${layerColors('fill')}) > 2`,
)
const wigglePlain = register(
  'wiggle_plain',
  wiggle({ color: 'darkgreen' }),
  layerColors('fill'),
)

function oracleStrings() {
  let seed = 12345
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed
  }
  const alphabet = 'abcXYZ019._-:/ \u00E9\u4E2D'
  const out = new Set<string>(['', '0', '1', '7', '10', '2.5', '-3', '1e3'])
  while (out.size < 200) {
    const n = 1 + (next() % 12)
    let word = ''
    for (let i = 0; i < n; i++) {
      word += alphabet[next() % alphabet.length]
    }
    out.add(word)
  }
  return [...out]
}

const strings = oracleStrings().filter(v => v !== '')
const colorOracle = register(
  'color_oracle',
  `${HELPERS.category_values}
vals <- c(${strings.map(v => JSON.stringify(v)).join(', ')})
pal <- c(${categoricalPalette.map(c => JSON.stringify(c)).join(', ')})
expected <- c(${strings.map(v => JSON.stringify(categoricalValueColor(v))).join(', ')})
`,
  'sum(unname(category_values(vals, pal)[vals]) != expected)',
)

const barsColors = register(
  'bars_colors',
  scriptFor(
    [
      track(
        marks,
        'marks_bars',
        'LinearMarkDisplay',
        markDisplay('marks_bars'),
      ),
    ],
    [{ refName: 'ctgA', start: 0, end: 50000 }],
  ),
  'setNames(ggplot_build(p_marks_bars)$data[[1]]$fill, df_marks_bars$name)[c("EDEN.1", "EDEN.3")]',
)

const pointsShapes = register(
  'points_shapes',
  scriptFor(
    [
      track(
        marks,
        'marks_points',
        'LinearMarkDisplay',
        markDisplay('marks_points'),
      ),
    ],
    [{ refName: 'ctgA', start: 0, end: 50000 }],
  ),
  'table(ggplot_build(p_marks_points)$data[[1]]$shape, useNA = "ifany")',
)

const bigBedReader = register(
  'bigbed_reader',
  `${HELPERS.read_bed}
${HELPERS.read_bigbed}
bb <- read_bigbed(${JSON.stringify(path.join(VOLVOX, 'volvox.bb'))}, "ctgA", 0, 50001)
tb <- read_bed(${JSON.stringify(path.join(VOLVOX, 'volvox-bed12.bed.gz'))}, "ctgA", 0, 50001)
`,
  'c(nrow(bb) > 0, isTRUE(all.equal(bb, tb, check.attributes = FALSE)))',
)

const bigBedGenes = register(
  'bigbed_genes',
  scriptFor(
    [track(main, 'bigbed_genes', 'LinearBasicDisplay', {})],
    [{ refName: 'ctgA', start: 0, end: 24000 }],
  ),
  `{ f <- genes_bigbed_genes$features; s <- genes_bigbed_genes$subfeatures
  eden <- which(f$type == "gene" & f$name == "EDEN")
  c(sum(f$type == "gene"), length(eden), sum(s$feature %in% eden)) }`,
)

const bigBedTwoRegions = register(
  'bigbed_two_regions',
  scriptFor(
    [track(main, 'bigbed_genes', 'LinearBasicDisplay', {})],
    TWO_REGIONS,
  ),
  `{ x <- genes_bigbed_genes; f <- x$features
  per <- function(r) { e <- which(f$type == "gene" & f$name == "EDEN" & f$.region == r)
    c(length(e), sum(x$subfeatures$feature %in% e), sum(x$rects$.region == r) > 0) }
  c(per(1), per(2)) }`,
)

const rgbBed = path.join(dir, 'rgb.bed')
const writeRgbBed = `writeLines(c(
  "ctgA\\t1000\\t3000\\tred\\t0\\t+\\t1200\\t2800\\t255,0,0\\t2\\t500,800\\t0,1200",
  "ctgA\\t4000\\t6000\\tplain\\t0\\t+\\t4200\\t5800\\t0,0,0\\t2\\t500,800\\t0,1200"),
  ${JSON.stringify(rgbBed)})
invisible(Rsamtools::indexTabix(Rsamtools::bgzip(${JSON.stringify(rgbBed)}, ${JSON.stringify(`${rgbBed}.gz`)}, overwrite = TRUE), format = "bed"))
`
function rgbBedScript(display: Record<string, unknown>) {
  return `${writeRgbBed}${scriptFor(
    [
      {
        ...track(main, 'gff3tabix_genes', 'LinearBasicDisplay', display),
        trackId: 'rgb',
        adapter: {
          type: 'BedTabixAdapter',
          bedGzLocation: { localPath: `${rgbBed}.gz` },
        },
      },
    ],
    [{ refName: 'ctgA', start: 0, end: 7000 }],
  )}`
}
const fillsOf = `{ x <- genes_rgb; name <- x$features$name[x$rects$feature]
  paste(unique(x$rects$color[name == "red"]), length(unique(x$rects$color[name == "plain"]))) }`
const bedOwnColor = register('bed_own_color', rgbBedScript({}), fillsOf)
const bedSetColor = register(
  'bed_set_color',
  rgbBedScript({ color: 'purple' }),
  fillsOf,
)

const multiGff = path.join(dir, 'multi.gff3')
const writeMultiGff = `writeLines(c("##gff-version 3",
  "ctgA\\tt\\tgene\\t1001\\t5000\\t.\\t+\\t.\\tID=g1",
  "ctgA\\tt\\tmRNA\\t1001\\t5000\\t.\\t+\\t.\\tID=tx1;Parent=g1;Name=tx1",
  "ctgA\\tt\\tmRNA\\t1001\\t5000\\t.\\t+\\t.\\tID=tx2;Parent=g1;Name=tx2",
  "ctgA\\tt\\texon\\t1001\\t1500\\t.\\t+\\t.\\tParent=tx1,tx2",
  "ctgA\\tt\\tCDS\\t1201\\t1500\\t.\\t+\\t0\\tParent=tx1,tx2",
  "ctgA\\tt\\texon\\t2001\\t2500\\t.\\t+\\t.\\tParent=tx1",
  "ctgA\\tt\\tCDS\\t2001\\t2500\\t.\\t+\\t0\\tParent=tx1",
  "ctgA\\tt\\texon\\t4001\\t5000\\t.\\t+\\t.\\tParent=tx1,tx2",
  "ctgA\\tt\\tCDS\\t4001\\t4800\\t.\\t+\\t0\\tParent=tx1,tx2",
  "ctgA\\tt\\tgene\\t6001\\t7000\\t.\\t-\\t.\\tID=g2;description=kinase thing",
  "ctgA\\tt\\tncRNA\\t6001\\t7000\\t.\\t-\\t.\\tID=nc1;Parent=g2",
  "ctgA\\tt\\texon\\t6001\\t6300\\t.\\t-\\t.\\tParent=nc1"),
  ${JSON.stringify(multiGff)})
invisible(Rsamtools::indexTabix(Rsamtools::bgzip(${JSON.stringify(multiGff)}, ${JSON.stringify(`${multiGff}.gz`)}, overwrite = TRUE), format = "gff"))
`
function multiGffScript(regions: Region[]) {
  return `${writeMultiGff}${scriptFor(
    [
      {
        ...track(main, 'gff3tabix_genes', 'LinearBasicDisplay', {
          geneGlyphMode: 'all',
        }),
        trackId: 'multi',
        adapter: {
          type: 'Gff3TabixAdapter',
          gffGzLocation: { localPath: `${multiGff}.gz` },
        },
      },
    ],
    regions,
  )}`
}
const sharedExons = register(
  'shared_exons',
  multiGffScript([{ refName: 'ctgA', start: 0, end: 8000 }]),
  `{ x <- genes_multi; g1 <- which(x$features$name == "g1")
  c(x$subfeatures$name[x$subfeatures$feature == g1], x$labels$text[is.na(x$labels$subfeature)]) }`,
)
const twoRegionGene = register(
  'two_region_gene',
  multiGffScript([
    { refName: 'ctgA', start: 900, end: 1600 },
    { refName: 'ctgA', start: 3900, end: 5100 },
  ]),
  `{ x <- genes_multi; r <- regions
  inside <- function(d) all(d$start >= r$cum_start[d$.region] & d$end <= r$cum_end[d$.region])
  genomic <- x$rects$start - r$offset[x$rects$.region] + r$start[x$rects$.region]
  c(inside(x$rects), inside(x$lines), any(genomic >= 2000 & genomic < 2500), sum(x$features$name == "g1")) }`,
)

const stackPng = path.join(dir, 'stack.png')
const stack = register(
  'engine_stack_two_regions',
  exportTracksToR({
    tracks: [
      track(main, 'gff3tabix_genes', 'LinearBasicDisplay', {}),
      track(
        main,
        'volvox_microarray_multi_multirowxy',
        'LinearWiggleDisplay',
        main.get('volvox_microarray_multi_multirowxy')!.displays![0]!,
      ),
      track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
        color: { field: 'strand' },
      }),
    ],
    regions: [
      { refName: 'ctgA', start: 1000, end: 4000 },
      { refName: 'ctgA', start: 6000, end: 9000 },
    ],
    out: stackPng,
  }).script!,
  `c(file.size(${JSON.stringify(stackPng)}) > 0, nrow(wig_volvox_microarray_multi_multirowxy$sources), max(genes_gff3tabix_genes$features$.region))`,
)

const fitted = (display: Record<string, unknown>) =>
  register(
    `fitted_${String(display.heightMode)}`,
    scriptFor(
      [track(main, 'gff3tabix_genes', 'LinearBasicDisplay', display)],
      [{ refName: 'ctgA', start: 0, end: 25000 }],
    ),
    `{ g <- genes_gff3tabix_genes; eden <- which(g$features$name == "EDEN")
  c(max(g$features$bottom) <= 100, "EDEN" %in% g$labels$text, sum(g$subfeatures$feature == eden)) }`,
  )
const fit = fitted({ heightMode: 'fit', height: 100 })
const grown = fitted({ heightMode: 'grow', height: 100 })

maybe('the emitted script, run under R', () => {
  beforeAll(() => {
    for (const [k, v] of runCases(cases)) {
      results.set(k, v)
    }
  }, 600_000)

  it('reads no reads from a contig the BAM lacks, without dying', () => {
    expect(results.get(absentContig)).toBe('[1] 0 0 0')
  })

  it('keeps the reads the display\u2019s filter keeps', () => {
    expect(results.get(filtered)).toBe(`[1] "${READ_NAME}" "1"`)
    const [only, onlySkips] = results.get(splicedOnly)!.slice(4).split(/\s+/)
    expect(Number(only)).toBeGreaterThan(0)
    expect(onlySkips).toBe(only)
    const [kept, keptSkips] = results
      .get(splicedExcluded)!
      .slice(4)
      .split(/\s+/)
    expect(Number(kept)).toBeGreaterThan(0)
    expect(keptSkips).toBe('0')
    expect(chainFilterNotes.join('\n')).not.toMatch(/filter/)
  })

  it('draws each of two regions as it draws that region alone', () => {
    for (const [i, name] of bothRegions.entries()) {
      const totals = results.get(name)!.slice(4).trim().split(/\s+/).map(Number)
      expect(totals.every(n => n > 0)).toBe(true)
      expect(results.get(name)).toBe(results.get(eachAlone[i]!))
    }
    expect(results.get(crossRegionTicks)).toBe('[1] TRUE TRUE TRUE TRUE')
  })

  ;(hasSamtools ? it : it.skip)(
    'ticks a spliced read with no MD tag where its MD tag would, under an aliased contig too',
    () => {
      const [withMd, withoutMd, aliased] = splicedTicks.map(n =>
        results.get(n)!,
      )
      expect(withMd?.split(' ').length).toBeGreaterThan(10)
      expect(withoutMd).toBe(withMd)
      expect(aliased).toBe(withMd)
    },
  )

  it('bands insert sizes in each region apart, as the browser samples them', () => {
    for (const [i, name] of pooledInsertClasses.entries()) {
      expect(results.get(name)).toMatch(/normalInsert/)
      expect(results.get(name)).toBe(results.get(aloneInsertClasses[i]!))
    }
  })

  it('draws a deletion inside its read', () => {
    expect(results.get(deletions)).toBe('[1] TRUE TRUE')
  })

  it('keeps two track ids that sanitise alike apart', () => {
    expect(results.get(collidingIds)).toBe('[1] TRUE TRUE')
  })

  it('reads a field named like an R keyword', () => {
    expect(results.get(reservedAttr)).toBe('[1] TRUE')
  })

  it('reads a BigWig whose URL hides its extension', () => {
    expect(results.get(presigned)).toBe('[1] TRUE')
  })

  it('colors categories by the browser\u2019s hash, value for value', () => {
    expect(results.get(colorOracle)).toBe('[1] 0')
    expect(results.get(barsColors)?.replaceAll(/\s+/g, ' ')).toBe(
      `EDEN.1 EDEN.3 "${categoricalValueColor('EDEN.1')}" "${categoricalValueColor('EDEN.3')}"`,
    )
  })

  it('draws rows for every readable track in the marks config', () => {
    const empty = [...everyMark]
      .filter(([trackId]) => !NEEDS_JEXL_FORMULA.has(trackId))
      .filter(
        ([, name]) => !(Number(results.get(name)?.replace('[1] ', '')) > 0),
      )
      .map(([trackId]) => `${trackId}: ${results.get(everyMark.get(trackId)!)}`)
    expect(empty).toEqual([])
  })

  it('paints reads in the strand colors the browser does', () => {
    const wanted = [colorFwdStrand, colorRevStrand]
      .map(c => c.toLowerCase())
      .sort()
    expect(results.get(strandColors)?.toLowerCase()).toBe(
      `[1] ${wanted.map(c => `"${c}"`).join(' ')}`,
    )
  })

  it('paints MAPQ in the browser\u2019s bins, keyed from high to low', () => {
    const { range, labels } = colorEncodingOf(
      {
        value: undefined,
        field: 'mapq',
        scale: undefined,
        domain: [],
        range: [],
      },
      { mapq: MEASURE_FIELD_PRESETS.mapq },
    ) as { range: string[]; labels: string[] }
    const hex = (rgb: string) =>
      `#${rgb
        .match(/\d+/g)!
        .map(n => Number(n).toString(16).padStart(2, '0'))
        .join('')}`
    // the key lists the bins the reads fall in, highest first
    const wanted = [
      `25 ${hex(range[2]!)}`,
      `37 ${hex(range[3]!)}`,
      labels[3],
      labels[2],
    ]
    expect(results.get(mapqBins)).toBe(`[1] "${wanted.join('|')}"`)
  })

  it('draws a mark whose type the config leaves at its default', () => {
    expect(
      Number(results.get(defaultMark)?.replace('[1] ', '')),
    ).toBeGreaterThan(0)
  })

  it('names a variant by the browser\u2019s sequence-ontology term', () => {
    expect(results.get(variantTypes)).toBe(
      '[1] "deletion 2|insertion 2|SNV 41"',
    )
  })

  it('reads a tabix file through the index its adapter names', () => {
    expect(results.get(renamedIndex)).toBe('[1] TRUE')
  })

  it('cuts insert sizes at the domain the config lists', () => {
    expect(results.get(insertCuts)).toBe('[1] TRUE TRUE TRUE TRUE TRUE')
  })

  it('draws a value its shape domain leaves unlisted', () => {
    expect(results.get(pointsShapes)).not.toContain('<NA>')
  })

  it('draws the default wiggle display as bars in the pos/neg pair', () => {
    expect(
      Number(results.get(wiggleBarRows)?.replace('[1] ', '')),
    ).toBeGreaterThan(0)
    expect(results.get(wiggleBar)).toBe('[1] "#0068d1" "#e01e26"')
  })

  it('draws a wiggle line, heatmap and plain color', () => {
    expect(results.get(wiggleLine)).toBe('[1] "#0068d1" "#e01e26"')
    expect(results.get(wiggleHeat)).toBe('[1] TRUE')
    expect(results.get(wigglePlain)).toBe('[1] "#006400"')
  })

  it('reads a BigBed as the same records its BED12 source holds', () => {
    expect(results.get(bigBedReader)).toBe('[1] TRUE TRUE')
  })

  it('groups a BigBed’s transcripts into genes by its aggregate field', () => {
    expect(results.get(bigBedGenes)).toBe('[1] 2 1 3')
  })

  it('groups a BigBed gene in each of two regions apart', () => {
    expect(results.get(bigBedTwoRegions)).toBe('[1] 1 3 1 1 3 1')
  })

  it('paints a BED record its own color where the track sets none', () => {
    expect(results.get(bedOwnColor)).toBe('[1] "#ff0000 2"')
    expect(results.get(bedSetColor)).toBe('[1] "#800080 1"')
  })

  it('lays out every isoform, and labels by name || id', () => {
    expect(results.get(sharedExons)).toBe(
      '[1] "tx1"          "tx2"          "g1"           "g2"           "kinase thing"',
    )
  })

  it('stacks a feature, a multi-BigWig and an alignments track over two regions', () => {
    expect(results.get(stack)).toBe('[1] 1 2 2')
  })

  it('fits a feature track to the height the view gives it, as the browser does', () => {
    expect(results.get(fit)).toBe('[1] 1 0 1')
    expect(results.get(grown)).toBe('[1] 0 1 3')
  })

  it('keeps a gene seen in two regions apart in each', () => {
    expect(results.get(twoRegionGene)).toBe('[1] 1 1 0 2')
  })
})
