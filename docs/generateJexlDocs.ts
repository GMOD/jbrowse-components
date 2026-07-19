import * as ts from 'typescript'

import {
  jsDocText,
  parsePipeTags,
  parseSourceFileSyntactic,
  rewriteMarkerBlock,
  runMarkerScript,
} from './util.ts'

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
// Editing between the markers is pointless — it is overwritten on regen.

const JEXL_SOURCE = 'packages/core/src/util/jexl.ts'

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

// Collect tagged functions grouped by their category, preserving source order of
// both the categories and the functions within each. Tags sit on the expression
// statement wrapping each `j.addFunction(...)` / `j.addBinaryOp(...)` call.
function collectFunctions(file: string) {
  const groups = new Map<string, Entry[]>()
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
  visit(parseSourceFileSyntactic(file))
  return groups
}

function renderCategory(category: string, entries: Entry[]) {
  const lines = entries
    .map(e =>
      e.result ? `jexl: ${e.example} // ${e.result}` : `jexl: ${e.example}`,
    )
    .join('\n')
  return `**${category}**\n\n\`\`\`js\n${lines}\n\`\`\``
}

function renderCatalog(groups: Map<string, Entry[]>) {
  return [...groups]
    .map(([category, entries]) => renderCategory(category, entries))
    .join('\n\n')
}

// In `check` mode, report which docs have a stale catalog instead of rewriting —
// used by CI to fail when a jexl function changed but the docs were not
// regenerated.
export function writeJexlDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'JEXL_CATALOG',
    renderCatalog(collectFunctions(JEXL_SOURCE)),
    { check },
  )
}

// Run as a script: `node docs/generateJexlDocs.ts [--check]`. The guard keeps
// this inert when the module is imported by generate.ts (argv[1] is generate.ts
// there), so the catalog isn't generated twice in one `pnpm gendocs`.
if (process.argv[1]?.endsWith('generateJexlDocs.ts')) {
  runMarkerScript('Jexl catalog', writeJexlDocs)
}
