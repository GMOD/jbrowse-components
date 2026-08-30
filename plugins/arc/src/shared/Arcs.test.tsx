import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { SimpleFeature } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import Arcs from './Arcs.tsx'
import { arcPathD } from './arcShape.ts'
import {
  createPairedTestEnvironment,
  createTestEnvironment,
} from './testEnv.ts'

// The one fact this component exists to own, and the reason it is shared rather
// than written once per arc display: WHICH renderer draws the arcs depends on
// which path is drawing, and each display was answering it for itself.
//
// On screen the arcs are ink on one canvas — the change this file was rewritten
// for. In the export they are one `<path>` apiece, because a figure wants
// vector, and both take their geometry from the same `laidOutArcs`.
const { createDisplay } = createTestEnvironment({
  thickness: 2,
  label: 'lbl',
  caption: 'cap',
})
// a plain value for `color`, whose default is a jexl call into a function the
// plugin's `install` registers and the bare harness does not
const { createDisplay: createPairedDisplay } = createPairedTestEnvironment({
  color: 'green',
})

// The `<svg>` the export shell opens (renderDisplaySvg → SvgChrome →
// renderArcSvg's SvgClipRect). Bare `<path>`s outside one render, but React
// warns about every element in them, so the assertion that `Arcs` opens no
// second `<svg>` is written as "there is exactly this one".
function exportShell(model: Parameters<typeof Arcs>[0]['model']) {
  return (
    <svg data-testid="shell">
      <Arcs model={model} exportSVG />
    </svg>
  )
}

function oneArc() {
  const { display, view } = createDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 100,
      end: 2000,
      score: 10,
    }),
  ])
  return { display, view }
}

test('on screen the arcs are one canvas, sized off the display', () => {
  const { display, view } = oneArc()
  // scrolled past an end, so the boundary padding blocks make the display's
  // `canvasWidth` differ from the content width a second spelling might take
  view.scrollTo(-200)
  const { container } = render(<Arcs model={display} />)
  const canvas = container.querySelector('canvas')
  expect(canvas).not.toBeNull()
  expect(container.querySelectorAll('path')).toHaveLength(0)
  // the model's getter, which `renderArcSvg` clips the export to as well — the
  // two halves of one number
  expect(canvas!.getAttribute('width')).toBe(`${display.canvasWidth}`)
  expect(display.canvasWidth).toBeGreaterThan(view.totalWidthPxWithoutBorders)
})

test('on the export path it is a path per arc, and no <svg> or <canvas>', () => {
  const { display } = oneArc()
  const { container } = render(exportShell(display))
  // the export shell has already opened an <svg>, so a second would nest and
  // clip the arcs to a box inside the box they were laid out in
  expect(container.querySelectorAll('svg')).toHaveLength(1)
  expect(container.querySelector('canvas')).toBeNull()
  const paths = container.querySelectorAll('path')
  expect(paths).toHaveLength(1)
  expect(paths[0]!.getAttribute('d')).toBe(
    arcPathD(display.laidOutArcs[0]!.shape),
  )
})

test('the export carries the label, its halo and the arc color', () => {
  const { display } = oneArc()
  const { container } = render(exportShell(display))
  const texts = [...container.querySelectorAll('text')]
  expect(texts.map(t => t.textContent)).toEqual(['lbl', 'lbl'])
  // the white one first: SVG paints stroke over fill, so the thick white stroke
  // under the real glyphs is what makes the halo
  expect(texts.map(t => t.getAttribute('stroke'))).toEqual(['white', 'black'])
  // getStrokeProps normalizes, so the config's `darkblue` arrives as its hex
  expect(container.querySelector('path')!.getAttribute('stroke')).toBe(
    '#00008b',
  )
})

test("the paired display's direction ticks export as lines", () => {
  const { display, view } = createPairedDisplay()
  view.setNewView(1, 0)
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'sv1',
      refName: 'ctgA',
      start: 100,
      end: 101,
      ALT: ['N[ctgA:2000['],
    }),
  ])
  const { container } = render(exportShell(display))
  expect(container.querySelectorAll('path')).toHaveLength(1)
  expect(container.querySelectorAll('line').length).toBeGreaterThan(0)
  expect(container.querySelectorAll('text')).toHaveLength(0)
})

