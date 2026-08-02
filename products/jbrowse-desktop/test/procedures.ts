import { execFileSync, spawnSync } from 'child_process'

import type { Annotation, AnnotationAnchor } from './annotations.ts'

// Multi-part procedure figures for the desktop docs.
//
// A single screenshot of a dialog says what the dialog looks like; it does not
// say what the reader is meant to do in it, which is why the quickstart's
// figures read as wallpaper. A procedure figure is the same real captures, in
// the order a reader performs them, each with a numbered callout on the control
// that step acts on — so the picture carries the click path and the prose only
// has to explain why.
//
// The frames are captured at their natural points in the flow in
// `screenshots.ts` (they are states of one real session, not staged mockups) and
// stacked into one committed PNG. The callouts are drawn by the same overlay the
// website's figure generator uses, so a desktop figure and a web figure are the
// same visual language.

export interface ProcedureStep {
  // what this frame is of, for the run log
  title: string
  annotations: Annotation[]
}

export interface Procedure {
  steps: ProcedureStep[]
}

// A numbered step callout: the badge, a box around the control it names, and an
// optional one-line label beside it. The badge and the label sit BESIDE the
// control (`alignX`), never on it, so neither covers what the reader is being
// pointed at and neither has to encode the control's width.
//
// `n` counts through the whole procedure rather than restarting per frame, so
// the numbers read as one sequence down the stacked figure.
function step({
  n,
  anchor,
  label,
  labelSide = 'right',
  labelDx = 0,
  labelDy = 0,
  maxWidth,
}: {
  n: number
  anchor: AnnotationAnchor
  label?: string
  labelSide?: 'right' | 'left' | 'above' | 'below'
  labelDx?: number
  labelDy?: number
  maxWidth?: number
}): Annotation[] {
  const badge: Annotation = {
    type: 'circle',
    text: String(n),
    radius: 15,
    fontSize: 17,
    strokeWidth: 3,
    anchor: { ...anchor, alignX: 'left' },
    dx: -24,
  }
  const box: Annotation = { type: 'box', strokeWidth: 3, anchor }
  if (!label) {
    return [box, badge]
  }
  // a text pill's y is its first baseline, so nudge it down by about half a
  // cap height to sit level with the control it labels
  const labelAnchor: AnnotationAnchor =
    labelSide === 'below'
      ? { ...anchor, alignX: 'left', alignY: 'bottom' }
      : labelSide === 'above'
        ? { ...anchor, alignX: 'left', alignY: 'top' }
        : labelSide === 'left'
          ? { ...anchor, alignX: 'left' }
          : { ...anchor, alignX: 'right' }
  // a left-side label ends clear of the badge, which is on that side too (the
  // add-track form sits against the right edge of the window, so its callouts
  // have nowhere else to go)
  const dx = labelSide === 'right' ? 22 : labelSide === 'left' ? -52 : 0
  const dy = labelSide === 'below' ? 30 : labelSide === 'above' ? -18 : 7
  return [
    box,
    badge,
    {
      type: 'text',
      text: label,
      fontSize: 17,
      maxWidth: maxWidth ?? 330,
      // a label to the left has to END at the control it names
      textAlign: labelSide === 'left' ? 'end' : 'start',
      anchor: labelAnchor,
      dx: dx + labelDx,
      dy: dy + labelDy,
    },
  ]
}

// The location box identifies a linear genome view without depending on
// anything the assembly puts in it.
const LOCATION_BOX = 'input[placeholder="Search for location"]'

