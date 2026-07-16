import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { alignmentsFragments } from './exportRCode.ts'
import { makePileupData } from '../RenderAlignmentDataRPC/sortLayout.fixture.ts'
import { computeSortedLayout } from '../RenderAlignmentDataRPC/sortLayout.ts'

import type { Read } from '../RenderAlignmentDataRPC/sortLayout.fixture.ts'
import type { SortedBy } from '../shared/types.ts'

// Cross-implementation equivalence: run JBrowse's *actual* computeSortedLayout
// and the *actual* emitted R sorted_pileup_layout over identical reads and
// assert they order them the same. Codegen string checks can't catch a semantic
// drift here — and the sort rules are subtle enough to invite one: unknowns sort
// last for base/interbase but not for tag, interbase keys are exact-column and
// longest-first, and tag values only go numeric when every value parses.
//
// Every read spans the sort column, so each takes its own row and the row
// assignment *is* the sort order. That also sidesteps the one intended
// difference between the two layouts: JBrowse's placeRect leaves a 2bp gap
// between reads sharing a row, the R helper packs on strict overlap.
// sorted_pileup_layout is pure base R, so this needs no Bioconductor.
const HAVE_R =
  spawnSync('Rscript', ['-e', 'cat(1)'], { encoding: 'utf8' }).status === 0
const maybe = HAVE_R ? test : test.skip

const SORT_POS = 100
const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-sorteq-'))

// The helper definitions exactly as a real exported script carries them.
function emittedHelpers(sortType: string, sortTag?: string) {
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 200 }, [
    alignmentsFragments({
      trackId: 'aln',
      trackName: 'reads',
      uri: '/tmp/x.bam',
      showCoverage: false,
      showPileup: true,
      colorBy: 'normal',
      showLowFreqMismatches: false,
      modificationThreshold: 0.1,
      linkReads: false,
      isCram: false,
      reference: '',
      bpPerPx: 1,
      sortType: sortType as never,
      sortPos: SORT_POS,
      sortTag,
    })[0]!,
  ])
  return script.split('# Data sources')[0]!
}

