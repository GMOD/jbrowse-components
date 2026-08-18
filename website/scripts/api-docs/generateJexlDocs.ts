import * as ts from 'typescript'

import {
  jsDocText,
  parsePipeTags,
  parseSourceFileSyntactic,
  rewriteGroupedMarkerBlocks,
  rewriteMarkerBlock,
} from './util.ts'

import type { SourceCorpus } from './util.ts'

// Render the jexl function catalog into the jexl config guide straight from the
// `j.addFunction(...)` / `j.addBinaryOp(...)` registrations, so the documented
// functions can never drift from the code (the color helpers were silently
// missing from the hand-written list for several releases). Each documented
// function is tagged at its registration site with a JSDoc `#jexlFunction` tag —
// same docs-from-source idea as `#color`/`#api`/`#config`:
//
//   /** #jexlFunction String functions | charAt('abc', 2) | c */
//   j.addFunction('charAt', (s, index) => s.charAt(index))
//
// i.e. `#jexlFunction <category> | <example> | <result>`. The result (rendered as
// the trailing `// ...` comment) is optional. One registration may carry several
// tags to show multiple examples (e.g. getTag). A guide opts the catalog in with
// a single marker pair, regenerated on `pnpm autogen`:
//
//   <!-- JEXL_CATALOG START -->
//   <!-- JEXL_CATALOG END -->
//
// or pulls in one category, by the slug of its name:
//
//   <!-- JEXL_CATEGORY variant-functions START -->
//   <!-- JEXL_CATEGORY variant-functions END -->
//
// Editing between the markers is pointless — it is overwritten on regen.
//
// Core is not the only registrar: a plugin adds its own with
// `pluginManager.jexl.addFunction(...)`, and those are as callable from a config
// as core's. Scanning only core's file made the catalog complete-looking while
// silently omitting eleven of them (the variant helpers, the arc and synteny
// slot defaults), which is the same failure the tag was introduced to end. So
// the whole source tree is scanned, and a file with no tag in it is skipped
// before the TypeScript parser sees it — the text test is what keeps this from
// costing a full parse of every source file in the repo.

const CORE_SOURCE = 'packages/core/src/util/jexl.ts'
const TAG = '#jexlFunction'

interface Entry {
  category: string
  example: string
  result: string
}

// Every `#jexlFunction <category> | <example> | <result>` tag in one comment, in
// source order.
function parseJexlTags(comment: string | undefined, where: string): Entry[] {
  return parsePipeTags(comment, 'jexlFunction', where).map(
    ([category, example, result]) => ({ category, example, result }),
  )
}

// Every file carrying at least one tag: core's first, so its categories keep
// leading the catalog, then the rest in path order so a plugin's position in the
// output does not depend on directory-listing order.
function taggedSources(corpus: SourceCorpus) {
  const rest = corpus.files
    .filter(f => f !== CORE_SOURCE && corpus.read(f).includes(TAG))
    .sort()
  return [CORE_SOURCE, ...rest]
}

// Collect tagged functions grouped by their category, preserving source order of
// both the categories and the functions within each. Tags sit on the expression
// statement wrapping each `j.addFunction(...)` / `j.addBinaryOp(...)` call.
function collectFunctions(corpus: SourceCorpus, files: string[]) {
  const groups = new Map<string, Entry[]>()
  for (const file of files) {
    const visit = (node: ts.Node) => {
      if (ts.isExpressionStatement(node)) {
        for (const entry of parseJexlTags(jsDocText(node), file)) {
          const list = groups.get(entry.category)
          if (list) {
            list.push(entry)
          } else {
            groups.set(entry.category, [entry])
          }
        }
      }
      node.forEachChild(visit)
    }
    visit(parseSourceFileSyntactic(file, corpus.read(file)))
  }
  return groups
}

function renderCategory(entries: Entry[]) {
  const lines = entries
    .map(e =>
      e.result ? `jexl: ${e.example} // ${e.result}` : `jexl: ${e.example}`,
    )
    .join('\n')
  return `\`\`\`js\n${lines}\n\`\`\``
}

function renderCatalog(groups: Map<string, Entry[]>) {
  return [...groups]
    .map(
      ([category, entries]) => `**${category}**\n\n${renderCategory(entries)}`,
    )
    .join('\n\n')
}

// The marker names a category by slug, since a marker's group cannot carry a
// space: `<!-- JEXL_CATEGORY variant-functions START -->`.
function slug(category: string) {
  return category.toLowerCase().replaceAll(/\s+/g, '-')
}

// In `check` mode, report which docs have a stale catalog instead of rewriting —
// used by CI to fail when a jexl function changed but the docs were not
// regenerated.
//
// Two markers over one scan. `JEXL_CATALOG` is the whole catalog, for the jexl
// guide. `JEXL_CATEGORY <slug>` is one category, for a guide that documents the
// plugin those functions came with — variant_track.md listed the variants
// plugin's helpers by hand, and had six of the seven (`alleleLength` landed
// after the table was written, which is the whole failure mode).
//
// A category with no per-category block is normal, unlike a `#color` group:
// every category already renders in the catalog, so a page pulling one in
// separately is an extra, not the only home.
export function writeJexlDocs(corpus: SourceCorpus, { check = false } = {}) {
  const groups = collectFunctions(corpus, taggedSources(corpus))
  const bySlug = new Map([...groups].map(([c, e]) => [slug(c), e]))
  return [
    ...rewriteMarkerBlock('JEXL_CATALOG', renderCatalog(groups), { check }),
    ...rewriteGroupedMarkerBlocks(
      'JEXL_CATEGORY',
      (group, file) => {
        const entries = bySlug.get(group)
        if (!entries) {
          throw new Error(
            `${file}: JEXL_CATEGORY "${group}" is not a #jexlFunction category — the tagged ones are ${[...bySlug.keys()].join(', ')}`,
          )
        }
        return renderCategory(entries)
      },
      { check },
    ).stale,
  ]
}
