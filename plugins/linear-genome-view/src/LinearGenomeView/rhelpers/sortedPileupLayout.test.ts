import { execFileSync, spawnSync } from 'node:child_process'
import { join } from 'node:path'

// sorted_pileup_layout is pure base R (no Bioconductor), so it can be unit
// tested directly against Rscript — no BAM, no packages, milliseconds per case.
// This is the payoff of the helpers being real .R files: the sort's ordering
// rules are checked head-on rather than inferred from a rendered figure.
const HAVE_R =
  spawnSync('Rscript', ['-e', 'cat(1)'], { encoding: 'utf8' }).status === 0
const maybe = HAVE_R ? test : test.skip

// Run `body` with the helper sourced, and return what it cat()s.
function runR(body: string) {
  const helper = JSON.stringify(join(__dirname, 'sorted_pileup_layout.R'))
  return execFileSync(
    'Rscript',
    ['-e', `sys.source(${helper}, envir = globalenv())\n${body}`],
    { encoding: 'utf8' },
  ).trim()
}

// n reads all spanning the sort column at 100, so they all collide there and the
// sort decides their row order outright.
const READS = (n: number, extra = '') =>
  `reads <- data.frame(start = rep(90L, ${n}), end = rep(110L, ${n}),
     strand = rep("+", ${n})${extra ? `, ${extra}` : ''}, stringsAsFactors = FALSE)`

maybe(
  'base sort ranks a deletion first, then ACGT, reference-matching last',
  () => {
    // JBrowse's buildSortKeyMap keys on the read's char at sortPos and sorts
    // ascending by ASCII: '*' (42) < A (65) < C (67) < G (71) < T (84); a read
    // matching the reference has no key and sorts last (sortByMapWithUnknownsLast)
    const out = runR(`${READS(4)}
mm <- data.frame(read_index = c(1L, 2L), refpos = 100L, base = c("T", "A"),
                 stringsAsFactors = FALSE)
indels <- data.frame(read_index = 3L, refpos = 95L, length = 10L, type = "D",
                     stringsAsFactors = FALSE)
r <- sorted_pileup_layout(reads, 100, "base", mm, indels)
cat(r$row, "\\n")`)
    // read 1 = T, read 2 = A, read 3 = deletion, read 4 = reference match
    // rows:     3rd      2nd      1st            4th
    expect(out).toBe('3 2 1 4')
  },
)

maybe('a mismatch on a filtered-out read does not break the base sort', () => {
  // Regression: mm keeps every read's rows (dropping them would desync the
  // read_index join), so a mismatch can belong to a read "Filter by" rejected.
  // That read is absent from `ov`, so match() yields NA — and R errors on an NA
  // subscript assignment once the assigned vector is longer than 1. The default
  // flag_exclude of 1540 always applies, so a marked duplicate carrying a
  // mismatch at the sort column was enough to kill the whole generated script.
  const out = runR(`${READS(3, 'keep = c(TRUE, TRUE, FALSE)')}
mm <- data.frame(read_index = c(1L, 2L, 3L), refpos = 100L,
                 base = c("T", "A", "G"), stringsAsFactors = FALSE)
r <- sorted_pileup_layout(reads, 100, "base", mm, NULL)
cat(r$row[1], r$row[2], is.na(r$row[3]), "\\n")`)
  // the two surviving reads still rank by base (A before T), and the filtered
  // read keeps an NA row so ggplot omits it
  expect(out).toBe('2 1 TRUE')
})

maybe('interbase sorts rank by length at the column, longest first', () => {
  // JBrowse's buildSortKeyMap keys insertion/softclip/hardclip on the event's
  // length AT sortPos with desc = TRUE, and sortByMapWithUnknownsLast leaves
  // reads carrying no such event at the bottom in genomic order.
  const out = runR(`${READS(4)}
indels <- data.frame(read_index = c(1L, 2L, 3L), refpos = c(100L, 100L, 100L),
                     length = c(5L, 30L, 12L), type = c("I", "I", "I"),
                     stringsAsFactors = FALSE)
r <- sorted_pileup_layout(reads, 100, "insertion", NULL, indels)
cat(r$row, "\\n")`)
  // lengths 5, 30, 12 -> rows 3rd, 1st, 2nd; read 4 has no insertion -> last
  expect(out).toBe('3 1 2 4')
})

maybe('an interbase sort only keys events exactly at the sort column', () => {
  // the interbase position is an exact column (a left clip sits on the read's
  // first aligned base, a right clip just past its last) — unlike the base
  // sort's deletion, which is a span test. A clip elsewhere must not rank.
  const out = runR(`${READS(3)}
clips <- data.frame(read_index = c(1L, 2L, 3L), pos = c(100L, 90L, 100L),
                    type = c("S", "S", "H"), length = c(8L, 99L, 40L),
                    stringsAsFactors = FALSE)
r <- sorted_pileup_layout(reads, 100, "softclip", NULL, NULL, clips)
cat(r$row, "\\n")`)
  // only read 1 has a soft clip at 100 (read 2's is at another column, read 3's
  // is a hard clip) -> read 1 first, the rest keep genomic order behind it
  expect(out).toBe('1 2 3')
})

maybe('the tag sort is numeric-descending when every value is a number', () => {
  const out = runR(`${READS(4, 'sort_tag = c("2", "10", "", "9")')}
r <- sorted_pileup_layout(reads, 100, "tag")
cat(r$row, "\\n")`)
  // JBrowse sorts descending with a missing tag counting as 0 (not "last"):
  // 10 > 9 > 2 > "" -> rows 3rd, 1st, 4th, 2nd. "10" must beat "9" numerically —
  // a string sort would rank "9" first.
  expect(out).toBe('3 1 4 2')
})

maybe(
  'the tag sort falls back to string-descending for non-numeric values',
  () => {
    // a single numeric-looking value must not put a column of string tags into
    // numeric mode (which would compare them all as NaN)
    const out = runR(`${READS(3, 'sort_tag = c("apple", "zebra", "7")')}
r <- sorted_pileup_layout(reads, 100, "tag")
cat(r$row, "\\n")`)
    // descending by collation: zebra > apple > 7
    expect(out).toBe('2 1 3')
  },
)
