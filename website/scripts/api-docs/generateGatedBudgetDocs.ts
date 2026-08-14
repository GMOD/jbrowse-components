import {
  collectDisplayBudgets,
  collectGatedAdapterBudgets,
} from '../../../scripts/gatedBudgets.ts'
import { markdownTable, rewriteMarkerBlock } from './util.ts'

// The byte budget each gated adapter is measured against, rendered into
// REGION_TOO_LARGE.md from the two schemas that decide it.
//
// It was three hand-written rows, and it went stale the way a transcribed number
// always does: CRAM's own `fetchSizeLimit` moved from 3 Mb to 5 Mb and the table
// kept saying 3, as did `LinearBasicDisplay`'s slot comment — which is itself a
// generated doc, so the stale number reached website/docs too. The prose around
// the table is the part worth writing by hand; the numbers are not.
//
// Reads the same scan as `scripts/check-gated-adapter-budgets.ts`, so the table
// and the CI check cannot disagree about which adapters are gated.

// Bytes as the docs quote them. Every budget in play is a whole number of Mb;
// anything else renders exactly rather than being rounded into a wrong claim.
function mb(bytes: number) {
  return bytes % 1_000_000 === 0
    ? `${bytes / 1_000_000} Mb`
    : `${bytes.toLocaleString('en-US')} bytes`
}

export function writeGatedBudgetDocs({ check = false } = {}) {
  const adapters = collectGatedAdapterBudgets()
  const displays = collectDisplayBudgets()

  const own = Object.entries(adapters).filter(([, b]) => b !== 'display')
  const inherits = Object.keys(adapters).filter(k => adapters[k] === 'display')

  if (!own.length || !inherits.length) {
    throw new Error(
      `the gated-adapter scan found ${own.length} adapters declaring a budget and ${inherits.length} inheriting one — the table is about the split between them, so an empty side means the scan broke rather than that the split went away`,
    )
  }

  // Grouped by value, not one row per adapter: the table's job is the split
  // between the tiers, and four identical rows bury it.
  const byValue = new Map<number, string[]>()
  for (const [name, budget] of own) {
    const bytes = Number(budget.replace('own:', ''))
    byValue.set(bytes, [...(byValue.get(bytes) ?? []), name])
  }

  return rewriteMarkerBlock(
    'GATED_BUDGETS',
    [
      markdownTable(
        ['tier', 'value', 'applies to'],
        [
          ...[...byValue.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(
              ([bytes, names]) =>
                `| adapter slot | ${mb(bytes)} | ${names
                  .map(n => `\`${n}\``)
                  .join(', ')} — whatever display they are under |`,
            ),
          ...displays.map(
            d =>
              `| display slot | ${mb(d.bytes)} | \`${d.name}\` — ${d.applies} |`,
          ),
        ],
      ),
      '',
      `Adapters with no \`fetchSizeLimit\` of their own, which therefore take whichever display row applies: ${inherits
        .map(n => `\`${n}\``)
        .join(', ')}.`,
    ].join('\n'),
    { check },
  )
}
