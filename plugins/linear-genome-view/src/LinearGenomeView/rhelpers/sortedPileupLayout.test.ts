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
