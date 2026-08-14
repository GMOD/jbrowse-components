// Which byte budget each gated adapter and each gating display resolves to,
// read out of the schemas rather than remembered.
//
// Two consumers, deliberately sharing one scan: `check-gated-adapter-budgets.ts`
// diffs the adapter half against `gatedAdapterBudgets.json` so a new gated
// adapter has to make a decision, and `generateGatedBudgetDocs.ts` renders both
// halves into REGION_TOO_LARGE.md's budget table. That table used to be
// hand-transcribed and went stale the moment CRAM's own limit moved from 3 Mb to
// 5 Mb — in two docs at once, one of them generated from a source comment that
// restated the number.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

export const root = join(import.meta.dirname, '..')

const workspaceDirs = ['packages', 'plugins', 'products']

// A method DECLARATION, not a call site: `dataAdapter.getRegionByteSize(...)`
// in the RPC workers must not count, or the gate's own callers would register
// as adapters.
const declaration = /^\s*(?:public\s+)?(?:async\s+)?getRegionByteSize\s*[(<]/m
// `fetchSizeLimit: { ... defaultValue: 123 ... }` inside a config schema
const slot = /fetchSizeLimit\s*:\s*\{[^}]*?defaultValue\s*:\s*([\d_]+)/s

// The base class declares the method as its `undefined` default — that IS the
// "no estimate, no gate" path, not an implementation of one.
const baseDefault = join(
  'packages',
  'core',
  'src',
  'data_adapters',
  'BaseAdapter',
  'BaseFeatureDataAdapter.ts',
)

function* sourceFiles(dir: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'esm' || entry === 'dist') {
      continue
    }
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path)
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      yield path
    }
  }
}

function declaredLimit(file: string) {
  try {
    const match = slot.exec(readFileSync(file, 'utf8'))
    return match ? Number(match[1]!.replaceAll('_', '')) : undefined
  } catch {
    return undefined
  }
}

/**
 * Adapter name -> `own:<bytes>` when it declares a `fetchSizeLimit`, else
 * `display` when it inherits whichever display it lands under. The shape the
 * baseline JSON is written in, so the check can diff it directly.
 */
export function collectGatedAdapterBudgets(): Record<string, string> {
  const found: Record<string, string> = {}
  for (const workspaceDir of workspaceDirs) {
    for (const file of sourceFiles(join(root, workspaceDir))) {
      if (relative(root, file) === baseDefault) {
        continue
      }
      if (!declaration.test(readFileSync(file, 'utf8'))) {
        continue
      }
      // Adapters live in a directory named for them, alongside their configSchema
      const dir = dirname(file)
      const limit = declaredLimit(join(dir, 'configSchema.ts'))
      found[basename(dir)] = limit === undefined ? 'display' : `own:${limit}`
    }
  }
  return Object.fromEntries(Object.entries(found).sort())
}

/**
 * The display tier an inheriting adapter falls through to. Hard-coded as a list
 * of schema *files* rather than discovered, because "which displays gate" is not
 * something a `fetchSizeLimit` slot answers — every display schema extends the
 * base one and so has the slot, gating or not. The three here are the ones
 * REGION_TOO_LARGE.md's table is about: the two that raise the budget, and the
 * base every other display inherits. Their *values* still come from the source.
 */
export const DISPLAY_TIERS = [
  {
    name: 'LinearBasicDisplay',
    file: 'plugins/canvas/src/LinearBasicDisplay/configSchema.ts',
    applies: 'every inheriting adapter under this display',
  },
  {
    name: 'LinearMultiRowFeatureDisplay',
    file: 'plugins/canvas/src/LinearMultiRowFeatureDisplay/configSchema.ts',
    applies: 'every inheriting adapter under this display',
  },
  {
    name: 'baseLinearDisplayConfigSchema',
    file: 'plugins/linear-genome-view/src/BaseLinearDisplay/models/configSchema.ts',
    applies: 'every inheriting adapter under every other display',
  },
]

export function collectDisplayBudgets() {
  return DISPLAY_TIERS.map(tier => {
    const bytes = declaredLimit(join(root, tier.file))
    if (bytes === undefined) {
      throw new Error(
        `${tier.file} declares no fetchSizeLimit defaultValue, so REGION_TOO_LARGE.md's budget table would render a display tier with no number. Either the slot moved or this display stopped configuring one.`,
      )
    }
    return { ...tier, bytes }
  })
}
