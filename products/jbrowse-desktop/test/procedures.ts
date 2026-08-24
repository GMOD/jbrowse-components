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
  // How the frames are laid out. 'vertical' (the default) stacks them, which is
  // what a procedure of three or more steps wants, because a row of four 1400px
  // windows is unreadable at page width. Two frames are the case where 'side by
  // side' wins: the figure is half as tall, and the two states sit at the same
  // scale where a reader can compare them (reviewer, on the open-genome
  // procedure: "could also just be a two part screenshot left+right instead of
  // top+bottom").
  direction?: 'vertical' | 'horizontal'
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
  badgeSide = 'left',
  maxWidth,
}: {
  n: number
  anchor: AnnotationAnchor
  label?: string
  labelSide?: 'right' | 'left' | 'above' | 'below'
  labelDx?: number
  labelDy?: number
  // which side of the control the badge sits on. Left by default; `right` is
  // for a control whose own row identifies it to the LEFT (a table row's
  // launch link, where the badge would otherwise cover the genome name).
  badgeSide?: 'left' | 'right'
  maxWidth?: number
}): Annotation[] {
  const badge: Annotation = {
    type: 'circle',
    text: String(n),
    radius: 15,
    fontSize: 17,
    strokeWidth: 3,
    anchor: { ...anchor, alignX: badgeSide },
    dx: badgeSide === 'left' ? -24 : 24,
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
  // a label ends clear of the badge when the badge is on its side too: the
  // add-track form sits against the right edge of the window, so its callouts
  // have nowhere to go but left, and a right-hand badge is 39px of the space a
  // right-hand label would otherwise start in
  const dx =
    labelSide === 'right'
      ? badgeSide === 'right'
        ? 52
        : 22
      : labelSide === 'left'
        ? -52
        : 0
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
          // ABOVE the drop zone, in the empty half of the dialog's title row.
          // This label used to go left, onto the dimmed start screen, and that
          // placement is only as safe as the dialog is narrow — it clipped at
          // the frame edge the moment the dialog went wider and the drop zone
          // reached most of the frame. Title-row whitespace is there at every
          // dialog width, so this one does not have to be revisited with the
          // next change to it.
          ...step({
            n: 2,
            anchor: { selector: '[data-testid="file-drop-zone"]' },
            label: 'Drop the FASTA and its .fai here, or click to browse',
            labelSide: 'above',
            labelDy: -6,
            // an 'above' label starts at its control's left edge, and the drop
            // zone's left edge is the dialog's, so it would land on the title.
            // Pushed clear of "Open genome(s)".
            labelDx: 190,
            maxWidth: 320,
          }),
          // NO CALLOUT ON "Open from a URL", which is where the frame's third
          // and fourth red rectangles used to be (reviewer: "too many red boxes
          // in second figure", after an earlier round on the same frame: "the
          // red boxes are slightly overlapping which looks messy").
          //
          // Moving it below its control stopped the overlap and did not fix the
          // count: a step is a box plus a pill, so two steps put four rectangles
          // and two badges inside one dialog, where the frame beside it carries
          // two rectangles in a whole window.
          //
          // Dropping it rather than restyling it, because the number was also
          // wrong. 1, 2, 3 reads as an order, and the URL box is not the step
          // after the drop zone -- it is the other way to do the same step. The
          // prose beside the figure already carries it ("To load from the web,
          // click Open from a URL and paste your file URLs, one per line"),
          // which is where an alternative route belongs. What is left is the
          // procedure the figure is for: press this, then drop your files here.
        ],
      },
      // No third frame. It was the volvox view the flow lands on, which is
      // what every other figure in the quickstart already shows, and dropping
      // it is what lets the two frames that carry the procedure sit side by
      // side (reviewer: "3 can be omitted").
    ],
    direction: 'horizontal',
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
        // One callout, on the link that does something. The search box used to
        // carry a second one; a reader who wants hg38 out of a table of
        // hundreds does not need to be told that the box above it searches.
        title: 'available-genomes table',
        // A `text` anchor takes the smallest-area match and ties keep the first,
        // so this is the top row's link -- the same one the flow then clicks, so
        // the callout cannot point at a row other than the one frame 3 shows.
        // The badge goes right: on the left it lands on the genome's name, which
        // is what tells the reader which row this is.
        annotations: step({
          n: 2,
          anchor: { text: 'launch' },
          label: 'Opens the genome in a new session',
          badgeSide: 'right',
          labelDx: 100,
        }),
      },
      {
        // No callout: the frame is what step 2 produced.
        title: 'the launched genome',
        annotations: [],
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

  // The BLAT query and what it produces, in one figure (reviewer: "consider
  // making the blat screenshots multipart, e.g. combine with
  // desktop-blat-results"). They were already two states of one visit (the
  // code comment in screenshots.ts said so) but published as two unrelated
  // pictures in two sections of blat.md, so nothing said the second was the
  // first one's answer. Side by side, the query and its hits are one read.
  'desktop-blat-steps.png': {
    steps: [
      {
        title: 'BLAT search dialog with a query pasted',
        // The sequence box rather than Submit: what a reader has to supply is
        // the query, and Submit is the one control in a dialog that needs no
        // explaining. Label left, because the box runs to the dialog's right
        // edge.
        annotations: step({
          n: 1,
          anchor: { selector: 'textarea:not([aria-hidden="true"])' },
          label: 'Paste DNA or FASTA, and pick the assembly to search',
          labelSide: 'left',
          maxWidth: 230,
        }),
      },
      {
        // No callout, same rule as the other procedures' last frames: the
        // frame IS the result. The Search results panel and the drawn hits are
        // what step 1 produced, and a badge saying so narrates the picture.
        title: 'the hit opened from the results list',
        annotations: [],
      },
    ],
    direction: 'horizontal',
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

function frameSize(file: string): { width: number; height: number } {
  const [bin, ...args] = IDENTIFY
  const identify = spawnSync(bin!, [...args, '-format', '%w %h', file], {
    encoding: 'utf8',
  })
  const [width, height] = (identify.stdout || '')
    .trim()
    .split(' ')
    .map(s => Number.parseInt(s, 10))
  return { width: width ?? 0, height: height ?? 0 }
}

// Trim the frames' dead bottom margin in place, keeping `keep` px of it so the
// content doesn't butt against the bottom of its window.
//
// Every frame loses the SAME amount: the smallest slack any of them has. The
// captures are one fixed 1400x763 window whatever it is showing, so trimming
// each to its own content made the rows three different heights, which reads as
// three differently-sized windows rather than one window three times. Cropping
// by the minimum keeps the rows identical AND still drops the dead page that
// every frame shares (the start screen leaves ~200px under its panels, a
// settled volvox view ~540px).
function trimFrames(files: string[], keep = 20): void {
  const slack = Math.min(...files.map(f => trailingBackgroundPx(f)))
  if (slack <= keep) {
    return
  }
  for (const file of files) {
    const { height } = frameSize(file)
    if (Number.isFinite(height) && height > 0) {
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
// the button cluster, at the right of the bar and in the order a GNOME or
// Windows title bar draws it: minimize, maximize, close, close outermost
const WINDOW_DOTS = ['#f4bf4f', '#61c554', '#ec6a5e']
const DOT_RADIUS = 5
const DOT_PITCH = 20
// of the rightmost dot's center from the right edge
const DOT_INSET = 20

// Between frames, so the windows read as three pictures rather than a stack
// welded together, and around the whole figure, so the outermost windows are not
// flush against whatever the docs page puts beside them. Transparent rather than
// a page color: these figures render on a docs page that has a light and a dark
// theme, and a baked-in white gap would be a white bar down the middle of the
// dark one.
const FRAME_GAP_PX = 26

// A frame plus its simulated window chrome, as an ImageMagick parenthesized
// group. The title bar is spliced above the capture and the dots are drawn into
// it; the 1px border goes on last so it surrounds both.
function windowFrame(
  file: string,
  width: number,
  gapBefore: boolean,
  direction: 'vertical' | 'horizontal' = 'vertical',
): string[] {
  const dots = WINDOW_DOTS.flatMap((color, i) => {
    const cx = width - DOT_INSET - (WINDOW_DOTS.length - 1 - i) * DOT_PITCH
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
    // The gap goes on the leading edge of every frame but the first, so it is
    // always BETWEEN two windows: above for a stack, to the left for a row.
    // -splice inserts at the NorthWest corner, so the axis is chosen by which
    // dimension is non-zero.
    ...(gapBefore
      ? [
          '-background',
          'none',
          '-splice',
          direction === 'horizontal'
            ? `${FRAME_GAP_PX}x0`
            : `0x${FRAME_GAP_PX}`,
        ]
      : []),
    ')',
  ]
}

// Stack the frames into one figure, each in its own window.
export function composeProcedure(
  frames: string[],
  outPath: string,
  direction: 'vertical' | 'horizontal' = 'vertical',
): void {
  trimFrames(frames)
  const { width } = frameSize(frames[0]!)
  execFileSync(IM, [
    ...frames.flatMap((f, i) => windowFrame(f, width, i > 0, direction)),
    '-background',
    'none',
    direction === 'horizontal' ? '+append' : '-append',
    // splicing leaves the first frame's geometry as the result's virtual
    // canvas, which every later `convert` on this file then crops to
    '+repage',
    '-bordercolor',
    'none',
    '-border',
    String(FRAME_GAP_PX),
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
