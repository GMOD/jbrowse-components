import { visit } from 'unist-util-visit'

import { liveHref } from './code-base.ts'
import { escapeAttr, escapeHtml, parseAttrs } from './inline-html.ts'
import { videoFrames, videoLiveRefs } from './liveLinks.generated.ts'

import type { Root } from 'mdast'
import type { Plugin } from 'unified'

// Rewrites a literal `<Video .../>` string in markdown into an HTML5 <video>
// inside a <figure>, at build time. The motion counterpart of remark-figure.ts,
// and deliberately its shape: a caption under the frame, and a link to the live
// session the tour was filmed in.
//
//   <Video src="/media/pangenome/pggb_subgraph_launch.mp4" caption="Cutting a subgraph out of the locus on screen." />
//
// One line, however long the caption runs, with a blank line under it. A tag
// that wraps is not an html block — its first line is not a whole tag, so
// markdown reads the thing as a paragraph and the figure comes out beside the
// empty <p> that leaves. check-video-specs refuses both shapes.
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
const videoRe = /<Video\s+([\s\S]*?)\s*\/>/g

// `/media/pangenome/x.mp4` -> the spec named `pangenome/x`.
const specNameOf = (src: string) =>
  /^\/media\/(.+)\.mp4$/.exec(src)?.[1] ?? undefined

const remarkVideo: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  const withBase = (u: string) => (base && u.startsWith('/') ? `${base}${u}` : u)
  const figureFor = (attrList: string) => {
    const attrs = parseAttrs(attrList)
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
    const name = specNameOf(rawSrc) ?? ''
    // The tour's own frame, so the box is the right shape from the first paint.
    // Without it a <video> is 300x150 until its metadata arrives and then jumps
    // to the column width, which on these clips is most of a screen of reflow —
    // they run from 600 to 1790 px tall.
    const frame = videoFrames[name]
    const size = frame ? ` width="${frame.width}" height="${frame.height}"` : ''
    const video =
      `<video${flags}${size} preload="metadata" poster="${poster}" ` +
      `aria-label="${escapeAttr(attrs.caption ?? '')}" ` +
      `style="max-width:100%;height:auto">${sources}</video>`
    const ref = videoLiveRefs[name]
    const live = ref === undefined ? undefined : liveHref(ref)
    // Where the video STARTS, which for one that shows something being added is
    // not the state it ends in — the reader takes the same route from the same
    // place rather than being handed the result. Reader-facing, so it says video
    // where the tooling says tour.
    const label = 'Open the session this video starts in ↗'
    const link = live
      ? ` <a href="${live}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : ''
    return `<figure>${video}<figcaption>${caption}${link}</figcaption></figure>`
  }
  return tree => {
    visit(tree, 'html', node => {
      // Each tag is replaced in place rather than becoming the whole node: a
      // node is a markdown BLOCK, so a tag with a second tag or a line of prose
      // under it used to take its neighbour with it, silently.
      // check-video-specs.ts asks for the blank line anyway.
      if (node.value.includes('<Video')) {
        node.value = node.value.replaceAll(videoRe, (_match, attrList: string) =>
          figureFor(attrList),
        )
      }
    })
  }
}

export default remarkVideo
