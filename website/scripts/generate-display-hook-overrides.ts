// Generates ARCHITECTURE.md's display-hook table: which displays override which
// hook, and therefore which are sitting on a default. The foundations and
// cross-cutting tables answer what a display COMPOSED; a wrong foundation breaks
// the display, while every hook here has a default that keeps working and does
// less.
//
// It also asserts each hook is still declared by the file owning its default —
// the static half of the rename hazard REGION_TOO_LARGE.md names, which
// `RENAMED_HOOKS` catches at runtime and only out-of-tree.
//
// **Attribution is by directory, not by walking the compose graph.** A shared
// mixin therefore names itself rather than each display composing it, which is
// visible in the table rather than silent — the same allowance the
// cross-cutting-mixin column already makes.
//
// Only the block between the markers is generated. Run: `pnpm autogen`
// (or `--check` in CI).
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import * as ts from 'typescript'

import {
  checkOrWrite,
  isTsSource,
  markdownTableLines,
  spliceGeneratedBlock,
  walkFiles,
} from './check-utils.ts'
import { repoRoot } from './paths.ts'

const docPath = join(repoRoot, 'agent-docs', 'ARCHITECTURE.md')

interface Hook {
  /** Member name, as a display declares it. */
  name: string
  /**
   * The file that declares the hook's DEFAULT — the foundation or cross-cutting
   * mixin a display inherits it from. Checked, so a rename here fails the build
   * rather than leaving a hook nothing reads.
   *
   * `null` for the one hook with no base default at all: `rpcProps`, which
   * `MultiRegionDisplayMixin` deliberately does not provide, because declaring
   * one would widen the typed return through MST's `.views()` chain and force
   * consumers to re-spread named fields. Its column therefore lists every
   * display that HAS one, and the interesting entry is the absence.
   */
  owner: string | null
  /** What a display sitting on the default gets. One line, no hedging. */
  ifNotOverridden: string
}

// The pick, deliberately. Adding a hook here is how it joins the table — no
// scan can find them, since "a getter with a base default" is not a shape
// distinguishable from any other getter.
const HOOKS: Hook[] = [
  {
    name: 'isCacheValid',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden:
      'loaded regions never go stale — correct unless the worker output is zoom-dependent, and **inherited**, so a display composing a wiggle mixin gets wiggle’s strict-`bpPerPx` version whether or not it wants it',
  },
  {
    name: 'rpcProps',
    owner: null,
    ifNotOverridden:
      'no `SettingsInvalidate` autorun at all, so no user setting ever refetches (correct for `LinearReferenceSequenceDisplay`, indistinguishable from an omission for anyone else)',
  },
  {
    name: 'fetchNeeded',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden: 'nothing is ever fetched',
  },
  {
    name: 'dataCurrent',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalFetchMixin.ts',
    ifNotOverridden:
      'false forever, so `svgReady` never settles and one track hangs the whole view’s export (fail-hung over fail-stale, deliberately)',
  },
  {
    name: 'layoutReady',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden:
      'overlays are dropped rather than pinned to a stale layout',
  },
  {
    name: 'svgReadyExtraTerminal',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden:
      'a resting state that never fetches hangs the export — see §SVG export',
  },
  {
    name: 'loadingSuppressed',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts',
    ifNotOverridden:
      'the loading scrim covers a deliberate static placeholder, and a user cancel parks "Loading canceled / Retry" over it permanently',
  },
  {
    name: 'rendersCanvas',
    owner: 'packages/render-core/src/RenderLifecycleMixin.ts',
    ifNotOverridden:
      '`painted` waits on a canvas that is never mounted, so `data-display-drawn` stays false for the display’s whole life and every `waitForDisplaysDone` on the page burns its timeout',
  },
  {
    name: 'paintInert',
    owner: 'packages/render-core/src/RenderLifecycleMixin.ts',
    ifNotOverridden:
      'same, for a fetch that failed before first paint — both fetch families fill it with `!!error`, so a display outside them owes its own',
  },
  {
    name: 'measuresBytesPreFlight',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden:
      'no byte gate: the track downloads whatever it is pointed at, with no banner and no error',
  },
  {
    name: 'measuresBytesInFetch',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden: 'the same, for the in-RPC half canvas uses',
  },
  {
    name: 'densityTooLarge',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden: 'byte-only gating, no feature-density axis',
  },
  {
    name: 'densityGateEnabled',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden:
      'the density axis stays on — override to false for a display painting into fixed lanes',
  },
  {
    name: 'byteGateAdapterConfig',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden:
      'the estimate measures the display’s own adapter — wrong for a display that reads a different file at different zooms',
  },
  {
    name: 'scrollableHeight',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/TrackHeightMixin.tsx',
    ifNotOverridden: '`Infinity` — the display does not scroll internally',
  },
  {
    name: 'growTargetHeight',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/HeightModeMixin.ts',
    ifNotOverridden: 'grow mode targets the raw `height` slot',
  },
  {
    name: 'fetchInert',
    owner: 'packages/synteny-core/src/SyntenyFetchStateMixin.ts',
    ifNotOverridden:
      'false, the strict answer — a comparative display that grows an inert state and does not declare it hangs `displaysSettled` (diagnosable) rather than reporting done with nothing drawn',
  },
  {
    name: 'featureNoun',
    owner:
      'packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx',
    ifNotOverridden:
      '`feature`, which is right wherever the generic word already fits — an override changes what CONTENT is called ("Showing 3 variants"), never what a control is called, since "Variant height" reads as a different setting from "Feature height"',
  },
  {
    name: 'featureWidgetType',
    owner:
      'packages/core/src/pluggableElementTypes/models/BaseDisplayModel.tsx',
    ifNotOverridden:
      'the generic `BaseFeatureWidget`. An override is a display whose features have a vocabulary of their own, and its `id` decides which displays share one drawer panel',
  },
]

