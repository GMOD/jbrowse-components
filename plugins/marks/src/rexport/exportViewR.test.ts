import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  categoricalPalette,
  categoricalValueColor,
} from '@jbrowse/core/ui/colors'
import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'

import { exportTracksToR } from './exportView.ts'
import { HELPERS } from './rHelpers.generated.ts'
import {
  REGIONS,
  VOLVOX,
  configTracks,
  hasR,
  runCases,
  track,
} from './testFixtures.ts'

import type { RExportTrack } from './exportView.ts'
import type { Region } from './rScript.ts'
import type { RCase } from './testFixtures.ts'

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

const strandColours = register(
  'strand_colours',
  scriptFor([
    track(main, 'volvox_alignments', 'LinearAlignmentsDisplay', {
      color: { field: 'strand' },
    }),
  ]),
  'sort(unique(ggplot_build(pileup_volvox_alignments)$data[[1]]$fill))',
)

function wiggle(display: Record<string, unknown>) {
  return scriptFor(
    [track(main, 'wiggle_track_posneg', 'LinearWiggleDisplay', display)],
    [{ refName: 'ctgA', start: 0, end: 50000 }],
  )
}

const layerRows = 'nrow(ggplot_build(p_wiggle_track_posneg)$data[[1]])'
const layerColours = (aes: string) =>
  `sort(unique(ggplot_build(p_wiggle_track_posneg)$data[[1]]$${aes}))`

const wiggleBar = register('wiggle_bar', wiggle({}), layerColours('fill'))
const wiggleBarRows = register('wiggle_bar_rows', wiggle({}), layerRows)
const wiggleLine = register(
  'wiggle_line',
  wiggle({ mark: 'line' }),
  layerColours('colour'),
)
const wiggleHeat = register(
  'wiggle_heatmap',
  wiggle({ mark: 'heatmap' }),
  `length(unique(ggplot_build(p_wiggle_track_posneg)$data[[1]]$fill)) > 2`,
)
const wigglePlain = register(
  'wiggle_plain',
  wiggle({ color: 'darkgreen' }),
  layerColours('fill'),
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
const colourOracle = register(
  'colour_oracle',
  `${HELPERS.category_values}
vals <- c(${strings.map(v => JSON.stringify(v)).join(', ')})
pal <- c(${categoricalPalette.map(c => JSON.stringify(c)).join(', ')})
expected <- c(${strings.map(v => JSON.stringify(categoricalValueColor(v))).join(', ')})
`,
  'sum(unname(category_values(vals, pal)[vals]) != expected)',
)

const barsColours = register(
  'bars_colours',
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

  it('colours categories by the browser\u2019s hash, value for value', () => {
    expect(results.get(colourOracle)).toBe('[1] 0')
    expect(results.get(barsColours)?.replaceAll(/\s+/g, ' ')).toBe(
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

  it('paints reads in the strand colours the browser does', () => {
    const wanted = [colorFwdStrand, colorRevStrand]
      .map(c => c.toLowerCase())
      .sort()
    expect(results.get(strandColours)?.toLowerCase()).toBe(
      `[1] ${wanted.map(c => `"${c}"`).join(' ')}`,
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

  it('draws a wiggle line, heatmap and plain colour', () => {
    expect(results.get(wiggleLine)).toBe('[1] "#0068d1" "#e01e26"')
    expect(results.get(wiggleHeat)).toBe('[1] TRUE')
    expect(results.get(wigglePlain)).toBe('[1] "darkgreen"')
  })
})
