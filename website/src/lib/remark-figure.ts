import { SKIP, visit } from 'unist-util-visit'

import { liveHref } from './code-base.ts'
import { escapeAttr, escapeHtml, parseAttrs } from './inline-html.ts'
import {
  figureLiveLabels,
  figureLiveRefs,
  figureSlowSpecs,
} from './liveLinks.generated.ts'
import { compositeAgent } from './spec-recipe/agent.ts'
import {
  agentDialogHtml,
  framesDialogHtml,
  recipeButtonHtml,
  recipeDialogHtml,
} from './spec-recipe/html.ts'
import { buildRecipe } from './spec-recipe/recipe.ts'

import type { AgentRecipe } from './spec-recipe/agent.ts'
import type { Image, Paragraph, Root } from 'mdast'
import type { Plugin } from 'unified'

const figureRe = /<Figure\s+([\s\S]*?)\s*\/>/

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
    // ids only have to be unique within the page, and numbering them per page
    // is what keeps a page's html independent of how many pages rendered before
    // it — which a render pool makes visible (see markdown-pool.ts).
    let dialogCount = 0
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

      // A composed figure's Agent tab rebuilds the whole stack, one command
      // per frame, whichever frame's link opened the dialog.
      const composite = compositeAgent(
        rawSrc.replace(/^\/img\//, '').replace(/\.png$/, ''),
        new Map(multi.map(l => [l.name, l.label])),
      )

      // One button per figure: its dialog opens the finished view and shows how
      // to rebuild it from the reader's own data
      const recipeFor = (url: string, name?: string) => {
        const recipe = buildRecipe(url, name)
        return recipe && composite ? { ...recipe, agent: composite } : recipe
      }
      const slow = (name: string | undefined) =>
        name !== undefined && screenshotSlowSpecNames.has(name)
      const agentHelp = (agent: AgentRecipe) => {
        const id = `spec-dialog-${dialogCount++}`
        return {
          button: recipeButtonHtml(
            id,
            'Rebuild this figure',
            'The commands that rebuild this figure from the command line',
          ),
          dialog: agentDialogHtml(agent, id),
        }
      }

      // explicit link= wins; otherwise auto-link screenshots that came from a
      // screenshot-spec session
      const live = liveByImg.get(rawSrc)
      const liveUrl = attrs.link ?? live?.url
      const multiFrames = multi.flatMap(l => {
        const recipe = recipeFor(l.url, l.name)
        return recipe ? [{ ...l, recipe, slow: slow(l.name) }] : []
      })
      const singleRecipe =
        !multi.length && liveUrl ? recipeFor(liveUrl, live?.name) : undefined
      if (multi.length) {
        const shown =
          multi.find(l => `/img/${l.name}.png` === rawSrc) ?? multi[0]!
        const zoomed = zoom(img, { url: shown.url, label: `${shown.label} ↗` })
        if (file.data.feed === true || !multiFrames.length) {
          const linkHtml = multi
            .map(l => `${a(l.url, `${l.label} ↗`)}${slowNote(l.name)}`)
            .join(' · ')
          node.value = `<figure>${zoomed}<figcaption>${caption} Open in JBrowse: ${linkHtml}</figcaption></figure>`
        } else {
          const id = `spec-dialog-${dialogCount++}`
          const shownFrame = Math.max(
            0,
            multiFrames.findIndex(f => f.name === shown.name),
          )
          node.value = `<figure>${zoomed}<figcaption>${caption} ${recipeButtonHtml(id)}</figcaption>${framesDialogHtml(multiFrames, id, shownFrame)}</figure>`
        }
      } else if (liveUrl) {
        // a spec whose link opens a plain page rather than a view says so
        // itself; everything else is a session and gets the default
        const label = `${(live?.name ? figureLiveLabels[live.name] : undefined) ?? 'Open this view in JBrowse'} ↗`
        const zoomed = zoom(img, { url: liveUrl, label })
        if (file.data.feed === true || !singleRecipe) {
          node.value = `<figure>${zoomed}<figcaption>${caption} ${a(liveUrl, label)}${slowNote(live?.name)}</figcaption></figure>`
        } else {
          const id = `spec-dialog-${dialogCount++}`
          node.value = `<figure>${zoomed}<figcaption>${caption} ${recipeButtonHtml(id)}</figcaption>${recipeDialogHtml(singleRecipe, id, slow(live?.name))}</figure>`
        }
      } else if (composite && file.data.feed !== true) {
        const help = agentHelp(composite)
        node.value = `<figure>${zoom(img)}<figcaption>${caption} ${help.button}</figcaption>${help.dialog}</figure>`
      } else {
        node.value = `<figure>${zoom(img)}<figcaption>${caption}</figcaption></figure>`
      }
    })
  }
}

export default remarkFigure
