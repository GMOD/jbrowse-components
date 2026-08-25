// Fails when something that opts into the region-too-large gate has not made a
// deliberate decision about the byte budget it is measured against — an adapter
// implementing `getRegionByteSize`, or a display overriding `gateEnabled`. See
// agent-docs/reference/REGION_TOO_LARGE.md.
//
// The budget comes from `resolveByteLimit`: the adapter's own `fetchSizeLimit`
// slot if it declares one, otherwise whatever the *display* it lands under
// configures. Inheriting is a legitimate choice; inheriting *by accident* is how
// all three known gaps happened — `SplitVcfTabixAdapter` gated five times tighter
// than the single-file VCF beside it, multi-row sat on the base 1 Mb while
// `LinearBasicDisplay` read the same files at 5 Mb, and `LinearMafDisplay` sat
// there with no adapter declaring one and no density axis behind it. None is
// visible without reading two schemas together, which is what this automates.
//
// Two halves, because the third gap got past the first one: the adapter half
// accepts "inherits the display's" as an answer, and until 2026-08-14 nothing
// then asked WHICH display.
//
// The baseline is the budget table in prose form, and updating it is the point:
// a new gated adapter fails here until someone writes down which budget it gets.
// `--write` regenerates it. The display half's list is hand-edited, for the same
// reason.
//
// The scan itself is `gatedBudgets.ts`, shared with the doc generator that
// renders the same numbers into REGION_TOO_LARGE.md — so the table cannot say
// one thing while this check enforces another.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  DISPLAY_TIERS,
  GATE_OPT_IN_SITES,
  collectGateOptInSites,
  collectGatedAdapterBudgets,
  root,
} from './gatedBudgets.ts'

const baselinePath = join(root, 'scripts', 'gatedAdapterBudgets.json')

const sorted = collectGatedAdapterBudgets()

if (process.argv.includes('--write')) {
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(
    `wrote ${relative(root, baselinePath)}: ${Object.keys(sorted).length} gated adapters`,
  )
  process.exit(0)
}

const baseline: Record<string, string> = JSON.parse(
  readFileSync(baselinePath, 'utf8'),
)

const added = Object.keys(sorted).filter(k => !(k in baseline))
const removed = Object.keys(baseline).filter(k => !(k in sorted))
const changed = Object.keys(sorted).filter(
  k => k in baseline && baseline[k] !== sorted[k],
)

if (added.length || removed.length || changed.length) {
  const lines = [
    ...added.map(
      k =>
        `  + ${k} is byte-gated and not in the baseline. It resolves to ${
          sorted[k] === 'display'
            ? "the DISPLAY's fetchSizeLimit, which differs per display (1 Mb base, 5 Mb LinearBasicDisplay / LinearMultiRowFeatureDisplay). Declare a fetchSizeLimit slot on the adapter if that is wrong for this format"
            : `${sorted[k]}`
        }.`,
    ),
    ...removed.map(k => `  - ${k} no longer implements getRegionByteSize.`),
    ...changed.map(k => `  ~ ${k}: ${baseline[k]} -> ${sorted[k]}`),
  ]
  console.error(
    `Gated-adapter byte budgets changed.\n\n${lines.join(
      '\n',
    )}\n\nAn adapter implementing getRegionByteSize is byte-gated, so its budget has to be a\nchoice rather than whatever display it lands under. Decide, then run:\n  node --experimental-strip-types scripts/check-gated-adapter-budgets.ts --write\nSee agent-docs/reference/REGION_TOO_LARGE.md.\n`,
  )
  process.exit(1)
}

// The other half of the same question, and the one nobody was asking: a gated
// adapter may answer "display", and until 2026-08-14 nothing then asked WHICH
// display. `LinearMafDisplay` sat on the base 1 Mb — no MAF adapter declares a
// limit and MAF has no density axis behind it — and bannered an ordinary hg38
// 100-way at a gene-sized window. Same shape as the two adapter-side gaps above,
// one level up.
//
// Sites rather than display names, because a display's opt-in is routinely not
// in a directory named for it: two are shared mixins and canvas's covers three
// displays. `gatedBudgets.ts` says why guessing the name is worse than useless.
const sites = collectGateOptInSites()
const recorded = Object.keys(GATE_OPT_IN_SITES)
const newSites = sites.filter(s => !recorded.includes(s))
const goneSites = recorded.filter(s => !sites.includes(s))

if (newSites.length || goneSites.length) {
  console.error(
    `Byte-gate opt-in sites changed.\n\n${[
      ...newSites.map(
        s =>
          `  + ${s} opts a display into the byte gate. Which display, and what budget does it resolve to? A display declaring no fetchSizeLimit inherits the base 1 Mb, which is the tightest in the system.`,
      ),
      ...goneSites.map(s => `  - ${s} no longer opts into the byte gate.`),
    ].join(
      '\n',
    )}\n\nRecord it in GATE_OPT_IN_SITES (scripts/gatedBudgets.ts), and add the display to\nDISPLAY_TIERS if its own budget can bind — an adapter-declared limit outranks it.\nSee agent-docs/reference/REGION_TOO_LARGE.md.\n`,
  )
  process.exit(1)
}

// A row pointing at a display tier that doesn't exist would read as recorded
// while naming nothing.
const tierNames = new Set(DISPLAY_TIERS.map(t => t.name))
const danglingTier = Object.entries(GATE_OPT_IN_SITES).filter(
  ([, note]) =>
    note.startsWith('Linear') && !tierNames.has(note.split(' ')[0]!),
)
if (danglingTier.length) {
  console.error(
    `GATE_OPT_IN_SITES names a display with no DISPLAY_TIERS row:\n${danglingTier
      .map(([site, note]) => `  ${site} -> ${note}`)
      .join('\n')}\n`,
  )
  process.exit(1)
}

console.log(
  `${Object.keys(sorted).length} gated adapters and ${sites.length} display opt-in sites, all budgets declared`,
)
