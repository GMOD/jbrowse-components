import { visit } from 'unist-util-visit'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

// DRAFT — not yet registered in src/lib/markdown.ts. Parallels remark-figure.ts:
// rewrites a literal `<Video .../>` string in markdown into a raw HTML5 <video>
// inside a <figure>, at build time. Wire it in with
// `.use(remarkVideo, { base: baseUrl })` when the videos go live. See
// website/scripts/VIDEO_GO_LIVE_HANDOFF.md.
//
//   <Video src="/video/volvox_tour.mp4" caption="Zooming a volvox view." />
//
// Attributes:
//   src      required; the mp4 URL (local `/video/...` or absolute https://…)
//   webm     optional; defaults to the mp4 sibling with a .webm extension
//   poster   optional; a still-frame image URL shown before play
//   caption  optional; figcaption text
//   loop     "true" to loop; autoplay "true" implies muted (browsers block
//            sound-on autoplay) and is best paired with loop + no controls

const videoRe = /<Video\s+([\s\S]*?)\s*\/>/
const attrRe = /(\w+)=(?:"([^"]*)"|'([^']*)')/g

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  attrRe.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = attrRe.exec(str)) !== null) {
    attrs[m[1]!] = m[2] ?? m[3] ?? ''
  }
  return attrs
}

// rehype-raw parses this string, so escape caption text to keep a literal `<x>`
// from becoming an element.
function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

const remarkVideo: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  const withBase = (u: string) =>
    base && u.startsWith('/') ? `${base}${u}` : u
  return tree => {
    visit(tree, 'html', node => {
      const match = videoRe.exec(node.value)
      if (match) {
        const attrs = parseAttrs(match[1]!)
        const mp4 = withBase(attrs.src ?? '')
        const webm = attrs.webm
          ? withBase(attrs.webm)
          : mp4.replace(/\.mp4$/, '.webm')
        const poster = attrs.poster
          ? ` poster="${withBase(attrs.poster)}"`
          : ''
        const loop = attrs.loop === 'true' ? ' loop' : ''
        // autoplay only works muted; pair it with loop and drop controls for a
        // silent looping preview (a docs GIF replacement)
        const autoplay = attrs.autoplay === 'true' ? ' autoplay muted' : ''
        const controls = attrs.autoplay === 'true' ? '' : ' controls'
        const caption = escapeHtml(attrs.caption ?? '')
        const sources =
          `<source src="${webm}" type="video/webm"/>` +
          `<source src="${mp4}" type="video/mp4"/>`
        const video =
          `<video${controls} preload="metadata" playsinline${autoplay}${loop}${poster} style="max-width:100%;height:auto">${sources}</video>`
        node.value = caption
          ? `<figure>${video}<figcaption>${caption}</figcaption></figure>`
          : `<figure>${video}</figure>`
      }
    })
  }
}

export default remarkVideo
