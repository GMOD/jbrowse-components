// Regenerate src/lib/liveLinks.generated.ts — the figure and video data the
// markdown pipeline needs, as plain data:
//
//   pnpm gen:live-links
//
// remark-figure.ts and remark-video.ts read the generated file rather than
// scripts/screenshot-specs.ts and scripts/video-specs.ts, because those modules'
// `@jbrowse/browser-test-utils` barrel pulls in puppeteer, esbuild and
// serve-handler. The remark plugins run inside the Astro build, so importing
// them put that whole tree in the site's module graph: ~290ms of node startup on
// every build, Vite transforming two workspace packages' TypeScript to get
// there, and `vite:import-analysis` warning about the runtime `import()` calls
// in browser-test-utils.
//
// The urls here are the specs' own, BEFORE CODE_BASE: a `JBROWSE_CODE_BASE`
// build has to retarget links this file was written without, so the remark
// plugins resolve each one through `liveHref` at build time.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkOrWrite } from './check-utils.ts'
import { pageActions } from './screenshot-spec-rules.ts'
import { DEFAULT_VIEWPORT } from './screenshot-spec-types.ts'
import {
  screenshotLiveLabels,
  screenshotSlowSpecNames,
  specLiveRef,
  specs,
} from './screenshot-specs.ts'
import { videoFrame } from './video-spec-rules.ts'
import { externalClips, pastedTrackConfigs, videoSpecs } from './video-specs.ts'

const figureLiveRefs = Object.fromEntries(
  specs.flatMap(spec => {
    const ref = specLiveRef(spec)
    // `!== undefined`, not a truthiness test: the fresh-install landing page's
    // spec is the empty url, and its live link is CODE_BASE itself
    return ref === undefined ? [] : [[spec.name, ref] as const]
  }),
)

const figureFrames = Object.fromEntries(
  specs.flatMap(spec =>
    spec.mode !== 'url' || specLiveRef(spec) === undefined
      ? []
      : [
          [
            spec.name,
            {
              width: spec.viewportWidth ?? DEFAULT_VIEWPORT.width,
              height: spec.viewportHeight ?? DEFAULT_VIEWPORT.height,
            },
          ] as const,
        ],
  ),
)

// A single-frame figure's callouts, which the recipe's capture command passes
// to `--annotations`. A staged figure draws each stage's own, over frames its
// session alone does not reach.
const figureCallouts = Object.fromEntries(
  specs.flatMap(spec =>
    spec.mode === 'url' &&
    specLiveRef(spec) !== undefined &&
    !spec.stages?.length &&
    spec.annotations?.length
      ? [[spec.name, spec.annotations] as const]
      : [],
  ),
)

// What a figure shows that its session does not hold, for the recipe's capture
// command, which opens the session and clicks nothing, to say so: what its
// clicks open or change, as the spec words it, or how many frames a staged
// figure stacks. Absent where the actions only wait.
const figureClicks = Object.fromEntries(
  specs.flatMap(spec => {
    if (spec.mode !== 'url' || specLiveRef(spec) === undefined) {
      return []
    }
    const stages = spec.stages?.length ?? 0
    return stages || pageActions(spec.actions).length
      ? [
          [
            spec.name,
            {
              ...(spec.clicksOpen ? { open: spec.clicksOpen } : {}),
              ...(spec.clicksChange ? { change: spec.clicksChange } : {}),
              ...(stages ? { stages } : {}),
            },
          ] as const,
        ]
      : []
  }),
)

// Each composed figure's parts in order and how they are laid out, mirroring
// captureComposeSpec, so the recipe gives one command per frame and the
// ImageMagick line that stacks them.
const figureComposites = Object.fromEntries(
  specs.flatMap(spec =>
    spec.mode === 'compose'
      ? [
          [
            spec.name,
            {
              parts: spec.parts,
              horizontal: spec.direction === 'horizontal',
              gutter: spec.gutter,
              sideMargin: spec.sideMargin,
              callouts: (spec.annotations?.length ?? 0) > 0,
            },
          ] as const,
        ]
      : [],
  ),
)

// The jb2export argv of each composite frame drawn without a browser.
const composedParts = new Set(
  specs.flatMap(spec => (spec.mode === 'compose' ? spec.parts : [])),
)
const figureImgArgs = Object.fromEntries(
  specs.flatMap(spec =>
    spec.mode === 'cli' && composedParts.has(spec.name)
      ? [[spec.name, spec.args] as const]
      : [],
  ),
)

const videoLiveRefs = Object.fromEntries(
  videoSpecs.map(spec => [spec.name, spec.url] as const),
)

// Both kinds of clip, because remark-video reserves every player's box from
// this — an externally filmed one has no spec to compute a frame from, so it
// states its own.
const videoFrames = Object.fromEntries([
  ...videoSpecs.map(spec => [spec.name, videoFrame(spec)] as const),
  ...externalClips.map(
    clip => [clip.name, { width: clip.width, height: clip.height }] as const,
  ),
])

