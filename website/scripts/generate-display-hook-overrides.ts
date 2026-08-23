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
  owner: string | string[] | null
  /** What a display sitting on the default gets. One line, no hedging. */
  ifNotOverridden: string
}

// A hook whose default lives in more than one file declares each of them, and
// every one has to still be there. `fetchInert` is the case: the LGV foundations
// and the comparative one compose no mixin in common, so one name is declared
// twice on purpose — which is also why a single row is the honest rendering.
function ownersOf(hook: Hook) {
  return hook.owner === null
    ? []
    : Array.isArray(hook.owner)
      ? hook.owner
      : [hook.owner]
}

// The pick, deliberately. Adding a hook here is how it joins the table — no
// scan can find them, since "a getter with a base default" is not a shape
// distinguishable from any other getter.
const HOOKS: Hook[] = [
  {
    name: 'regionFetchKey',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden:
      'the empty key, so loaded regions never go stale on zoom — correct unless the worker output is zoom-dependent. A subclass that changes what it fetches and forgets the key gets a redundant fetch, not a cached answer for a zoom the data was never fetched at',
  },
  {
    name: 'regionHasData',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden:
      'true — nothing checks that a region marked loaded has data behind it, so a display whose commit sites drift from its stores reads the viewport as covered against data nobody holds, and never asks again',
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
    name: 'viewSignature',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalFetchMixin.ts',
    ifNotOverridden:
      'undefined forever, so the display never fetches, `dataCurrent` never goes true and `svgReady` never settles — one track hangs the whole view’s export (fail-hung over fail-stale, deliberately). The comparative displays answer the same freshness question with their own `dataCurrent` compare instead (SVG_EXPORT.md’s signature census)',
  },
  {
    name: 'layoutReady',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/MultiRegionDisplayMixin.ts',
    ifNotOverridden:
      'overlays are dropped rather than pinned to a stale layout',
  },
  {
    name: 'fetchInert',
    owner: [
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts',
      'packages/synteny-core/src/SyntenyFetchStateMixin.ts',
    ],
    ifNotOverridden:
      'false, the strict answer, and three things go wrong at once — the loading scrim covers a deliberate static placeholder (and a user cancel parks "Loading canceled / Retry" over it permanently), a resting state that never fetches hangs the whole view’s export, and the retry check reports a dead Retry on a display correctly declining to load. On a comparative display it also hangs `displaysSettled`',
  },
  {
    name: 'awaitingPrerequisite',
    owner:
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts',
    ifNotOverridden:
      'every decline is judged on the spot by the dev-only retry check, which is right for a display whose fetch answers off its own state — a two-stage one (HiC waits on `CoreGetInfo`, variants on `sourcesBase`) is reported as a dead Retry it does not have, since the run that will fetch is the one after the prerequisite lands. Overriding it DEFERS that verdict, never waives it, so the override has to be strictly narrower than the gate it explains',
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
    name: 'gateEnabled',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden:
      'no byte gate: the track downloads whatever it is pointed at, with no banner and no error',
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
      'no density axis — `canvas/shared` contributes the `true` beside the measurement that fills it, and a display painting into fixed lanes turns it back off',
  },
  {
    name: 'byteGateAdapterPath',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden:
      'the estimate and the budget both describe the track’s own `adapter` — wrong for a display that reads a different file at different zooms, and the one hook such a display overrides, since `byteGateAdapterConfig` is the config at this path',
  },
  {
    name: 'byteGateAdapterConfig',
    owner: 'plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts',
    ifNotOverridden:
      'the config sitting at `byteGateAdapterPath`, which a tier swap already moves — so this one is for a display whose adapter config is SYNTHESIZED rather than read off the track (GC content folds `windowSize` / `gcMode` in), where no path names what it fetches',
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
      // `isTsSource` drops `*.test.ts` but not a test HARNESS, and a harness
      // that stands up a display to exercise a foundation declares the same
      // hooks a display does — reading, in this table, as another display
      // overriding them. No shipped display is named this way.
      name => isTsSource(name) && !/test(env|utils)\.tsx?$/i.test(name),
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
  const orphaned = HOOKS.filter(hook =>
    ownersOf(hook).some(owner => !declarers.get(hook.name)!.files.has(owner)),
  )
  if (orphaned.length > 0) {
    console.error(
      `display hook table: these hooks are no longer declared by the file that owns their default.\n` +
        `Either the hook was renamed (update HOOKS, and RegionTooLargeMixin’s RENAMED_HOOKS\n` +
        `if it is a gate hook) or the default moved (update \`owner\`):\n${orphaned
          .map(h => `  ${h.name} — expected in ${ownersOf(h).join(', ')}`)
          .join('\n')}`,
    )
    process.exit(1)
  }

  const rows = HOOKS.map(hook => {
    const { units } = declarers.get(hook.name)!
    const ownerUnits = new Set(
      ownersOf(hook).map(owner => unitOf(join(repoRoot, owner))),
    )
    const overriders = [...units].filter(u => !ownerUnits.has(u)).sort()
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
