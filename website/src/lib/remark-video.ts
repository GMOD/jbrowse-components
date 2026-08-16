import { visit } from 'unist-util-visit'

import { videoLiveUrls } from '../../scripts/video-specs.ts'
import { escapeAttr, escapeHtml, parseAttrs } from './inline-html.ts'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

// Rewrites a literal `<Video .../>` string in markdown into an HTML5 <video>
// inside a <figure>, at build time. The motion counterpart of remark-figure.ts,
// and deliberately its shape: a caption under the frame, and a link to the live
// session the tour was filmed in.
//
//   <Video src="/media/pangenome/pggb_subgraph_launch.mp4"
//     caption="Cutting a subgraph out of the locus on screen." />
//
// Attributes:
//   src      required; the mp4 url (local `/media/...` or absolute https://…)
//   poster   optional; defaults to the `.jpg` generate-video.ts writes beside it
//   caption  optional; figcaption text
//   loop     "true" to loop
//   autoplay "true" implies muted and drops the controls, for a silent looping
//            preview. Use it for a clip that is a few seconds of one motion; a
//            tour with steps in it needs the controls, since a reader who missed
//            a step has no other way back to it.
//
// The poster is what makes an unplayed embed a picture rather than a black
// rectangle, so it is derived rather than left to each call site to remember.
const videoRe = /<Video\s+([\s\S]*?)\s*\/>/

// `/media/pangenome/x.mp4` -> the spec named `pangenome/x`.
const specNameOf = (src: string) =>
  /^\/media\/(.+)\.mp4$/.exec(src)?.[1] ?? undefined

const remarkVideo: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  const withBase = (u: string) => (base && u.startsWith('/') ? `${base}${u}` : u)
  return tree => {
    visit(tree, 'html', node => {
      const match = videoRe.exec(node.value)
      if (!match) {
        return
      }
      const attrs = parseAttrs(match[1]!)
      const rawSrc = attrs.src ?? ''
      const mp4 = withBase(rawSrc)
      const poster = withBase(attrs.poster ?? rawSrc.replace(/\.mp4$/, '.jpg'))
      const caption = escapeHtml(attrs.caption ?? '')
      const autoplay = attrs.autoplay === 'true'
      // autoplay only works muted, and a clip that starts by itself has no use
      // for a play button
      const flags =
        (autoplay ? ' autoplay muted playsinline' : ' controls playsinline') +
        (attrs.loop === 'true' || autoplay ? ' loop' : '')
      // One source, because the generator writes one: h264 in mp4 plays in every
      // browser that plays anything, and the VP9 alternative measured larger for
      // this content rather than smaller.
      const sources = `<source src="${mp4}" type="video/mp4"/>`
      const video =
        `<video${flags} preload="metadata" poster="${poster}" ` +
        `aria-label="${escapeAttr(attrs.caption ?? '')}" ` +
        `style="max-width:100%;height:auto">${sources}</video>`
      const live = videoLiveUrls[specNameOf(rawSrc) ?? '']
      const label = 'Open this session in JBrowse ↗'
      const link = live
        ? ` <a href="${live}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : ''
      node.value = `<figure>${video}<figcaption>${caption}${link}</figcaption></figure>`
    })
  }
}

export default remarkVideo
