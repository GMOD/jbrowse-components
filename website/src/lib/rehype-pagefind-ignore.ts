import type { Root } from 'hast'
import type { Plugin } from 'unified'

// State-model pages re-render every inherited member in full so each page reads
// standalone (generateStateModelDocs.ts, "## Inherited members"). That is 33k of
// the 57k lines under docs/models/, and DocsLayout marks the whole article
// `data-pagefind-body`, so pagefind indexed ~26 byte-identical copies of every
// base-model member: a search for one returned a wall of near-duplicate pages
// with the model that actually defines it buried among them.
//
// Marking the section `data-pagefind-ignore` drops it from the index only. The
// prose still renders, still appears in the table of contents, and the page is
// still self-contained for a reader who lands on it.
//
// Matched by heading id (set upstream by rehypeSlug), not by heading text:
// rehypeHeadingLinks appends a "#" anchor *inside* the heading, so the text of
// an `<h2>` at this point in the pipeline is "Inherited members#".
const IGNORED_SECTION_IDS = new Set(['inherited-members'])

const rehypePagefindIgnore: Plugin<[], Root> = () => {
  return tree => {
    let ignoring = false
    for (const node of tree.children) {
      if (node.type === 'element') {
        if (node.tagName === 'h2') {
          const id = node.properties.id
          ignoring = typeof id === 'string' && IGNORED_SECTION_IDS.has(id)
        }
        if (ignoring) {
          // hast spells data attributes camelCase; a literal
          // 'data-pagefind-ignore' key never reaches the serialized HTML.
          node.properties.dataPagefindIgnore = true
        }
      }
    }
  }
}

export default rehypePagefindIgnore
