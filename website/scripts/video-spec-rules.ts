// The rules a tour list has to satisfy, and the frame arithmetic behind them,
// over a list handed in.
//
// Split from video-specs.ts for the reason screenshot-spec-rules.ts is split
// from screenshot-specs.ts: that barrel reaches @jbrowse/browser-test-utils
// through every specs/*.ts module, and puppeteer behind it is ESM jest will not
// transform, so a test importing the list dies before its first assertion. The
// types module is type-only, so this file has no runtime dependency.
//
// Both entry points pass the real list: check-video-specs.ts in `pnpm
// check-docs`, and generate-video before it films anything.
import { LOCATION_BOX } from './videos/shared.ts'

import type { VideoSpec } from './video-spec-types.ts'

// What a spec that names no viewport is filmed at: a full-screen browser on a
// 1080p display, which is the window a reader watching a genome browser has
// open.
//
// Width is the half that is not a per-tour decision, so no spec states it. A
// linear view given 1280 px lays its tracks out in a column narrower than
// anyone runs, and the film then argues about a layout the reader will not see:
// a locus that fits in one screen at full width wraps, a feature label that has
// room is elided, and a synteny ribbon that reads across is a diagonal. Height
// is a decision, because a tour grows the app and one frame serves every state.
export const VIDEO_FRAME_DEFAULTS = { width: 1920, height: 960 }

// The delivery ceiling the encode scales down to. A capture at or under it is
// never resampled, so the frame the reader plays is the frame the spec asked
// for, and the default frame sits ON the ceiling rather than under it.
export const VIDEO_OUTPUT_WIDTH = 1920

// The finished clip's pixel size, which is the capture viewport: the encode
// preserves the ratio and `validateVideoSpecs` refuses the two cases where it
// would not (a width past the ceiling, an odd side the encoder has to round).
// remark-video reserves the embed's box from this, so the arithmetic has one
// home rather than one per reader.
export function videoFrame(spec: VideoSpec) {
  return {
    width: spec.viewportWidth ?? VIDEO_FRAME_DEFAULTS.width,
    height: spec.viewportHeight ?? VIDEO_FRAME_DEFAULTS.height,
  }
}