// R rows (1-based) for the given reads, from the emitted helper.
function rLayout(
  reads: Read[],
  sortType: string,
  extra: string,
  sortTag?: string,
) {
  const df = (col: string, vals: string[]) => `${col} = c(${vals.join(', ')})`
  const cols = [
    df(
      'start',
      reads.map(r => String(r.start)),
    ),
    df(
      'end',
      reads.map(r => String(r.end)),
    ),
    df(
      'strand',
      reads.map(() => '"+"'),
    ),
  ]
  if (sortTag) {
    cols.push(
      df(
        'sort_tag',
        reads.map(r => JSON.stringify(r.tagValue ?? '')),
      ),
    )
  }
  const script = `${emittedHelpers(sortType, sortTag)}
reads <- data.frame(${cols.join(', ')}, stringsAsFactors = FALSE)
${extra}
r <- sorted_pileup_layout(reads, ${SORT_POS}, "${sortType}"${
    sortType === 'base'
      ? ', mm, indels'
      : sortType === 'insertion'
        ? ', NULL, indels'
        : sortType === 'softclip' || sortType === 'hardclip'
          ? ', NULL, NULL, clips'
          : ''
  })
cat(r$row, "\\n")`
  const path = join(dir, `${sortType}-${Math.random().toString(36).slice(2)}.R`)
  writeFileSync(path, script)
  return execFileSync('Rscript', [path], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
    .map(Number)
}

// JBrowse rows (0-based) for the same reads.
function jsLayout(reads: Read[], sortedBy: SortedBy) {
  const data = makePileupData({ regionStart: 0, reads, sortPos: SORT_POS })
  return [...computeSortedLayout(data, sortedBy).readYs]
}

function sortedBy(type: string, tag?: string): SortedBy {
  return { type, pos: SORT_POS, refName: 'ctgA', assemblyName: 'volvox', tag }
}

// R rows are 1-based, JBrowse's are 0-based; compare the resulting orders.
function expectSameOrder(rRows: number[], jsRows: number[]) {
  expect(rRows.map(r => r - 1)).toEqual(jsRows)
}

const span = (n: number) =>
  Array.from({ length: n }, () => ({ start: 90, end: 110 }))

maybe('base sort matches JBrowse read-for-read', () => {
  const reads: Read[] = [
    { start: 90, end: 110, baseAtSortPos: 'T' },
    { start: 90, end: 110, baseAtSortPos: 'A' },
    { start: 90, end: 110 }, // reference match — no key, sorts last
    { start: 90, end: 110, baseAtSortPos: 'C' },
  ]
  const r = rLayout(
    reads,
    'base',
    `mm <- data.frame(read_index = c(1L, 2L, 4L), refpos = ${SORT_POS},
       base = c("T", "A", "C"), stringsAsFactors = FALSE)
indels <- NULL`,
  )
  expectSameOrder(r, jsLayout(reads, sortedBy('basePair')))
})

maybe('insertion sort matches JBrowse read-for-read', () => {
  const reads: Read[] = [
    { ...span(1)[0]!, insertion: { pos: SORT_POS, length: 5 } },
    { ...span(1)[0]!, insertion: { pos: SORT_POS, length: 30 } },
    { ...span(1)[0]! }, // no insertion — sorts last
    { ...span(1)[0]!, insertion: { pos: SORT_POS, length: 12 } },
  ]
  const r = rLayout(
    reads,
    'insertion',
    `indels <- data.frame(read_index = c(1L, 2L, 4L), refpos = ${SORT_POS},
       length = c(5L, 30L, 12L), type = "I", stringsAsFactors = FALSE)`,
  )
  expectSameOrder(r, jsLayout(reads, sortedBy('insertion')))
})

maybe('softclip sort matches JBrowse, including an off-column clip', () => {
  // read 3's clip is at another column: JBrowse keys interbases on an exact
  // position match, so it must rank as "no clip" in both implementations
  const reads: Read[] = [
    { ...span(1)[0]!, softclip: { pos: SORT_POS, length: 8 } },
    { ...span(1)[0]!, softclip: { pos: SORT_POS, length: 40 } },
    { ...span(1)[0]!, softclip: { pos: 90, length: 99 } },
    { ...span(1)[0]! },
  ]
  const r = rLayout(
    reads,
    'softclip',
    `clips <- data.frame(read_index = c(1L, 2L, 3L), pos = c(${SORT_POS}, ${SORT_POS}, 90L),
       length = c(8L, 40L, 99L), type = "S", stringsAsFactors = FALSE)`,
  )
  expectSameOrder(r, jsLayout(reads, sortedBy('softclip')))
})

maybe('tag sort matches JBrowse in numeric mode', () => {
  // "10" must beat "9" — a string sort would invert them — and a missing tag
  // counts as 0 rather than sorting last
  const reads: Read[] = [
    { ...span(1)[0]!, tagValue: '2' },
    { ...span(1)[0]!, tagValue: '10' },
    { ...span(1)[0]!, tagValue: '' },
    { ...span(1)[0]!, tagValue: '9' },
  ]
  const r = rLayout(reads, 'tag', '', 'HP')
  expectSameOrder(r, jsLayout(reads, sortedBy('tag', 'HP')))
})

maybe('tag sort matches JBrowse in string mode', () => {
  // one numeric-looking value must not flip the column into numeric mode
  const reads: Read[] = [
    { ...span(1)[0]!, tagValue: 'apple' },
    { ...span(1)[0]!, tagValue: 'zebra' },
    { ...span(1)[0]!, tagValue: '7' },
  ]
  const r = rLayout(reads, 'tag', '', 'BC')
  expectSameOrder(r, jsLayout(reads, sortedBy('tag', 'BC')))
})
