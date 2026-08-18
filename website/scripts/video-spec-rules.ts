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
import type { VideoSpec } from './video-spec-types.ts'

// What a spec that names no viewport is filmed at.
export const VIDEO_FRAME_DEFAULTS = { width: 1280, height: 860 }

// The delivery ceiling the encode scales down to. A capture at or under it is
// never resampled, so the frame the reader plays is the frame the spec asked
// for.
export const VIDEO_OUTPUT_WIDTH = 1600

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
// - a tour that types a config the page does not print documents a route
//   through an app the page is not showing, and only pastedTrackConfigs pairs
//   the two texts (check-paste-configs.ts)
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
    const pastes = spec.steps.filter(
      step => step.type === 'type' && step.value?.trim().startsWith('{'),
    )
    if (pastes.length > 0 && !paired.has(spec.name)) {
      problems.push(
        `${spec.name}: types a config into the app but is not in pastedTrackConfigs, so nothing holds it to the fence its page prints`,
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
  caption: string | undefined
  alone: boolean
}

const embedRe = /<Video\b[^>]*?\/>/g
const attrRe = (name: string) => new RegExp(`\\b${name}="([^"]*)"`)

// Every `<Video>` in a markdown file, with what remark-video will make of it.
// `alone` is the property the plugin needs and cannot report: a tag sharing its
// block with anything else — prose on the next line, a second tag — loses that
// neighbour, because one html node becomes one figure.
export function videoEmbedsIn(text: string, doc: string): VideoEmbed[] {
  const lines = text.split('\n')
  return lines.flatMap((line, i) => {
    const matches = [...line.matchAll(embedRe)]
    return matches.map(match => {
      const src = attrRe('src').exec(match[0])?.[1] ?? ''
      return {
        doc,
        line: i + 1,
        src,
        spec: /^\/media\/(.+)\.mp4$/.exec(src)?.[1],
        caption: attrRe('caption').exec(match[0])?.[1],
        alone:
          matches.length === 1 &&
          line.trim() === match[0] &&
          (lines[i + 1] ?? '').trim() === '',
      }
    })
  })
}

// What goes wrong on the page, none of it visible in a build:
//
// - a src naming no spec still plays, and silently drops the live session link
//   that is half of what a tour is for (videoLiveRefs has no entry to find)
// - a spec no page embeds is filmed, pushed and served forever with nothing
//   playing it, and `pull` never prunes the bytes back off a disk
// - an empty caption leaves an empty figcaption and an empty aria-label, so the
//   clip arrives unnamed on the page and unnamed to a screen reader
// - a tag that does not stand alone in its block takes its neighbour with it
export function validateVideoEmbeds(
  embeds: readonly VideoEmbed[],
  specNames: readonly string[],
) {
  const problems: string[] = []
  const known = new Set(specNames)
  for (const embed of embeds) {
    const at = `${embed.doc}:${embed.line}`
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
    if (!embed.alone) {
      problems.push(
        `${at}: put the tag on its own line with a blank line under it — one html block becomes one figure, so whatever shares the block is dropped`,
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
