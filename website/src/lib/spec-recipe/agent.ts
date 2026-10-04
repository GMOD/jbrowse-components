import { liveHref } from '../code-base.ts'
import {
  figureCallouts,
  figureClicks,
  figureComposites,
  figureFrames,
  figureImgArgs,
  figureLiveRefs,
  videoFrames,
} from '../liveLinks.generated.ts'
import { decodeSpecUrl, openedTrackIds } from './decode.ts'
import { heredoc, quote } from './img.ts'

import type { DecodedSpec, SessionSpec } from './decode.ts'

// The Agent tab: the command line that rebuilds a figure headlessly, as
// @jbrowse/capture runs for a session and @jbrowse/img for a figure drawn
// without a browser, and a sentence for whatever of the figure it cannot
// reproduce.

export interface AgentFrame {
  // which frame of a composed figure this command draws
  label?: string
  command: string
  notes: string[]
}

export interface AgentRecipe {
  frames: AgentFrame[]
  // the ImageMagick lines stacking a composed figure's frames
  stack?: string
  notes: string[]
}

interface Anchor {
  selector?: string
  text?: string
  locus?: string
  track?: string
  graphNode?: string
  hLocus?: string
  vLocus?: string
  view?: number | number[]
}

interface Callout {
  anchor?: Anchor
  fromAnchor?: Anchor
  from?: unknown
}

interface Files {
  session: string
  callouts: string
  image: string
}

const ONE_FRAME: Files = {
  session: 'session.json',
  callouts: 'callouts.json',
  image: 'figure.png',
}

function viewExists(spec: SessionSpec, view: Anchor['view']) {
  let views = spec.views
  let found = true
  for (const i of Array.isArray(view) ? view : [view ?? 0]) {
    const next = views?.[i]
    found = next !== undefined
    views = next?.views
  }
  return found
}

// A callout the command can draw without the figure's clicks: one anchored to
// data the session itself opens. Chrome named by selector or text is what the
// clicks brought up, a raw coordinate was placed against the clicked frame, and
// a track or view the session never opens is one the clicks added.
function standsWithoutClicks(callout: Callout, spec: SessionSpec) {
  const tracks = new Set((spec.views ?? []).flatMap(openedTrackIds))
  const onData = (anchor: Anchor | undefined) =>
    !!anchor &&
    !anchor.selector &&
    !anchor.text &&
    (anchor.locus ??
      anchor.track ??
      anchor.graphNode ??
      anchor.hLocus ??
      anchor.vLocus) !== undefined &&
    (anchor.track === undefined || tracks.has(anchor.track)) &&
    viewExists(spec, anchor.view)
  return (
    onData(callout.anchor) &&
    (callout.fromAnchor
      ? onData(callout.fromAnchor)
      : callout.from === undefined)
  )
}

function clickNotes(name: string | undefined, dropped: number) {
  const clicks = name ? figureClicks[name] : undefined
  if (!clicks) {
    return []
  }
  const { open, change, stages } = clicks
  return [
    ...(stages
      ? [
          `The figure stacks ${stages} frames of a click-through; this command draws the view it starts from.`,
        ]
      : []),
    ...(open
      ? [
          `The figure's clicks open ${open}; this command draws the view under it.`,
        ]
      : []),
    ...(change
      ? [
          `The figure's clicks ${change}, which this command does not do, so its picture differs there.`,
        ]
      : []),
    ...(!stages && !open && !change
      ? [
          'The figure was taken after clicks this command does not make, so its picture can differ.',
        ]
      : []),
    ...(dropped
      ? [
          `It leaves out ${dropped === 1 ? 'the callout' : `${dropped} callouts`} anchored to what the clicks bring up.`,
        ]
      : []),
  ]
}

