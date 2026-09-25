// Every display, track, view and adapter TYPE named in the agent-facing
// documentation has to be a type this build registers.
//
// These pages are the ones an agent is told to read before its first call, and
// a type name that went stale in them is the worst kind of drift: the agent
// passes the name to `showTrack`, which does not validate a requested display
// type, so the dangling id resolves back to the track's default and the wrong
// display renders under a successful-looking result. `LinearReadArcsDisplay`
// sat in both the live-model guide and the recipes that way after v5
// consolidated the four alignments displays into one, and the recipe conformance
// suite could not see it because the snippet does not throw.
//
// The oracle is `pnpm autogen`'s own output — docs/models/ for state models and
// displays, docs/config/ for tracks and adapters — so this asks the same
// question the reference pages answer and needs no list of its own, plus the
// `aliases` the config manifest lists. An alias is a name this build
// still RESOLVES, for a session saved before a consolidation, so prose may name
// one; what it is not is a type to pass to showTrack, which is what the docs
// around them now say.
//
// Conservative enough to be a hard gate rather than a ratchet: over the whole
// agent corpus it flags two names, one of them the bug above, and EXEMPT below
// carries the other with its reason.
//
// Run: `pnpm check-agent-doc-types`, or the root `pnpm check-docs`.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { DOC_TOPICS } from '../../products/jbrowse-desktop/electron/mcp/docLimits.ts'
import { reportProblems } from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

// The pages and strings an agent reads: every page the `docs` tool serves — off
// the declaration the server itself reads, so a topic added there is checked
// without touching this list — plus the pages and strings that reach an agent by
// another route.
const SOURCES = [
  ...Object.values(DOC_TOPICS).map(t => t.file),
  'website/docs/agents.md',
  'website/docs/agents_capture.md',
  'products/jbrowse-desktop/electron/mcp/toolDefinitions.ts',
  'products/jbrowse-desktop/electron/mcp/README.md',
  'packages/app-core/src/JbApi/jbApi.ts',
  '.claude/skills/jbrowse-mcp/SKILL.md',
]

// A name with no generated page that is still correct to print. Each entry
// states why, because the alternative is a growing list of unexamined
// exceptions.
const EXEMPT: Record<string, string> = {
  // Registered by jbrowse-plugin-protein3d, published from its own repository,
  // so no generator run writes this page. Vendoring it as a devDependency was
  // declined on 2026-09-02.
  ProteinView: 'registered by the out-of-tree protein3d plugin',
  // Same, from jbrowse-plugin-msaview. urlparams.md names both under "Plugin-
  // provided view types", which is where it tells the reader they arrive with
  // the plugin rather than with this build.
  MsaView: 'registered by the out-of-tree msaview plugin',
  // The extension point a plugin registers to make its view launchable is
  // `LaunchView-<type>`, and the prefix ends in View like a type name does. No
  // build registers a view called this.
  LaunchView: 'the LaunchView-<type> extension point, not a view type',
}

function documented(name: string) {
  return (
    existsSync(join(docsDir, 'models', `${name}.md`)) ||
    existsSync(join(docsDir, 'config', `${name}.md`))
  )
}

// Every legacy spelling a registration still answers to, from the config
// manifest the plugin manager writes (`aliases`, which a display derives from
// its `retiredTypes`), so this cannot disagree with what the plugins declare.
function registeredAliases() {
  const manifest = readFileSync(
    join(
      repoRoot,
      'products/jbrowse-cli/src/commands/validate/configManifest.generated.ts',
    ),
    'utf8',
  )
  const names = new Set<string>()
  for (const block of manifest.matchAll(/"aliases":\s*\[([^\]]*)\]/g)) {
    for (const quoted of block[1]!.matchAll(/"([A-Za-z0-9]+)"/g)) {
      names.add(quoted[1]!)
    }
  }
  return names
}

const aliases = registeredAliases()

const errors: string[] = []
let checked = 0

for (const source of SOURCES) {
  const text = readFileSync(join(repoRoot, source), 'utf8')
  const named = new Set(
    [
      ...text.matchAll(
        /\b([A-Z][A-Za-z0-9]*(?:Display|Track|View|Adapter))\b/g,
      ),
    ].map(m => m[1]!),
  )
  for (const name of [...named].sort()) {
    checked++
    if (!documented(name) && !aliases.has(name) && !(name in EXEMPT)) {
      errors.push(
        `${source} names the type '${name}', which has no page under ` +
          `docs/models/ or docs/config/, so this build registers no such type. ` +
          `An agent passing it to showTrack gets the track's DEFAULT display ` +
          `under a successful result. Use the name this build registers, or add ` +
          `it to EXEMPT in this script with the reason.`,
      )
    }
  }
}

reportProblems(
  errors,
  `${checked} type name(s) across ${SOURCES.length} agent-facing sources each name a type this build registers.`,
)
