// Generates ARCHITECTURE.md's display-hook table from the overrides themselves.
//
// The foundations table and the cross-cutting-mixin table are already
// generated, and both answer "what did this display compose". Neither answers
// the question that actually costs debugging time: **which displays override
// which hook**, and therefore which are sitting on a default.
//
// That matters more than composition does, because a foundation getting it
// wrong breaks the display while a hook getting it wrong does not. Every hook
// below has a default that keeps working — `layoutReady` false drops every
// overlay, `dataCurrent` false hangs the export, `measuresBytesPreFlight` false
// downloads whatever the track is pointed at with no banner, `isCacheValid`
// inherited from a wiggle mixin refetches on a zoom axis a display may not
// have. ARCHITECTURE.md tells the reader to "check what you inherit before
// leaving the hook alone", which is a question a display×hook table answers at a
// glance and prose cannot.
//
// Two things are generated, and the second is the reason the first is
// trustworthy:
//
//   1. the table — which units declare each hook
//   2. an assertion that every hook is still declared by the file that owns its
//      default
//
// (2) is the static half of a hazard REGION_TOO_LARGE.md already names:
// "Renaming a gate hook is itself a hazard", guarded at runtime by
// `RENAMED_HOOKS` for out-of-tree displays. In-tree, renaming the *owner's*
// declaration and missing a consumer leaves a hook nothing reads; this fails
// the build instead, naming the hook and the file it went missing from.
//
// **Attribution is by directory, not by walking the compose graph**, and that
// is deliberate rather than a shortcut. A display's model files live under its
// own directory and the shared models under `<plugin>/src/shared`, so a
// declaration's home is its own name. The failure mode — a shared mixin listed
// under its own name rather than under each display that composes it — is
// visible in the table rather than silent, which is exactly the allowance
// ARCHITECTURE.md already makes for the cross-cutting-mixin column ("A row is
// also allowed to name an intermediate mixin rather than a display... because
// the column reports what actually composes what").
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

// The pick, deliberately: hooks a display is expected to consider, each with a
// default that fails by doing less rather than by throwing. Adding a hook here
// is how it joins the table; there is no scan that would find them on its own,
// because "a getter with a base default" is not a shape distinguishable from
// any other getter.
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
    name: 'onRegionTooLarge',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden: 'nothing happens on the false→true transition',
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
 * which none of these hooks uses, and counting it swept up every plain object
 * that happens to carry a same-named field: `{ scrollableHeight:
 * model.scrollableHeight }` passed to `useVirtualScrollWheel` listed
 * `packages/core` as a declarer, and `{ rendersCanvas: false }` inside
 * `foundationDisplayStatusPhase` listed the foundation package as one. Both
 * read as a second implementation and neither was.
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
    `${HOOKS.length} overridable hooks, and the units that override each. The **Sitting on the default** column is what a display that does not override it gets — every one of them keeps working and does less, which is why this table exists and the two above it are not enough.`,
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