export const PROCEDURES: Record<string, Procedure> = {
  'desktop-open-genome-steps.png': {
    steps: [
      {
        title: 'start screen',
        annotations: step({
          n: 1,
          anchor: { text: 'Open new genome' },
          label: 'Start here for a genome of your own',
        }),
      },
      {
        title: 'open-genome dialog',
        annotations: [
          // the dialog sits mid-window, so its callouts go left, onto the
          // dimmed start screen behind it, rather than over the dialog's own
          // controls
          ...step({
            n: 2,
            anchor: { selector: '[data-testid="file-drop-zone"]' },
            label: 'Drop the FASTA and its .fai here, or click to browse',
            labelSide: 'left',
            maxWidth: 260,
          }),
          ...step({
            n: 3,
            anchor: { text: 'Open from a URL' },
            label: 'or paste file URLs instead',
          }),
        ],
      },
      {
        title: 'linear genome view on the new assembly',
        // clear of the view's centered "No tracks active" block, which is what
        // a bare new assembly has under its ruler
        annotations: step({
          n: 4,
          anchor: { selector: LOCATION_BOX },
          label: 'The assembly opens in a linear genome view',
          labelSide: 'below',
          labelDx: 250,
          labelDy: 10,
        }),
      },
    ],
  },

  'desktop-available-genomes-steps.png': {
    steps: [
      {
        title: 'start screen',
        annotations: step({
          n: 1,
          anchor: { text: 'Show all available genomes' },
          label: 'No files needed for a common reference',
        }),
      },
      {
        title: 'available-genomes table',
        annotations: [
          ...step({
            n: 2,
            anchor: { selector: 'input[placeholder="Search genomes..."]' },
            label: 'Search by name, species, or accession',
            labelSide: 'above',
          }),
          ...step({
            n: 3,
            anchor: { text: 'launch' },
            label: 'Opens the genome in a new session',
            labelDx: 120,
          }),
        ],
      },
    ],
  },

  'desktop-add-track-steps.png': {
    steps: [
      {
        title: 'File menu',
        annotations: step({
          n: 1,
          anchor: { text: 'Open track' },
          label: 'Also on the track selector, as Add track',
          labelDx: 30,
        }),
      },
      {
        title: 'add-track form',
        annotations: [
          ...step({
            n: 2,
            anchor: { selector: '[data-testid="urlInput"]' },
            label: 'A local file or a URL',
            labelSide: 'left',
            labelDx: -10,
            maxWidth: 190,
          }),
          ...step({
            n: 3,
            anchor: { text: 'automatically inferred' },
            label: 'The index is inferred from the main file',
            labelSide: 'left',
            maxWidth: 190,
          }),
        ],
      },
      {
        // No callout. The frame is the result, and a box around the whole view
        // labelled "the track is added to the view" tells a reader what they
        // are already looking at -- as did a badge on the form's Next button.
        title: 'session with the new track',
        annotations: [],
      },
    ],
  },
}

// ImageMagick 7 calls its CLI `magick`; 6 only ships the individual tools, and
// `identify` as a standalone binary is that older layout.
const HAS_MAGICK = spawnSync('magick', ['-version']).status === 0
const IM = HAS_MAGICK ? 'magick' : 'convert'
const IDENTIFY = HAS_MAGICK ? ['magick', 'identify'] : ['identify']

