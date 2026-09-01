import { visit } from 'unist-util-visit'

import { liveHref } from './code-base.ts'
import { escapeAttr, escapeHtml, parseAttrs } from './inline-html.ts'
import {
  videoCaptioned,
  videoFrames,
  videoLiveRefs,
} from './liveLinks.generated.ts'

import type { Heading, Root } from 'mdast'
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
// The poster and the caption track are both derived from `src` rather than left
// to each call site to remember: the poster is what makes an unplayed embed a
// picture rather than a black rectangle, and the track is what makes the step
// labels readable to anything but an eye.
const videoRe = /<Video\s+([\s\S]*?)\s*\/>/g

// `/media/pangenome/x.mp4` -> the spec named `pangenome/x`.
const specNameOf = (src: string) =>
  /^\/media\/(.+)\.mp4$/.exec(src)?.[1] ?? undefined

// Where each clip sits on the page, for the jump bar DocsLayout puts under the
// h1. A reader who came for the walkthrough is otherwise scrolling a tutorial
// that runs to a thousand lines looking for a black rectangle.
export interface VideoRef {
  id: string
  // the h2/h3 the clip sits under, which is what the bar labels the link with;
  // empty for a clip above the first of them
  section: string
}

// h2 and h3, which is what rehype-collect-toc puts in the table of contents.
// Deeper than that and the bar labels a clip with a heading the reader cannot
// find in the TOC beside it — and an h4 on these pages is a sentence
// ("One node per bubble, when the window is wider than the graph can draw"),
// which is a link nobody reads to the end of.
const SECTION_DEPTHS = new Set([2, 3])

// The section headings, so a link can say where it lands rather than repeating
// the caption, which is a sentence. `{#custom-id}` is already off the text by
// the time this runs — remarkCustomHeadingId is earlier in the pipeline.
function headingText(node: Heading) {
  const parts: string[] = []
  visit(node, child => {
    if (child.type === 'text' || child.type === 'inlineCode') {
      parts.push(child.value)
    }
  })
  return parts.join('').trim()
}

const remarkVideo: Plugin<[{ base?: string }?], Root> = (options = {}) => {
  const base = options.base?.replace(/\/$/, '') ?? ''
  const withBase = (u: string) =>
    base && u.startsWith('/') ? `${base}${u}` : u
  return (tree, file) => {
    const videos: VideoRef[] = []
    const anchors: string[] = []
    // The heading the walk is under. `visit` with no test runs in document
    // order, so the last one seen when a tag turns up is the one above it.
    let section = ''
    // Named for the spec rather than numbered, so a clip added above one keeps
    // every link to it working. A page embedding the same clip twice — two
    // tutorials share derivative_allele_route — would otherwise mint the id
    // twice and check-duplicate-ids would fail the build.
    const anchorFor = (name: string) => {
      const stem = name ? `video-${name.replaceAll('/', '-')}` : 'video-embed'
      let id = stem
      let n = 2
      while (anchors.includes(id)) {
        id = `${stem}-${n}`
        n++
      }
      anchors.push(id)
      return id
    }
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
      // The step labels the tour draws into its own frames, as text. Burned-in
      // words are invisible to a screen reader and to search, so the same strings
      // ship again as a track — generate-video.ts writes the `.vtt` beside the
      // mp4 and the store carries it. Emitted only for the tours that have one,
      // since a <track> whose src 404s leaves the control on with nothing behind
      // it.
      //
      // NOT `default`. The clip already draws each line across its own lower
      // centre, which is where a player puts its cues too, so a track that came
      // on by itself would put the same words on screen twice, on top of each
      // other. What the element is for is that the text
      // EXISTS — selectable, readable by a screen reader, and offered by the
      // player's own captions control to anyone who wants it larger.
      const captions = videoCaptioned.includes(name)
        ? `<track kind="captions" srclang="en" label="Steps" src="${withBase(rawSrc.replace(/\.mp4$/, '.vtt'))}"/>`
        : ''
      // The tour's own frame, so the box is the right shape from the first paint.
      // Without it a <video> is 300x150 until its metadata arrives and then jumps
      // to the column width, which on these clips is most of a screen of reflow —
      // they run from 600 to 1790 px tall.
      const frame = videoFrames[name]
      const size = frame
        ? ` width="${frame.width}" height="${frame.height}"`
        : ''
      const video =
        `<video${flags}${size} preload="metadata" poster="${poster}" ` +
        `aria-label="${escapeAttr(attrs.caption ?? '')}" ` +
        `style="max-width:100%${autoplay ? ';height:auto' : ''}">${sources}${captions}</video>`
      // The frame's own shape, as numbers rather than an aspect-ratio: the box
      // the CSS builds is the clip PLUS a strip for the player's control bar,
      // and a ratio cannot carry that constant. video-overlay.css.
      const frameVars = frame
        ? ` style="--video-w:${frame.width};--video-h:${frame.height}"`
        : ''
      // autoplay's clip has no controls and starts on its own, so there is
      // nothing for a play button to do. A controlled clip stays greyed out
      // behind one until clicked, same as the poster it replaces.
      const frameVideo = autoplay
        ? video
        : `<div class="video-frame"${frameVars}>${video}` +
          `<button type="button" class="video-play-overlay" aria-label="Play video">` +
          `<span class="video-play-icon" aria-hidden="true"></span></button></div>`
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
      const anchor = anchorFor(name)
      // One entry per section, landing on the first clip in it.
      // pangenome_ecoli runs four clips under one h3, and four links reading
      // the same words are a bar that says nothing about where any of them
      // goes.
      if (!videos.some(entry => entry.section === section)) {
        videos.push({ id: anchor, section })
      }
      return `<figure id="${anchor}">${frameVideo}<figcaption>${caption}${link}</figcaption></figure>`
    }
    visit(tree, node => {
      if (node.type === 'heading' && SECTION_DEPTHS.has(node.depth)) {
        section = headingText(node)
      } else if (node.type === 'html' && node.value.includes('<Video')) {
        // Each tag is replaced in place rather than becoming the whole node: a
        // node is a markdown BLOCK, so a tag with a second tag or a line of
        // prose under it used to take its neighbour with it, silently.
        // check-video-specs.ts asks for the blank line anyway.
        node.value = node.value.replaceAll(
          videoRe,
          (_match, attrList: string) => figureFor(attrList),
        )
      }
    })
    file.data.videos = videos
  }
}

export default remarkVideo
