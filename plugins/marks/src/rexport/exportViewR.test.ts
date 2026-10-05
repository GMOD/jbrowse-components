import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { exportTracksToR } from './exportView.ts'
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