// Directories whose declarations are attributed to themselves. A display's
// model files live under its own directory; the shared ones under
// `<plugin>/src/shared` or a `packages/*` library, and those name themselves in
// the table rather than being expanded to every display that composes them.
const SCAN_ROOTS = ['plugins', 'packages']

/** The unit a declaration is attributed to, e.g. `maf/LinearMafDisplay`. */
function unitOf(file: string): string | undefined {
  const rel = relative(repoRoot, file).split('/')
  const [root, pkg, src, ...rest] = rel
  if (!root || !pkg || src !== 'src') {
    return undefined
  }
  if (root === 'packages') {
    return pkg
  }
  // plugins/<plugin>/src/<dir>/... — the display directory, or the file's own
  // name when a model sits directly under src/
  const dir = rest.length > 1 ? rest[0] : undefined
  return dir ? `${pkg}/${dir}` : pkg
}

/**
 * Member names an object literal in this file declares as `get x()` or `x()` —
 * the two shapes an MST `.views()` / `.actions()` block uses. Read off the AST
 * rather than by regex, so a hook name in a comment, a string or a property
 * ACCESS does not count as a declaration.
 *
 * **`x: value` is deliberately NOT counted.** It is the `.volatile()` shape,
 * which none of these hooks uses, and counting it sweeps up every plain object
 * carrying a same-named field — `{ scrollableHeight: model.scrollableHeight }`
 * passed to a hook reads as a second implementation and is not one.
 */
function declaredMembers(file: string): Set<string> {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const found = new Set<string>()
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      for (const member of node.properties) {
        const name = member.name
        if (
          name &&
          ts.isIdentifier(name) &&
          (ts.isGetAccessorDeclaration(member) ||
            ts.isMethodDeclaration(member))
        ) {
          found.add(name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(src)
  return found
}

function main() {
  const declarers = new Map<
    string,
    { units: Set<string>; files: Set<string> }
  >()
  for (const hook of HOOKS) {
    declarers.set(hook.name, { units: new Set(), files: new Set() })
  }
  const names = new Set(HOOKS.map(h => h.name))

  for (const root of SCAN_ROOTS) {
    const files = walkFiles(
      join(repoRoot, root),
      isTsSource,
      new Set(['node_modules', 'esm', 'dist', 'shaders', '__pycache__']),
    )
    for (const file of files) {
      const unit = unitOf(file)
      if (!unit) {
        continue
      }
      const members = declaredMembers(file)
      for (const name of names) {
        if (members.has(name)) {
          const entry = declarers.get(name)!
          entry.units.add(unit)
          entry.files.add(relative(repoRoot, file))
        }
      }
    }
  }

  // The owner check. A hook whose default has been renamed away leaves every
  // consumer reading a name nothing declares — silently, since a missing getter
  // is `undefined` and every one of these is read as a boolean.
  const orphaned = HOOKS.filter(
    hook =>
      hook.owner !== null && !declarers.get(hook.name)!.files.has(hook.owner),
  )
  if (orphaned.length > 0) {
    console.error(
      `display hook table: these hooks are no longer declared by the file that owns their default.\n` +
        `Either the hook was renamed (update HOOKS, and RegionTooLargeMixin’s RENAMED_HOOKS\n` +
        `if it is a gate hook) or the default moved (update \`owner\`):\n${orphaned
          .map(h => `  ${h.name} — expected in ${h.owner!}`)
          .join('\n')}`,
    )
    process.exit(1)
  }

  const rows = HOOKS.map(hook => {
    const { units } = declarers.get(hook.name)!
    const ownerUnit = hook.owner
      ? unitOf(join(repoRoot, hook.owner))
      : undefined
    const overriders = [...units].filter(u => u !== ownerUnit).sort()
    return `| \`${hook.name}\` | ${hook.ifNotOverridden} | ${
      overriders.length > 0 ? overriders.map(u => `\`${u}\``).join(', ') : '—'
    } |`
  })

  const body = [
    '',
    `${HOOKS.length} overridable hooks. **Sitting on the default** is what a display that does not override one gets.`,
    '',
    '<!-- prettier-ignore -->',
    ...markdownTableLines(
      ['Hook', 'Sitting on the default', 'Declared by'],
      rows,
    ),
  ]

  checkOrWrite({
    path: docPath,
    content: spliceGeneratedBlock({
      path: docPath,
      marker: 'DISPLAY_HOOK_OVERRIDES',
      body,
    }),
    label: 'display hook override table',
    staleHint: 'display hook override table',
  })
}

main()