// Read off the spec rather than off the disk, for the reason the whole file is
// generated: a checkout that has not pulled the media corpus would answer "no
// captions anywhere" and the site would build without a single track element.
const videoCaptioned = videoSpecs
  .filter(spec => spec.steps.some(step => step.say))
  .map(spec => spec.name)
  .sort()

// The words each tour holds across its frames, in order, for the recipe
// dialog beside the clip: the same strings the `.vtt` carries, so the dialog
// lists the route a reader just watched rather than a second wording of it.
const videoSteps = Object.fromEntries(
  videoSpecs
    .map(
      spec =>
        [
          spec.name,
          spec.steps.flatMap(step => (step.say ? [step.say] : [])),
        ] as const,
    )
    .filter(([, steps]) => steps.length > 0),
)

// The config a tour adds to the app, verbatim, so the dialog hands over the
// same characters the page's fence prints and check-paste-configs holds the
// two together.
const videoPastes = Object.fromEntries(
  pastedTrackConfigs.map(entry => [entry.video, entry.json] as const),
)

const outFile = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/lib/liveLinks.generated.ts',
)

const body = `// AUTO-GENERATED by scripts/gen-live-links.ts — do not edit by hand.
// The live destination behind each figure and each video, as the spec wrote it:
// an absolute url, or a \`?config=…&session=…\` query to hang off CODE_BASE.
// remark-figure.ts and remark-video.ts resolve these through \`liveHref\`, and
// read each tour's frame size from the bottom of the file. The recipe dialog's
// Agent tab reads the callouts, clicks and composites in between.
// Regenerate with \`pnpm gen:live-links\` after editing scripts/screenshot-specs.ts
// or scripts/video-specs.ts.
export const figureLiveRefs: Record<string, string> = ${JSON.stringify(figureLiveRefs, null, 2)}

// Only the specs that override the Figure macro's default link text
// (SessionUrlSpec.liveLabel).
export const figureLiveLabels: Record<string, string> = ${JSON.stringify(screenshotLiveLabels, null, 2)}

// Specs whose live session is genuinely slow to open, which the Figure macro
// says so on the link. Derived in screenshot-specs.ts from the spec's own
// timeouts — see screenshotSlowSpecNames.
export const figureSlowSpecs: string[] = ${JSON.stringify([...screenshotSlowSpecNames].sort(), null, 2)}

// Each figure's capture viewport in CSS px, which the recipe's capture command
// passes on so a reader's frame is the figure's.
export const figureFrames: Record<
  string,
  { width: number; height: number }
> = ${JSON.stringify(figureFrames, null, 2)}

// Each single-frame figure's callouts, in the @jbrowse/capture \`--annotations\`
// shape, for the recipe's capture command.
export const figureCallouts: Record<string, object[]> = ${JSON.stringify(figureCallouts, null, 2)}

// What a figure's clicks open or change that its session does not hold, or the
// frames a staged figure stacks — what the recipe's capture command, which
// clicks nothing, owns up to.
export const figureClicks: Record<
  string,
  { open?: string; change?: string; stages?: number }
> = ${JSON.stringify(figureClicks, null, 2)}

// Each composed figure's parts and layout, for one capture command per frame.
export const figureComposites: Record<
  string,
  {
    parts: string[]
    horizontal: boolean
    gutter?: number
    sideMargin?: number
    callouts: boolean
  }
> = ${JSON.stringify(figureComposites, null, 2)}

// The jb2export argv of each composite frame drawn without a browser.
export const figureImgArgs: Record<string, string[]> = ${JSON.stringify(figureImgArgs, null, 2)}

export const videoLiveRefs: Record<string, string> = ${JSON.stringify(videoLiveRefs, null, 2)}

// Each tour's pixel size, which is its capture viewport: the encode preserves
// the ratio, and check-video-specs refuses the two spec shapes where it would
// not. remark-video reserves the embed's box from this, so a clip does not open
// at a video element's default 300x150 and jump to the column width once its
// poster arrives.
export const videoFrames: Record<
  string,
  { width: number; height: number }
> = ${JSON.stringify(videoFrames, null, 2)}

// The tours whose steps say something, which are the ones generate-video writes
// a \`.vtt\` beside. remark-video hangs a <track> off the clip for these and off
// nothing else, so a tour that names none of its steps does not ship a caption
// element pointing at a file the store has never held.
export const videoCaptioned: string[] = ${JSON.stringify(videoCaptioned, null, 2)}

// Each tour's step captions in order, for the recipe dialog remark-video puts
// beside the clip.
export const videoSteps: Record<string, string[]> = ${JSON.stringify(videoSteps, null, 2)}

// The track config a tour adds to the app, for the same dialog.
export const videoPastes: Record<string, string> = ${JSON.stringify(videoPastes, null, 2)}
`

checkOrWrite({
  path: outFile,
  content: body,
  label: 'src/lib/liveLinks.generated.ts',
  staleHint: 'run `pnpm autogen`',
})
