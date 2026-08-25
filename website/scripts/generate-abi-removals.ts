import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Renders the three removal records in
// `packages/core/src/ReExports/knownRemovals.ts` into the pages that publish
// them: `REMOVAL_GROUPS` (the `jbrequire` re-export names),
// `SESSION_AND_PLUGIN_REMOVALS` (the unobserved surfaces), and
// `SUBPATH_REMOVALS` (the published `exports` map).
//
// The list has one home already -- the escape hatch
// `abiPreviousRelease.test.ts` checks against -- and two audiences outside it:
// the release announcement, and `reference/PLUGIN_ABI_STABILITY.md`. Written by
// hand, the announcement's version covered 29 of the 46 names, leaving seventeen
// under groups the prose had dropped. That is not a proofreading failure: the
// list is 53 entries long, a group is invisible by being absent, and nothing
// compares a bullet list to a source file. This does.
//
// A removed name is `undefined` inside a plugin bundle nobody is going to
// rebuild, so what the published list omits is exactly what a plugin author does
// not find out about until a user reports a feature quietly missing.
//
// Run `pnpm gen-abi-removals`, or `--check` in CI (`pnpm autogen`).
import {
  REMOVAL_GROUPS,
  SESSION_AND_PLUGIN_REMOVALS,
  SUBPATH_REMOVALS,
} from '../../packages/core/src/ReExports/knownRemovals.ts'
import {
  checkOrWriteAll,
  formatMarkdown,
  spliceGeneratedBlock,
} from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

import type { SurfaceRemovalGroup } from '../../packages/core/src/ReExports/knownRemovals.ts'

const MARKER = 'ABI REMOVALS'
const SURFACE_MARKER = 'SESSION AND PLUGIN REMOVALS'
const SUBPATH_MARKER = 'SUBPATH REMOVALS'

// Both pages carry the same block: the internal reference, and the published
// upgrade guide the release announcement sends plugin authors to.
const targets = [
  join(repoRoot, 'agent-docs/reference/PLUGIN_ABI_STABILITY.md'),
  join(docsDir, 'developer_guides/upgrading_v5.md'),
].filter(path => existsSync(path))

// The unique NAMES a group removed, not its entries: seven names were served
// from two modules each, and a reader counting `getFileHandleCache` twice is
// being told the break is wider than it is.
function uniqueNames(names: Record<string, string>) {
  return [...new Set(Object.keys(names).map(key => key.split('#')[1]!))]
}

// A group whose summary already names its members reads them once, not twice --
// the renames group spells out each old-to-new pair, and appending the same five
// names in backticks after it is noise. The test is whether every name is
// already in the summary.
function line({ summary, names }: (typeof REMOVAL_GROUPS)[number]) {
  const unique = uniqueNames(names)
  return unique.every(name => summary.includes(`\`${name}\``))
    ? `- ${summary}`
    : `- ${summary} (${unique.map(n => `\`${n}\``).join(', ')})`
}

// The counts go under the list rather than into the prose above it. Both are
// facts about the same array -- 46 names over 53 entries, seven of them served
// from two modules each -- and a sentence stating one of them from memory is
// how the hand-written version came to describe a list it no longer matched.
const entries = REMOVAL_GROUPS.flatMap(g => Object.keys(g.names))
const perName = new Map<string, number>()
for (const key of entries) {
  const name = key.split('#')[1]!
  perName.set(name, (perName.get(name) ?? 0) + 1)
}
const doubleServed = [...perName.values()].filter(n => n > 1).length

const body = [
  ...REMOVAL_GROUPS.map(line),
  '',
  `That is ${perName.size} names over ${entries.length} entries, since ${doubleServed} of them were served from two modules each. Every one is recorded with its reason in \`REMOVAL_GROUPS\` in \`packages/core/src/ReExports/knownRemovals.ts\`, and checked on every run against the exports of the previously published package.`,
]

// The session and plugin-`exports` block. One nested list per surface, because
// what each name does to a v4 plugin is the whole content here -- a bare name
// tells a reader who lands on `getReferring` nothing, and `getReferring` is the
// one that answers rather than throwing.
//
// `changed` entries carry their own lead-in: a name that survives with a new
// signature is not a removal, and printing it in a removal list without saying
// so is how a reader concludes their call is fine because it still resolves.
function surfaceLines({ surface, gone, changed }: SurfaceRemovalGroup) {
  return [
    `- ${surface}:`,
    ...Object.entries(gone).map(
      ([name, reason]) => `  - \`${name}\` — ${reason}`,
    ),
    ...Object.entries(changed).map(
      ([name, reason]) =>
        `  - \`${name}\` — **still there, with a signature a v4 caller does not satisfy.** ${reason}`,
    ),
  ]
}

const surfaceBody = [
  ...SESSION_AND_PLUGIN_REMOVALS.flatMap(surfaceLines),
  '',
  'Each is recorded with its reason in `SESSION_AND_PLUGIN_REMOVALS` in `packages/core/src/ReExports/knownRemovals.ts`. Unlike the list above, nothing checks these against a published bundle: `abi.test.ts` pins `@jbrowse/core/*` module names and `scripts/check-published-plugins.ts` filters its findings on that same prefix, so a plugin `exports` object is observed by nothing at all and the session only by the members `pluginFacingSessionApi.test.ts` performs. Reading them here is the check.',
]

// The `exports` map, which is a subpath list rather than a name list — so the
// entry IS the import a plugin wrote, and the reason has to say where the code
// went. A third of these are modules that still exist and only stopped being
// reachable, which a bare list of paths would read as deletions.
const subpathBody = [
  ...SUBPATH_REMOVALS.flatMap(({ summary, subpaths }) => [
    `- ${summary}:`,
    ...Object.entries(subpaths).map(
      ([subpath, reason]) =>
        `  - \`@jbrowse/core${subpath.slice(1)}\` — ${reason}`,
    ),
  ]),
  '',
  `That is ${SUBPATH_REMOVALS.reduce((n, g) => n + Object.keys(g.subpaths).length, 0)} subpaths the published \`exports\` map no longer serves, recorded with their reasons in \`SUBPATH_REMOVALS\` in \`packages/core/src/ReExports/knownRemovals.ts\`. The map is generated from in-repo import sites, so a subpath leaves it whenever its last in-repo importer does; \`abiPreviousRelease.test.ts\` checks the remainder against the exports map of the previously published package, which is what makes the next one a decision rather than an accident.`,
]

checkOrWriteAll(
  targets.map(path => ({
    path,
    content: formatMarkdown(
      spliceGeneratedBlock({
        path,
        marker: SUBPATH_MARKER,
        body: subpathBody,
        text: spliceGeneratedBlock({
          path,
          marker: SURFACE_MARKER,
          body: surfaceBody,
          text: spliceGeneratedBlock({ path, marker: MARKER, body }),
        }),
      }),
      path,
    ),
    label: `${path.slice(repoRoot.length + 1)} ABI removals`,
  })),
  'run `pnpm gen-abi-removals` and commit the result',
)
