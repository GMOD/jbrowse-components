import { createHighlighter } from 'shiki'
import { visit } from 'unist-util-visit'

import { getText } from './hast-utils.ts'

import type { Element, Root } from 'hast'
import type { Highlighter } from 'shiki'
import type { Plugin } from 'unified'

// catppuccin-mocha's `base`/`text` (#1e1e2e / #cdd6f4) are exactly the flat
// --color-code-bg / --color-code-text the site already paints code blocks with,
// so turning on real token highlighting keeps the same backdrop and only adds
// color — JSON/JS keys, strings, numbers, etc. stop being one undifferentiated
// gray.
const THEME = 'catppuccin-mocha'

// Markdown fence label -> Shiki grammar id. Anything not listed (tsv, slang,
// ...) renders as un-highlighted plaintext rather than throwing.
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  json: 'json',
  json5: 'json5',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  html: 'html',
  css: 'css',
  yaml: 'yaml',
  nginx: 'nginx',
}

const LANGS = [...new Set(Object.values(LANG_ALIASES))]

// One highlighter for the whole build (grammar + wasm load is the expensive
// part); every page's transform awaits the same promise.
let highlighterPromise: Promise<Highlighter> | undefined
function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: [THEME], langs: LANGS })
  return highlighterPromise
}

// `<code class="language-js">` -> "js"
function codeLang(code: Element) {
  const className = code.properties.className
  const classes = Array.isArray(className) ? className : []
  const match = classes
    .map(c => /^language-(.+)$/.exec(String(c)))
    .find(Boolean)
  return match?.[1]
}

const rehypeShiki: Plugin<[], Root> = () => {
  return async tree => {
    const highlighter = await getHighlighter()
    visit(tree, 'element', (node, index, parent) => {
      const code = node.children[0]
      if (
        node.tagName === 'pre' &&
        parent &&
        index !== undefined &&
        code?.type === 'element' &&
        code.tagName === 'code'
      ) {
        const lang = LANG_ALIASES[codeLang(code) ?? ''] ?? 'text'
        const highlighted = highlighter.codeToHast(getText(code).replace(/\n$/, ''), {
          lang,
          theme: THEME,
        })
        // codeToHast returns a Root wrapping a single <pre>; splice that styled
        // <pre> in place of the plain one.
        const pre = highlighted.children[0]
        if (pre?.type === 'element') {
          parent.children[index] = pre
        }
      }
    })
  }
}

export default rehypeShiki