// Rows of uninterrupted page background along the bottom of a frame.
//
// The app window is a fixed 1400x763 whatever it is showing, so the start
// screen leaves ~200px of empty page under its panels and the volvox view
// leaves ~540px. Stacked unchanged, a three-part figure would be more blank
// page than screenshot. Measured against the frame's own bottom row rather
// than a hardcoded page color (so it holds for either theme): scale to a
// 1px-wide grayscale column and walk up while rows still match the bottom one.
// A callout drawn out in the margin is content and stops the walk, so trimming
// can't cut one off.
function trailingBackgroundPx(file: string): number {
  const out = spawnSync(
    IM,
    [file, '-colorspace', 'Gray', '-scale', '1x!', '-depth', '16', 'txt:-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const rows = (out.stdout || '')
    .split('\n')
    .slice(1)
    .map(line => /^\d+,(\d+): \((\d+(?:\.\d+)?)/.exec(line))
    .filter(m => m !== null)
    .map(m => Number.parseFloat(m[2]!))
  if (rows.length < 2) {
    return 0
  }
  const background = rows.at(-1)!
  // 1/255 of full scale: under what a reader could distinguish, over the
  // rounding in a 1px scale-down
  const tolerance = 65535 / 255
  let count = 0
  for (let y = rows.length - 1; y >= 0; y--) {
    if (Math.abs(rows[y]! - background) > tolerance) {
      break
    }
    count++
  }
  // an all-background frame is a blank capture, a different failure; reporting
  // its whole height as slack would just produce a zero-height crop
  return count === rows.length ? 0 : count
}

// Trim a frame's dead bottom margin in place, keeping `keep` px of it so the
// content doesn't butt against the separator rule below it.
function trimFrame(file: string, keep = 20): void {
  const slack = trailingBackgroundPx(file)
  if (slack > keep) {
    const [bin, ...args] = IDENTIFY
    const identify = spawnSync(bin!, [...args, '-format', '%h', file], {
      encoding: 'utf8',
    })
    const height = Number.parseInt((identify.stdout || '').trim(), 10)
    if (Number.isFinite(height)) {
      execFileSync(IM, [
        file,
        '-crop',
        `x${height - (slack - keep)}+0+0`,
        '+repage',
        file,
      ])
    }
  }
}

// Window decoration, drawn on rather than captured. Selenium screenshots the
// page, so a frame is the app's viewport with nothing around it -- the title
// bar belongs to the window manager and never appears. Stacked, bare rectangles
// read as one long scroll of app, which is why the frames used to need a rule
// between them to separate at all. A title bar per frame says "this is a
// window" without a rule, and says it the same way on every machine's WM.
const TITLEBAR_PX = 28
const TITLEBAR_COLOR = '#e9ebef'
const WINDOW_BORDER = '#a9b0ba'
// the three-dot cluster, in the order every client-side decoration draws it
const WINDOW_DOTS = ['#ec6a5e', '#f4bf4f', '#61c554']
const DOT_RADIUS = 5
const DOT_PITCH = 20
const DOT_X = 20

// Between frames, so the windows read as three pictures rather than a stack
// welded together. Transparent rather than a page color: these figures render
// on a docs page that has a light and a dark theme, and a baked-in white gap
// would be a white bar down the middle of the dark one.
const FRAME_GAP_PX = 26

// A frame plus its simulated window chrome, as an ImageMagick parenthesized
// group. The title bar is spliced above the capture and the dots are drawn into
// it; the 1px border goes on last so it surrounds both.
function windowFrame(file: string, gapAbove: boolean): string[] {
  const dots = WINDOW_DOTS.flatMap((color, i) => {
    const cx = DOT_X + i * DOT_PITCH
    const cy = Math.round(TITLEBAR_PX / 2)
    return [
      '-fill',
      color,
      '-draw',
      `circle ${cx},${cy} ${cx},${cy + DOT_RADIUS}`,
    ]
  })
  return [
    '(',
    file,
    '-background',
    TITLEBAR_COLOR,
    '-splice',
    `0x${TITLEBAR_PX}`,
    ...dots,
    '-bordercolor',
    WINDOW_BORDER,
    '-border',
    '1',
    ...(gapAbove
      ? ['-background', 'none', '-splice', `0x${FRAME_GAP_PX}`]
      : []),
    ')',
  ]
}

// Stack the frames into one figure, each in its own window.
export function composeProcedure(frames: string[], outPath: string): void {
  for (const frame of frames) {
    trimFrame(frame)
  }
  execFileSync(IM, [
    ...frames.flatMap((f, i) => windowFrame(f, i > 0)),
    '-background',
    'none',
    '-append',
    // splicing leaves the first frame's geometry as the result's virtual
    // canvas, which every later `convert` on this file then crops to
    '+repage',
    outPath,
  ])
}

// Flat-color UI screenshots quantize to an 8-bit palette with no visible loss,
// and a three-frame stack is otherwise ~1MB of page weight. Best-effort: an
// install without pngquant just commits the unquantized PNG.
export function optimizePng(file: string): void {
  try {
    execFileSync(
      'pngquant',
      [
        '--nofs',
        '--quality=90-100',
        '--skip-if-larger',
        '--force',
        '--ext',
        '.png',
        file,
      ],
      { stdio: 'ignore' },
    )
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') {
      console.warn('    WARN: pngquant not found; skipping image optimization')
    }
  }
}