// A figure's `config=` is written as the live link needs it — usually relative
// to the instance serving it (`test_data/volvox/config.json`) — and a command
// run from anywhere else has to resolve that against the instance's own origin
// or fetch nothing. The session and callouts go to files rather than inline:
// each is a whole JSON document, and quoting one into a shell argument is the
// step an agent most reliably gets wrong.
export function captureFrame(
  { base, config, spec }: DecodedSpec,
  name: string | undefined,
  files = ONE_FRAME,
): AgentFrame {
  const instance = base.endsWith('/') ? base : `${base}/`
  const frame = name ? (figureFrames[name] ?? videoFrames[name]) : undefined
  const all = ((name ? figureCallouts[name] : undefined) ?? []) as Callout[]
  const callouts =
    name && figureClicks[name]
      ? all.filter(callout => standsWithoutClicks(callout, spec))
      : all
  return {
    command: [
      ...heredoc(files.session, spec),
      ...(callouts.length ? heredoc(files.callouts, callouts) : []),
      `npx @jbrowse/capture --instance ${instance} \\`,
      `  --config ${new URL(config, base).href} \\`,
      ...(frame ? [`  --width ${frame.width} --height ${frame.height} \\`] : []),
      `  --spec ${files.session}${callouts.length ? ` --annotations ${files.callouts}` : ''} -o ${files.image}`,
    ].join('\n'),
    notes: clickNotes(name, all.length - callouts.length),
  }
}

// jb2export's argv, a flag to a line
function imgFrame(args: string[], image: string): AgentFrame {
  const words = [...args, '--out', image].map(quote)
  return {
    command: `npx @jbrowse/img ${words
      .map((word, i) => (i > 0 && word.startsWith('--') ? `\\\n  ${word}` : word))
      .join(' ')}`,
    notes: [],
  }
}

type Composite = (typeof figureComposites)[string]

// captureComposeSpec's layout: side by side, a white border of half the gutter
// on every panel; stacked, a white gutter between the parts and an optional
// margin down both sides
function stackLine(inputs: string[], layout: Composite, out: string) {
  const { horizontal, gutter, sideMargin } = layout
  const join = horizontal
    ? `-bordercolor white -border ${(gutter ?? 24) / 2} +append`
    : [
        ...(sideMargin ? [`-bordercolor white -border ${sideMargin}x0`] : []),
        gutter ? `-background white -smush ${gutter}` : '-append',
      ].join(' ')
  return `magick ${inputs.join(' ')} ${join} ${out}`
}

// One command per frame of a composed figure, each the frame's own session
// and callouts or its own jb2export call, then the stacking. `labels` names a
// frame the way the figure's `links=` does. Undefined when a frame has no
// command, which leaves the figure on its per-link recipes alone.
export function compositeAgent(
  name: string,
  labels: Map<string, string> = new Map(),
): AgentRecipe | undefined {
  const frames: AgentFrame[] = []
  const stack: string[] = []
  const notes: string[] = []
  let stacks = 0
  const build = (part: string, top: boolean): string | undefined => {
    const layout = figureComposites[part]
    if (layout) {
      const inputs = layout.parts.map(p => build(p, false))
      if (inputs.some(input => input === undefined)) {
        return undefined
      }
      const out = top ? 'figure.png' : `stack-${++stacks}.png`
      stack.push(stackLine(inputs as string[], layout, out))
      if (layout.callouts && notes.length === 0) {
        notes.push(
          "The figure's callouts across its frames are drawn over the stacked image, which these commands leave out.",
        )
      }
      return out
    }
    const n = frames.length + 1
    const image = `frame-${n}.png`
    const args = figureImgArgs[part]
    const ref = figureLiveRefs[part]
    const decoded = ref === undefined ? undefined : decodeSpecUrl(liveHref(ref))
    const frame = args
      ? imgFrame(args, image)
      : decoded
        ? captureFrame(decoded, part, {
            session: `session-${n}.json`,
            callouts: `callouts-${n}.json`,
            image,
          })
        : undefined
    if (!frame) {
      return undefined
    }
    const label = labels.get(part)
    frames.push({ ...frame, label: `Frame ${n}${label ? `: ${label}` : ''}` })
    return image
  }
  return figureComposites[name] && build(name, true)
    ? { frames, stack: stack.join('\n'), notes }
    : undefined
}
