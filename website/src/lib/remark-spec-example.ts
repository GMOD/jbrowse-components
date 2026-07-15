import { visit } from 'unist-util-visit'

import type { Code, Root } from 'mdast'
import type { Plugin } from 'unified'

// Default live JBrowse instance used by the URL-parameter docs. This is the
// "code" deploy that tracks main, so the generated links open against a current
// build the reader can explore.
const DEFAULT_BASE = 'https://jbrowse.org/code/jb2/main/'

// Parse a code-fence info string into key/value pairs. Bare words (e.g. `live`)
// map to an empty string, so presence can be tested with `in`.
function parseMeta(meta: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of (meta ?? '').matchAll(
    /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g,
  )) {
    out[m[1]!] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

// Build a `?config=…&session=spec-…` URL from a session-spec object. The spec
// is the exact JSON shown in the rendered code block, so the link and the
// displayed JSON can never drift apart.
function buildSpecUrl(base: string, config: string, spec: unknown) {
  const params = [
    config ? `config=${encodeURIComponent(config)}` : '',
    `session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
  ].filter(Boolean)
  return `${base}?${params.join('&')}`
}

// A ```json block tagged with a `live` flag in its info string carries a
// session-spec. The block is left untouched (so it stays valid JSON that Shiki
// highlights and GitHub renders), and an auto-generated "Try it live" link is
// appended right after it, derived from that same JSON. A `config=` (and
// optional `base=`) in the info string parameterize the link.
const remarkSpecExample: Plugin<[], Root> = () => {
  return (tree, file) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      const meta = parseMeta(node.meta)
      if (
        node.lang === 'json' &&
        'live' in meta &&
        index !== undefined &&
        parent
      ) {
        let spec: unknown
        try {
          spec = JSON.parse(node.value)
        } catch (e) {
          file.fail(
            `live json block is not valid JSON: ${(e as Error).message}`,
            node,
          )
        }
        const url = buildSpecUrl(
          meta.base || DEFAULT_BASE,
          meta.config ?? '',
          spec,
        )
        // strip our markers so Shiki doesn't try to interpret them as its own
        // meta (line highlights etc.)
        node.meta = null
        parent.children.splice(index + 1, 0, {
          type: 'html',
          value: `<p><a href="${url}" target="_blank" rel="noopener noreferrer">Try this example live ↗</a></p>`,
        })
      }
    })
  }
}

export default remarkSpecExample
