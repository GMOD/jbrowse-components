import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  categoricalPalette,
  categoricalValueColor,
} from '@jbrowse/core/ui/colors'
import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'

import {
  REGIONS,
  VOLVOX,
  configTracks,
  hasR,
  runCases,
  track,
} from './exportView.fixture.ts'
import { exportTracksToR } from './exportView.ts'
import { HELPERS } from './rHelpers.generated.ts'
import { PANEL_WIDTH_INCHES } from './rScript.ts'

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
  'c(nrow(reads_volvox_alignments), nrow(depth_volvox_alignments), nrow(mismatches_volvox_alignments))',
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
  `{ r <- reads_volvox_sv; t <- abs(r$template_length)
  c(all(r$insertSize[t > 600] == "long"), all(r$insertSize[t > 0 & t < 300] == "short"),
    all(r$insertSize[t >= 300 & t <= 600] == "normal"), sum(t > 600) > 0, sum(t > 0 & t < 300) > 0) }`,
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
  'nrow(genes_gff3tabix_genes) > 0',
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
  'table(df_marks_variants$type)',
)

function wiggle(display: Record<string, unknown>) {
  return scriptFor(
    [track(main, 'wiggle_track_posneg', 'LinearWiggleDisplay', display)],
    [{ refName: 'ctgA', start: 0, end: 50000 }],
  )
}

const layerRows = 'nrow(ggplot_build(p_wiggle_track_posneg)$data[[1]])'
const layerColors = (aes: string) =>
  `sort(unique(ggplot_build(p_wiggle_track_posneg)$data[[1]]$${aes}))`

const wiggleBar = register('wiggle_bar', wiggle({}), layerColors('fill'))
const wiggleBarRows = register('wiggle_bar_rows', wiggle({}), layerRows)
const wiggleLine = register(
  'wiggle_line',
  wiggle({ mark: 'line' }),
  layerColors('colour'),
)
const wiggleHeat = register(
  'wiggle_heatmap',
  wiggle({ mark: 'heatmap' }),
  `length(unique(ggplot_build(p_wiggle_track_posneg)$data[[1]]$fill)) > 2`,
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
  `{ g <- genes_bigbed_genes; eden <- g$id[g$type == "gene" & g$name == "EDEN"]
  c(sum(g$type == "gene"), length(eden), sum(g$type == "mRNA" & g$parent %in% eden)) }`,
)

const denseLabels = register(
  'dense_labels',
  scriptFor(
    [track(main, 'gff3tabix_genes', 'LinearBasicDisplay', {})],
    [{ refName: 'ctgA', start: 0, end: 24000 }],
  ),
  `{ png(tempfile(), width = 1500, height = 500, res = 150)
  l <- genes_gff3tabix_genes_lanes
  bp <- 24000 / ${PANEL_WIDTH_INCHES}
  w <- function(s) strwidth(s, units = "inches", cex = 3 * ggplot2::.pt / par("ps")) * bp
  text <- rbind(
    with(l[!is.na(l$label), ], data.frame(y = y, x0 = start, x1 = start + w(label))),
    with(l[!is.na(l$description), ], data.frame(y = description_y, x0 = start, x1 = start + w(description))))
  text$x0 <- pmax(text$x0, 0)
  clashes <- sum(vapply(split(text, text$y), function(t) {
    t <- t[order(t$x0), ]
    sum(t$x0[-1] < t$x1[-nrow(t)])
  }, 0))
  c(clashes, nrow(text) > 40) }`,
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
const fillsOf = `{ p <- genes_rgb_parts; l <- genes_rgb_lanes
  name <- l$name[match(p$lane, l$id)]
  paste(unique(p$fill[name == "red"]), length(unique(p$fill[name == "plain"]))) }`
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
  `{ p <- genes_multi_parts; l <- genes_multi_lanes
  tx2 <- p[p$lane == "tx2", ]
  c(sum(tx2$part == "CDS"), sum(tx2$part == "box"), na.omit(l$label), na.omit(l$description)) }`,
)
const twoRegionGene = register(
  'two_region_gene',
  multiGffScript([
    { refName: 'ctgA', start: 900, end: 1600 },
    { refName: 'ctgA', start: 3900, end: 5100 },
  ]),
  `{ p <- genes_multi_parts; r <- regions
  inside <- p$start >= r$cum_start[p$.region] & p$end <= r$cum_end[p$.region]
  cds <- p[p$part == "CDS", ]
  genomic <- cds$start - r$offset[cds$.region] + r$start[cds$.region]
  c(all(inside), sum(p$part == "box"), any(genomic >= 2000 & genomic < 2500), sum(genes_multi_lanes$lane == 0)) }`,
)

maybe('the emitted script, run under R', () => {
  beforeAll(() => {
    for (const [k, v] of runCases(cases)) {
      results.set(k, v)
    }
  }, 600_000)

  it('reads no reads from a contig the BAM lacks, without dying', () => {
    expect(results.get(absentContig)).toBe('[1] 0 0 0')
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

  it('draws a mark whose type the config leaves at its default', () => {
    expect(
      Number(results.get(defaultMark)?.replace('[1] ', '')),
    ).toBeGreaterThan(0)
  })

  it('names a variant by the browser\u2019s sequence-ontology term', () => {
    expect(results.get(variantTypes)?.replaceAll(/\s+/g, ' ')).toBe(
      'deletion insertion SNV 2 2 41',
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
    expect(results.get(wigglePlain)).toBe('[1] "darkgreen"')
  })

  it('reads a BigBed as the same records its BED12 source holds', () => {
    expect(results.get(bigBedReader)).toBe('[1] TRUE TRUE')
  })

  it('groups a BigBed’s transcripts into genes by its aggregate field', () => {
    expect(results.get(bigBedGenes)).toBe('[1] 2 1 3')
  })

  it('keeps every label in a dense window clear of its neighbours', () => {
    expect(results.get(denseLabels)).toBe('[1] 0 1')
  })

  it('paints a BED record its own color where the track sets none', () => {
    expect(results.get(bedOwnColor)).toBe('[1] "#FF0000 2"')
    expect(results.get(bedSetColor)).toBe('[1] "purple 1"')
  })

  it('hangs an exon two isoforms share on both, and labels by name || id', () => {
    expect(results.get(sharedExons)).toBe(
      '[1] "2"            "0"            "g1"           "g2"           "kinase thing"',
    )
  })

  it('keeps a gene seen in two regions apart in each', () => {
    expect(results.get(twoRegionGene)).toBe('[1] 1 0 0 2')
  })
})
