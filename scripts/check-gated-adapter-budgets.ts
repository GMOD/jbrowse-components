// Fails when an adapter that implements `getRegionByteSize` has not made a
// deliberate decision about the byte budget it is gated against.
//
// An adapter implementing that method opts into the region-too-large gate (see
// agent-docs/reference/REGION_TOO_LARGE.md). The budget it is compared against
// comes from `resolveByteLimit`: the adapter's own `fetchSizeLimit` slot if it
// declares one, otherwise whatever the *display* it happens to land under
// configures. Inheriting is a legitimate choice; inheriting *by accident* is
// how both 2026-08-06 bugs happened — `SplitVcfTabixAdapter` gated five times
// tighter than the single-file VCF beside it, and multi-row sat on the base
// 1 Mb while `LinearBasicDisplay` read the same files at 5 Mb. Neither is
// visible without reading two schemas together, which is what this automates.
//
// The baseline is the budget table in prose form, and updating it is the point:
// a new gated adapter fails here until someone writes down which budget it gets.
// `--write` regenerates it.
//
// The scan itself is `gatedBudgets.ts`, shared with the doc generator that
// renders the same numbers into REGION_TOO_LARGE.md — so the table cannot say
// one thing while this check enforces another.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { collectGatedAdapterBudgets, root } from './gatedBudgets.ts'

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

console.log(
  `${Object.keys(sorted).length} gated adapters, all budgets declared`,
)