// Mistakes that leave a plausible-looking clip, or fail hours later:
//
// - two specs sharing a name write the same mp4, so the second overwrites the
//   first every regen and each `--filter` flips the published clip back
// - an odd viewport side is rounded up by the `-2` in the scale filter, so the
//   spec's own frame is a pixel off what every reader plays — and an odd WIDTH
//   is worse than that: libx264 refuses yuv420p at one, which fails the encode
//   after the filming, throwing away a clip that already exists
// - a viewport past the delivery ceiling is scaled down, so the tour is filmed
//   at a legibility the reader never gets
// - a drag with one end missing throws inside runAction, which is after the
//   load, the readiness wait and every step before it — the same cost as the
//   odd viewport, one action earlier
// - a tour that types a config the page does not print documents a route
//   through an app the page is not showing, and only pastedTrackConfigs pairs
//   the two texts (check-paste-configs.ts)
// - a `waitForAppSettled` on a `noSession` page throws at that step, since the
//   page publishes no `[data-app-phase]`; a tab an `opensTab` step follows into
//   is a different page
export function validateVideoSpecs(
  list: VideoSpec[],
  pastedVideos: readonly string[] = [],
) {
  const problems: string[] = []
  const seen = new Set<string>()
  const paired = new Set(pastedVideos)
  for (const spec of list) {
    if (seen.has(spec.name)) {
      problems.push(`${spec.name}: two specs share this name`)
    }
    seen.add(spec.name)
    if (!/^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*$/.test(spec.name)) {
      problems.push(
        `${spec.name}: a name is the output path under static/media, so it takes lowercase, digits, dashes and slashes`,
      )
    }
    if (!spec.description.trim()) {
      problems.push(
        `${spec.name}: no description — it is the line \`--list\` prints and the sentence the embed's caption comes from`,
      )
    }
    const { width, height } = videoFrame(spec)
    for (const [side, px] of [
      ['viewportWidth', width],
      ['viewportHeight', height],
    ] as const) {
      if (px % 2 !== 0) {
        problems.push(
          `${spec.name}: ${side} ${px} is odd, and the encode rounds it up to ${px + 1}`,
        )
      }
    }
    if (width > VIDEO_OUTPUT_WIDTH) {
      problems.push(
        `${spec.name}: viewportWidth ${width} is past the ${VIDEO_OUTPUT_WIDTH}px delivery width, so the clip is scaled down from what it was framed at`,
      )
    }
    const halfDrags = spec.steps.filter(
      step =>
        step.type === 'drag' &&
        (!(step.from ?? step.fromAnchor) || !(step.to ?? step.toAnchor)),
    ).length
    if (halfDrags > 0) {
      problems.push(
        `${spec.name}: ${halfDrags} drag step(s) name only one of their two ends, and the other is resolved at film time — after the load, the readiness wait and every step before it`,
      )
    }
    const firstTab = spec.steps.findIndex(step => step.opensTab)
    const onOpeningPage =
      firstTab === -1 ? spec.steps : spec.steps.slice(0, firstTab)
    if (
      spec.noSession &&
      onOpeningPage.some(step => step.type === 'waitForAppSettled')
    ) {
      problems.push(
        `${spec.name}: waits for the app to settle on a noSession page, which publishes no [data-app-phase] and throws at that step; wait on a selector or text instead`,
      )
    }
    const pastes = spec.steps.filter(
      step => step.type === 'type' && step.value?.trim().startsWith('{'),
    )
    if (pastes.length > 0 && !paired.has(spec.name)) {
      problems.push(
        `${spec.name}: types a config into the app but is not in pastedTrackConfigs, so nothing holds it to the fence its page prints`,
      )
    }
    problems.push(...storyProblems(spec))
  }
  return problems
}

// What a viewer needs to follow a tour with no page beside it: what we are
// about to do, a few phases in plain words, and what the result shows, held on
// the result. Each rule is one way a tour was filmed that nobody could follow:
// `pangenome/hprc_browse` ran twelve lines over seven routes in 82 seconds,
// typed three coordinates, and ended on six zoom-out clicks with nothing said
// about what they found. `synteny/multiway_zoom_out` was a hover and three
// zoom-outs between two states the page already had figures of.
export const MAX_GOAL_WORDS = 14
export const MAX_LINES = 5

const ACTIONS = new Set(['click', 'rightclick', 'type', 'drag', 'press'])

// A view's own zoom buttons, by the testid every header gives them.
const ZOOM_BUTTON = /zoom_(in|out)/

// `chr6:31,980,000-32,050,000`, a window read off a figure, which a viewer
// cannot tell from any other run of digits. One token only: two windows
// separated by a space is the multi-region syntax, which no gene name spells.
const COORDINATES = /^[^\s:]+:[\d,.]+(-[\d,.]+)?$/

