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

// Where the two opt-in getters are declared, as opposed to overridden.
const gateMixin = join(
  'plugins',
  'linear-genome-view',
  'src',
  'shared',
  'RegionTooLargeMixin.ts',
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

// A class declaration with a named parent, so the scan can walk `extends`
// chains: an adapter that only INHERITS a live `getRegionByteSize` is gated at
// a budget somebody has to have decided, exactly like one declaring its own.
const classDecl =
  /(?:^|\n)\s*(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?\s+extends\s+(\w+)/g

/**
 * Adapter name -> `own:<bytes>` when it declares a `fetchSizeLimit`, else
 * `display` when it inherits whichever display it lands under. The shape the
 * baseline JSON is written in, so the check can diff it directly.
 *
 * Declarations AND inheritors: matching only the method declaration missed
 * `GWASAdapter`, which extends `BedTabixAdapter` and so ships BedTabix's live
 * index estimate while appearing in no baseline — byte-gated at a budget
 * nobody ever decided, the exact decision this check exists to force. So the
 * scan also walks `class X extends Y` chains from every declaring class.
 */
export function collectGatedAdapterBudgets(): Record<string, string> {
  const declaringFiles: string[] = []
  const classes: { name: string; parent: string; file: string }[] = []
  for (const workspaceDir of workspaceDirs) {
    for (const file of sourceFiles(join(root, workspaceDir))) {
      const text = readFileSync(file, 'utf8')
      if (relative(root, file) !== baseDefault && declaration.test(text)) {
        declaringFiles.push(file)
      }
      for (const m of text.matchAll(classDecl)) {
        classes.push({ name: m[1]!, parent: m[2]!, file })
      }
    }
  }
  const declaringNames = new Set(
    classes.filter(c => declaringFiles.includes(c.file)).map(c => c.name),
  )
  // transitive closure over the parent links, to a fixpoint: a grandchild of a
  // declaring class inherits the estimate the same way a child does
  const liveFiles = new Set(declaringFiles)
  let grew = true
  while (grew) {
    grew = false
    for (const c of classes) {
      if (declaringNames.has(c.parent) && !declaringNames.has(c.name)) {
        declaringNames.add(c.name)
        liveFiles.add(c.file)
        grew = true
      }
    }
  }
  const found: Record<string, string> = {}
  for (const file of liveFiles) {
    // Adapters live in a directory named for them, alongside their configSchema
    const dir = dirname(file)
    const limit = declaredLimit(join(dir, 'configSchema.ts'))
    found[basename(dir)] = limit === undefined ? 'display' : `own:${limit}`
  }
  return Object.fromEntries(Object.entries(found).sort())
}

// A display opts into the byte gate by overriding this to true. Matched as a
// getter body rather than a mention, so the mixin's own default and the dozens
// of prose references to it don't count.
const displayOptIn =
  /get gateEnabled\s*\([^)]*\)\s*(?::[^{]+)?\{\s*return true\b/s

/**
 * Every file that opts a display into the byte gate, as repo-relative paths.
 *
 * **Sites, not display names, and that is the whole design.** The adapter scan
 * above can name its subject because an adapter lives in a directory called
 * after it; a display's opt-in routinely does not. Two of these are shared
 * mixins serving several displays each (`arc/shared`, `variants/shared`), and
 * canvas's covers three displays from a file named for none of them — so a
 * directory-name heuristic yields a row called `shared` and silently omits
 * `LinearBasicDisplay`. That is the "looks complete and is short" failure a
 * generated table is supposed to make impossible, so this reports what it can
 * actually see and {@link DISPLAY_TIERS} carries the names.
 *
 * The check diffs this against a recorded list, so a **new** gating display
 * fails until someone adds its budget to that table. The adapter half forces a
 * decision per gated adapter and accepts `display` as an answer, but nothing
 * then asked *which* display — which is how `LinearMafDisplay` sat on the base
 * 1 Mb, with no adapter declaring one and no density axis behind it, bannering
 * an ordinary hg38 100-way at a gene-sized window. Found by hand, not by this.
 */
export function collectGateOptInSites(): string[] {
  const found: string[] = []
  for (const workspaceDir of workspaceDirs) {
    for (const file of sourceFiles(join(root, workspaceDir))) {
      const rel = relative(root, file)
      // The mixin's own defaults are `return false`, so they don't match — but
      // exclude it outright rather than relying on that, since it is the one
      // file where these names are declared rather than overridden.
      if (rel === gateMixin) {
        continue
      }
      if (displayOptIn.test(readFileSync(file, 'utf8'))) {
        found.push(rel)
      }
    }
  }
  return found.sort()
}

/**
 * The display tier an inheriting adapter falls through to. Hard-coded as a list
 * of schema *files* rather than discovered, because "which displays gate" is not
 * something a `fetchSizeLimit` slot answers — every display schema extends the
 * base one and so has the slot, gating or not. Their *values* come from the
 * source, so the numbers cannot drift; only membership is written down.
 *
 * Every display named by a `collectGateOptInSites` entry belongs here, plus the
 * base every other display inherits. That pairing is what the check enforces: a
 * new opt-in site fails until its display's budget is recorded, which is the
 * question nobody asked of `LinearMafDisplay`.
 *
 * Only displays whose budget can actually bind need a row. Alignments, LD and
 * the two multi-sample-variant displays read adapters that declare their own
 * (BAM/CRAM/VcfTabix/SplitVcfTabix, all 5 Mb), and an adapter limit outranks the
 * display, so theirs is unreachable — noted in `applies` rather than omitted,
 * since "it can't bind" is itself the decision.
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
    name: 'LinearMafDisplay',
    file: 'plugins/maf/src/LinearMafDisplay/configSchema.ts',
    applies:
      'every MAF adapter, none of which declares its own, so this is the whole budget',
  },
  {
    name: 'baseLinearDisplayConfigSchema',
    file: 'packages/display-kit/src/configSchema.ts',
    applies: 'every inheriting adapter under every other display',
  },
]

/**
 * Gate opt-in sites paired with the display budget that governs them. The check
 * diffs `collectGateOptInSites()` against the keys, so a new gating display
 * cannot land without a row here — and a row naming a `DISPLAY_TIERS` entry
 * cannot name one that doesn't exist.
 */
export const GATE_OPT_IN_SITES: Record<string, string> = {
  'plugins/alignments/src/LinearAlignmentsDisplay/model.ts':
    'BamAdapter/CramAdapter declare 5 Mb, which outranks any display value',
  'plugins/arc/src/shared/ArcFetchModel.ts':
    'baseLinearDisplayConfigSchema: arc reads paired-feature adapters, which report no estimate, so the byte axis is inert unless pointed at a gated one',
  'plugins/canvas/src/shared/CanvasFeatureGateMixin.ts':
    'LinearBasicDisplay and LinearMultiRowFeatureDisplay',
  'plugins/maf/src/LinearMafDisplay/stateModel.ts': 'LinearMafDisplay',
  'plugins/variants/src/LDDisplay/shared.ts':
    'VcfTabixAdapter declares 5 Mb; the PlinkLD adapters report no estimate',
  'plugins/variants/src/shared/MultiSampleVariantBaseModel.ts':
    'VcfTabixAdapter/SplitVcfTabixAdapter declare 5 Mb',
}

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
