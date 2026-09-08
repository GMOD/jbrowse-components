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
// `aliases:` arrays the registrations carry. An alias is a name this build
// still RESOLVES, for a session saved before a consolidation, so prose may name
// one; what it is not is a type to pass to showTrack, which is what the docs
// around them now say.
//
// Conservative enough to be a hard gate rather than a ratchet: over the whole
// agent corpus it flags two names, one of them the bug above, and EXEMPT below
// carries the other with its reason.
//
// Run: `pnpm check-agent-doc-types`, or the root `pnpm check-docs`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { docsDir, repoRoot } from './paths.ts'

// The pages and strings an agent reads: the served docs topics, the MCP tool
// descriptions and server instructions, `jb.help`, and the repo skill.
const SOURCES = [
  'website/docs/agents.md',
  'website/docs/agents_live_model.md',
  'website/docs/agents_recipes.md',
  'website/docs/agents_hosted_data.md',
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
  // Registered by jbrowse-plugin-protein3d, out of this tree, and the snippet
  // that names it is explicitly the recipe FOR a type with no page. The
  // plugin's model tag is Protein3dViewPlugin, so it would not gain a
  // `model:ProteinView` page even once the plugin is documented — see
  // agent-docs/handoffs/proteinview-agent-docs.md.
  ProteinView: 'registered by the out-of-tree protein3d plugin',
}

function documented(name: string) {
  return (
    existsSync(join(docsDir, 'models', `${name}.md`)) ||
    existsSync(join(docsDir, 'config', `${name}.md`))
  )
}

// Every legacy spelling a registration still answers to, read off the tree so
// this cannot disagree with what the plugins declare.
function registeredAliases() {
  const names = new Set<string>()
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'esm') {
        continue
      }
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        const text = readFileSync(full, 'utf8')
        for (const block of text.matchAll(/aliases:\s*\[([^\]]*)\]/g)) {
          for (const quoted of block[1]!.matchAll(/'([A-Za-z0-9]+)'/g)) {
            names.add(quoted[1]!)
          }
        }
      }
    }
  }
  walk(join(repoRoot, 'plugins'))
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