function storyProblems(spec: VideoSpec) {
  const problems: string[] = []
  const at = spec.name
  const goalWords = spec.goal.trim().split(/\s+/).filter(Boolean).length
  if (goalWords === 0) {
    problems.push(
      `${at}: no goal — the line held over the opening frame is how a viewer knows what the clip is for`,
    )
  } else if (goalWords > MAX_GOAL_WORDS) {
    problems.push(
      `${at}: the goal is ${goalWords} words, and it has to be read before anything moves; keep it to ${MAX_GOAL_WORDS}`,
    )
  }
  const said = spec.steps.flatMap((step, i) => (step.say ? [i] : []))
  if (said.length > MAX_LINES) {
    problems.push(
      `${at}: ${said.length} lines is ${said.length} phases, past the ${MAX_LINES} one route takes; split the tour`,
    )
  }
  const lastAction = spec.steps.findLastIndex(step => ACTIONS.has(step.type))
  const payoff = said.at(-1)
  if (
    payoff === undefined ||
    spec.steps[payoff]!.type !== 'delay' ||
    payoff < lastAction
  ) {
    problems.push(
      `${at}: end on the payoff — a \`delay\` after the last action, whose \`say\` names what the result shows`,
    )
  }
  const clicks = spec.steps.filter(
    step => step.type === 'click' || step.type === 'rightclick',
  )
  if (
    clicks.length > 0 &&
    clicks.every(step => ZOOM_BUTTON.test(step.selector ?? ''))
  ) {
    problems.push(
      `${at}: every click is a zoom button, and zooming is navigation a reader already knows; film a menu path, a dialog or a form, or leave the two ends to figures`,
    )
  }
  for (const step of spec.steps) {
    if (step.say && step.cut) {
      problems.push(
        `${at}: "${step.say}" is on a \`cut\` step, which is off camera, so nobody sees it`,
      )
    }
    if (
      step.type === 'type' &&
      step.selector === LOCATION_BOX &&
      COORDINATES.test(step.value?.trim() ?? '')
    ) {
      problems.push(
        `${at}: types "${step.value}" into the location box; search a gene name, or select the span on the scale bar, so the viewer sees where the view is going`,
      )
    }
  }
  return problems
}

// ── The doc side ───────────────────────────────────────────────────────────

export interface VideoEmbed {
  doc: string
  line: number
  spec: string | undefined
  src: string
  poster: string | undefined
  caption: string | undefined
  // A tag that never closed with `/>`, which the plugin does not recognise at
  // all. `wrapped` and `alone` describe where a recognised tag sits, so they say
  // nothing about one of these.
  closed: boolean
  wrapped: boolean
  alone: boolean
}

// remark-video's own pattern, so this finds the tags that actually render. A
// narrower `[^>]` scan does not: the corpus already puts a `<DEL>` inside a
// caption, and one angle bracket there hides the whole tag from every reader
// but the plugin.
const embedRe = /<Video\s+[\s\S]*?\s*\/>/g

// A `<Video` no tag match covers, which is one that never closed.
const looseRe = /<Video\b/g

const attrRe = (name: string) => new RegExp(`\\b${name}="([^"]*)"`)

function attrsOf(tag: string) {
  const src = attrRe('src').exec(tag)?.[1] ?? ''
  return {
    src,
    spec: /^\/media\/(.+)\.mp4$/.exec(src)?.[1],
    poster: attrRe('poster').exec(tag)?.[1],
    caption: attrRe('caption').exec(tag)?.[1],
  }
}

// Every `<Video>` in a markdown file, with what remark-video will make of it.
// The scan spans lines rather than walking them, because the plugin's does:
// walking lines cannot see a tag that wraps, and reported the spec it plays as
// one no page embeds — a failure naming the spec list over a page that is fine.
//
// `wrapped` and `alone` are the two properties the plugin needs and cannot
// report, since by the time it runs it holds a block rather than a file.
export function videoEmbedsIn(text: string, doc: string): VideoEmbed[] {
  const lines = text.split('\n')
  const lineOf = (offset: number) => text.slice(0, offset).split('\n').length
  const embeds: VideoEmbed[] = []
  const spans: [number, number][] = []
  for (const match of text.matchAll(embedRe)) {
    const start = match.index
    const end = start + match[0].length
    spans.push([start, end])
    const last = lineOf(end)
    embeds.push({
      ...attrsOf(match[0]),
      doc,
      line: lineOf(start),
      closed: true,
      wrapped: lineOf(start) !== last,
      alone:
        text.slice(0, start).split('\n').at(-1)!.trim() === '' &&
        text.slice(end).split('\n')[0]!.trim() === '' &&
        (lines[last] ?? '').trim() === '',
    })
  }
  for (const loose of text.matchAll(looseRe)) {
    if (
      spans.some(([start, end]) => loose.index >= start && loose.index < end)
    ) {
      continue
    }
    const line = lineOf(loose.index)
    embeds.push({
      ...attrsOf(lines[line - 1]!),
      doc,
      line,
      closed: false,
      wrapped: false,
      alone: false,
    })
  }
  return embeds.sort((a, b) => a.line - b.line)
}

