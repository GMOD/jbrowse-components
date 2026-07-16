import { SKIP, visit } from 'unist-util-visit'

import { recipeButtonHtml, recipeDialogHtml } from './spec-recipe/html.ts'
import { buildRecipe } from './spec-recipe/recipe.ts'
import { screenshotLiveUrls } from '../../scripts/screenshot-specs.ts'

import type { Image, Paragraph, Root } from 'mdast'
import type { Plugin } from 'unified'

const attrRe = /(\w+)=(?:"([^"]*)"|'([^']*)')/g
const figureRe = /<Figure\s+([\s\S]*?)\s*\/>/

// each figure's dialog needs an id unique to the page it renders on
let dialogCount = 0

// map each /img/<name>.png to the live JBrowse instance that produced it, so a
// screenshot links to a running view the reader can open and explore. The spec
// name rides along: opening a figure in Desktop names a session after it.
const liveByImg = new Map(
  Object.entries(screenshotLiveUrls).map(([name, url]) => [
    `/img/${name}.png`,
    { name, url },
  ]),
)

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  attrRe.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(str)) !== null) {
    attrs[m[1]!] = m[2] ?? m[3] ?? ''
  }
  return attrs
}

// Escape for HTML text content (rehype-raw parses this string, so a literal
// `<DEL>` in a caption would otherwise become an actual element).
function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

const remarkFigure: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  return tree => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      const firstChild = node.children[0]
      if (
        node.children.length === 1 &&
        firstChild?.type === 'text' &&
        firstChild.value.startsWith('import ')
      ) {
        if (index === undefined || !parent) {
          return
        }
        parent.children.splice(index, 1)
        return [SKIP, index]
      }
    })

    if (base) {
      visit(tree, 'image', (node: Image) => {
        if (node.url.startsWith('/')) {
          node.url = `${base}${node.url}`
        }
      })
    }

    visit(tree, 'html', node => {
      const match = figureRe.exec(node.value)
      if (!match) {
        return
      }
      const attrs = parseAttrs(match[1]!)
      const rawSrc = attrs.src ?? ''
      const src = base && rawSrc.startsWith('/') ? `${base}${rawSrc}` : rawSrc
      const caption = escapeHtml(attrs.caption ?? '')
      const altText = caption.replaceAll('"', '&quot;')
      const img = `<img src="${src}" alt="${altText}"/>`
      const a = (url: string, inner: string) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${inner}</a>`

      // `links="Label=spec,Label=spec"` opens several live views from one figure
      // (e.g. a stacked before/after image) — each spec name resolves to its
      // screenshot-spec session, so the links can't drift from the figure.
      const multi = (attrs.links ?? '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => {
          const [label, spec] = p.split('=').map(s => s.trim())
          return { label: label ?? '', url: screenshotLiveUrls[spec ?? ''] }
        })
        .filter((l): l is { label: string; url: string } => !!l.url)

      // explicit link= wins; otherwise auto-link screenshots that came from a
      // screenshot-spec session
      const live = liveByImg.get(rawSrc)
      const liveUrl = attrs.link ?? live?.url
      if (multi.length) {
        const linkHtml = multi.map(l => a(l.url, `${l.label} ↗`)).join(' · ')
        node.value = `<figure>${a(multi[0]!.url, img)}<figcaption>${caption} Open in JBrowse: ${linkHtml}</figcaption></figure>`
      } else if (liveUrl) {
        // the live link hands the reader the finished view; the dialog next to
        // it shows how to build the same thing from their own data
        const recipe = buildRecipe(liveUrl, live?.name)
        const help = recipe
          ? (() => {
              const id = `spec-dialog-${dialogCount++}`
              return {
                button: recipeButtonHtml(id),
                dialog: recipeDialogHtml(recipe, id),
              }
            })()
          : { button: '', dialog: '' }
        node.value = `<figure>${a(liveUrl, img)}<figcaption>${caption} ${a(liveUrl, 'Open this view in JBrowse ↗')}${help.button}</figcaption>${help.dialog}</figure>`
      } else {
        node.value = `<figure>${img}<figcaption>${caption}</figcaption></figure>`
      }
    })
  }
}

export default remarkFigure
