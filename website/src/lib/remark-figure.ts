import { SKIP, visit } from 'unist-util-visit'

import { liveHref } from './code-base.ts'
import { escapeAttr, escapeHtml, parseAttrs } from './inline-html.ts'
import {
  figureLiveLabels,
  figureLiveRefs,
  figureSlowSpecs,
} from './liveLinks.generated.ts'
import { recipeButtonHtml, recipeDialogHtml } from './spec-recipe/html.ts'
import { buildRecipe } from './spec-recipe/recipe.ts'

import type { Image, Paragraph, Root } from 'mdast'
import type { Plugin } from 'unified'

const figureRe = /<Figure\s+([\s\S]*?)\s*\/>/

// each figure's dialog needs an id unique to the page it renders on
let dialogCount = 0

// The generated refs carry each spec's url as it was written; CODE_BASE names
// the hosted build a relative one opens against, and is a build-time env var, so
// it is applied here rather than baked in (see src/lib/code-base.ts).
const screenshotLiveUrls = Object.fromEntries(
  Object.entries(figureLiveRefs).map(([name, ref]) => [name, liveHref(ref)]),
)

const screenshotSlowSpecNames = new Set(figureSlowSpecs)

// map each /img/<name>.png to the live JBrowse instance that produced it, so a
// screenshot links to a running view the reader can open and explore. The spec
// name rides along: opening a figure in Desktop names a session after it.
const liveByImg = new Map(
  Object.entries(screenshotLiveUrls).map(([name, url]) => [
    `/img/${name}.png`,
    { name, url },
  ]),
)

// A figure whose session pulls a huge remote file, or clusters a whole-genome
// view, takes minutes to open in the reader's own browser. Say so on the link:
// without it a slow session reads as a broken one, and the reader navigates away
// during the load.
function slowNote(name: string | undefined) {
  return name !== undefined && screenshotSlowSpecNames.has(name)
    ? ' <span class="figure-slow-note">(large dataset — this session takes a while to load)</span>'
    : ''
}

const remarkFigure: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  return (tree, file) => {
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
      const altText = escapeAttr(attrs.caption ?? '')
      const img = `<img src="${src}" alt="${altText}"/>`
      const a = (url: string, inner: string) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${inner}</a>`

      // Clicking the figure enlarges it in the site lightbox (Lightbox.astro)
      // instead of opening the live session — a reader zooming in on a
      // screenshot doesn't expect to leave the page. The live link rides along
      // as `data-href` so the lightbox offers it, and stays in the caption. In
      // the RSS feed there is no lightbox, so the image links out as it used to.
      const zoom = (inner: string, live?: { url: string; label: string }) =>
        file.data.feed === true
          ? live
            ? a(live.url, inner)
            : inner
          : `<button type="button" class="lightbox-trigger" aria-label="Enlarge: ${altText}"${
              live
                ? ` data-href="${live.url}" data-open-label="${live.label}"`
                : ''
            }>${inner}</button>`

      // `links="Label=spec,Label=spec"` opens several live views from one figure
      // (e.g. a stacked before/after image) — each spec name resolves to its
      // screenshot-spec session, so the links can't drift from the figure.
      const multi = (attrs.links ?? '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => {
          const [label, spec] = p.split('=').map(s => s.trim())
          return {
            label: label ?? '',
            name: spec ?? '',
            url: screenshotLiveUrls[spec ?? ''],
          }
        })
        .filter(
          (l): l is { label: string; name: string; url: string } => !!l.url,
        )

      // the live link hands the reader the finished view; the dialog next to it
      // shows how to build the same thing from their own data
      const helpFor = (url: string, name?: string) => {
        const recipe = buildRecipe(url, name)
        if (!recipe) {
          return { button: '', dialog: '' }
        }
        const id = `spec-dialog-${dialogCount++}`
        return {
          button: recipeButtonHtml(id),
          dialog: recipeDialogHtml(recipe, id),
        }
      }

      // explicit link= wins; otherwise auto-link screenshots that came from a
      // screenshot-spec session
      const live = liveByImg.get(rawSrc)
      const liveUrl = attrs.link ?? live?.url
      if (multi.length) {
        const dialogs: string[] = []
        const linkHtml = multi
          .map(l => {
            const help = helpFor(l.url, l.name)
            if (help.dialog) {
              dialogs.push(help.dialog)
            }
            return `${a(l.url, `${l.label} ↗`)}${help.button}${slowNote(l.name)}`
          })
          .join(' · ')
        const first = multi[0]!
        node.value = `<figure>${zoom(img, { url: first.url, label: `${first.label} ↗` })}<figcaption>${caption} Open in JBrowse: ${linkHtml}</figcaption>${dialogs.join('')}</figure>`
      } else if (liveUrl) {
        const help = helpFor(liveUrl, live?.name)
        // a spec whose link opens a plain page rather than a view says so
        // itself; everything else is a session and gets the default
        const label = `${(live?.name ? figureLiveLabels[live.name] : undefined) ?? 'Open this view in JBrowse'} ↗`
        node.value = `<figure>${zoom(img, { url: liveUrl, label })}<figcaption>${caption} ${a(liveUrl, label)}${help.button}${slowNote(live?.name)}</figcaption>${help.dialog}</figure>`
      } else {
        node.value = `<figure>${zoom(img)}<figcaption>${caption}</figcaption></figure>`
      }
    })
  }
}

export default remarkFigure