// What goes wrong on the page, none of it visible in a build. Each of these was
// rendered through the real pipeline rather than reasoned about, because what
// markdown does with a tag depends on where the tag sits:
//
// - a tag that never closed with `/>` is not a tag the plugin matches, so the
//   raw string reaches the browser, which lowercases it into a bare <video>:
//   no controls, no poster, no caption, no live link, and a clip nothing can
//   play. check-figure-refs cannot see it either, so the src goes unchecked too
// - a src naming no spec still plays, and silently drops the live session link
//   that is half of what a tour is for (videoLiveRefs has no entry to find)
// - a spec no page embeds is filmed, pushed and served forever with nothing
//   playing it, and `pull` never prunes the bytes back off a disk
// - an empty caption leaves an empty figcaption and an empty aria-label, so the
//   clip arrives unnamed on the page and unnamed to a screen reader
// - a tag that wraps is not an html block, because its first line is not a
//   whole tag; markdown reads it as a paragraph instead, and the figure lands
//   beside the empty <p> that paragraph leaves behind
// - prose sharing the block reaches the reader as it was typed, since the block
//   runs to the next blank line and everything in it is raw html by then: a
//   link stays `[text](url)` and bold stays `**bold**` on the page
export function validateVideoEmbeds(
  embeds: readonly VideoEmbed[],
  specNames: readonly string[],
) {
  const problems: string[] = []
  const known = new Set(specNames)
  for (const embed of embeds) {
    const at = `${embed.doc}:${embed.line}`
    if (!embed.closed) {
      problems.push(
        `${at}: <Video src="${embed.src}"> never closes with \`/>\`, so the plugin does not match it and the reader gets a bare <video> with no controls and no poster`,
      )
      continue
    }
    if (embed.spec === undefined) {
      problems.push(
        `${at}: src="${embed.src}" is not \`/media/<spec name>.mp4\``,
      )
    } else if (!known.has(embed.spec)) {
      problems.push(
        `${at}: no video spec is named "${embed.spec}", so the embed renders without its live session link`,
      )
    }
    if (!embed.caption?.trim()) {
      problems.push(
        `${at}: no caption, so the figure and its aria-label are empty`,
      )
    }
    if (embed.wrapped) {
      problems.push(
        `${at}: put the whole tag on one line — a tag that wraps is a paragraph rather than an html block, and the figure renders beside the empty <p> it leaves`,
      )
    } else if (!embed.alone) {
      problems.push(
        `${at}: put the tag on its own line with a blank line under it — the html block runs to the next blank line and everything in it is raw by then, so prose sharing it keeps its markdown on the page`,
      )
    }
  }
  const embedded = new Set(embeds.map(embed => embed.spec))
  for (const name of specNames) {
    if (!embedded.has(name)) {
      problems.push(
        `${name}: no doc embeds this tour, so its bytes are published and nothing plays them`,
      )
    }
  }
  return problems
}

// The page a paste pair names has to be the page that embeds the tour.
//
// check-paste-configs holds the config a tour types against a fence on the page
// the pair names, and takes that page on trust: nothing said the tour was ever
// on it. Move an embed to another tutorial and the pair keeps passing against a
// fence the reader of the tour never sees, which is the drift the pair exists to
// catch, one page over.
export function validatePastePages(
  embeds: readonly VideoEmbed[],
  pasted: readonly { video: string; doc: string }[],
) {
  const pages = new Map<string, string[]>()
  for (const embed of embeds) {
    if (embed.spec !== undefined) {
      pages.set(embed.spec, [...(pages.get(embed.spec) ?? []), embed.doc])
    }
  }
  return pasted.flatMap(({ video, doc }) => {
    const on = pages.get(video)
    return on === undefined || on.includes(doc)
      ? []
      : [
          `${video}: pastedTrackConfigs checks its config against ${doc}, which does not embed the tour — ${on.join(', ')} does`,
        ]
  })
}