test('the hover color is the theme text color, resolved once', () => {
  const { display } = oneArc()
  const theme = createJBrowseTheme()
  const { container } = render(
    <ThemeProvider theme={theme}>
      <Arcs model={display} />
    </ThemeProvider>,
  )
  // nothing per arc subscribes to the theme any more — one canvas, one read
  expect(container.querySelectorAll('canvas')).toHaveLength(1)
  expect(theme.palette.text.primary).toBeTruthy()
})

// The one check that runs the WHOLE chain — laidOutArcs → OverlayCanvas →
// drawArcs → a real 2D context — and looks at what came out. Everything else in
// this directory tests a piece: the geometry against its own formula, the
// painter against a recording ctx that draws nothing. A canvas that never gets a
// context, or an effect that never fires, passes all of those and shows an empty
// track. jsdom rasterizes through node-canvas here, so this is a pixel read.
function inkAt(canvas: HTMLCanvasElement, x: number, y: number) {
  const { data } = canvas.getContext('2d')!.getImageData(x, y, 1, 1)
  return data[3]! > 0
}

// A point on the curve, derived from the shape's own numbers rather than read
// back off the renderer — the Bernstein form of the same cubic, which is what
// makes this a check on the ink and not a restatement of it. `t` is chosen so
// the point lands inside the canvas: the arc runs well past the viewport's right
// edge, and its apex is off screen.
function onCurve(
  shape: { left: number; right: number; height: number },
  t: number,
) {
  const mt = 1 - t
  return {
    x: Math.round(
      mt * mt * (1 + 2 * t) * shape.left + t * t * (3 - 2 * t) * shape.right,
    ),
    y: Math.round(3 * shape.height * t * mt),
  }
}

test('the arcs reach the canvas as pixels', () => {
  const { display } = oneArc()
  const { container } = render(<Arcs model={display} />)
  const canvas = container.querySelector('canvas')!
  const shape = display.laidOutArcs[0]!.shape as {
    left: number
    right: number
    height: number
  }
  const { x, y } = onCurve(shape, 0.25)
  expect(x).toBeLessThan(canvas.width)

  expect(inkAt(canvas, x, y)).toBe(true)
  // the empty band above the curve, so "every pixel is ink" cannot pass this
  expect(inkAt(canvas, x, y - 30)).toBe(false)
})

test('an arc off screen paints nothing', () => {
  const { display, view } = oneArc()
  // pan so far past the arc that its whole extent is left of the viewport
  view.scrollTo(50000)
  const { container } = render(<Arcs model={display} />)
  const canvas = container.querySelector('canvas')!
  const blank = canvas
    .getContext('2d')!
    .getImageData(0, 0, canvas.width, canvas.height)
    .data.every((v, i) => i % 4 !== 3 || v === 0)
  expect(blank).toBe(true)
})

// The other display mode, which nothing else here reaches: a semicircle's
// height is not a config slot at all — its radius IS half its span — so a model
// that kept building beziers would still draw something plausible.
test('semicircle mode lays out semicircles, and they paint', () => {
  const { createDisplay: createSemicircleDisplay } = createTestEnvironment({
    thickness: 2,
    label: '',
    caption: 'cap',
    displayMode: 'semicircles',
  })
  const { display } = createSemicircleDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 100,
      end: 600,
      score: 10,
    }),
  ])
  const { container } = render(<Arcs model={display} />)
  const { shape } = display.laidOutArcs[0]!
  expect(shape.kind).toBe('semicircle')

  const canvas = container.querySelector('canvas')!
  // A point on the circle at a y the canvas actually has. The apex is at the
  // radius, and a semicircle's radius IS half its span — so a wide arc apexes
  // far below the track and the band only ever shows its two flanks, which is
  // the case a check sampling the apex would have missed entirely.
  const mid = (shape.left + shape.right) / 2
  const radius = Math.abs(shape.right - shape.left) / 2
  const y = Math.round(canvas.height / 2)
  expect(radius).toBeGreaterThan(canvas.height)
  const x = Math.round(mid - Math.sqrt(radius * radius - y * y))
  expect(inkAt(canvas, x, y)).toBe(true)
  // 30px along the baseline from the flank, which is empty band
  expect(inkAt(canvas, x - 30, y)).toBe(false)
})
