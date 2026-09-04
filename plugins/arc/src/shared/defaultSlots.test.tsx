import { set1 } from '@jbrowse/core/ui/colors'
import { SimpleFeature } from '@jbrowse/core/util'
import { render } from '@testing-library/react'

import Arcs, { ArcsSvg } from './Arcs.tsx'
import { arcDistancePx } from './arcShape.ts'
import {
  createPairedTestEnvironment,
  createTestEnvironment,
} from './testEnv.ts'

// The shipped defaults, nothing written into `displayConfig` — the config a
// BED3/BED4 track gets. Every other suite in this plugin hands the style slots
// plain values, so `jexl:logThickness(feature,'score')` had never once been
// evaluated: on a feature with no score it is `Math.log(undefined + 1)`, the
// NaN folds into the arc's extent, and `arcOnScreen` culls the whole set off a
// canvas that still reports itself drawn.
const { createDisplay } = createTestEnvironment()
const { createDisplay: createPairedDisplay } = createPairedTestEnvironment()

function scorelessArc() {
  const { display } = createDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'f1',
      refName: 'ctgA',
      start: 100,
      end: 2000,
    }),
  ])
  return display
}

function hasInk(canvas: HTMLCanvasElement) {
  const { data } = canvas
    .getContext('2d')!
    .getImageData(0, 0, canvas.width, canvas.height)
  return data.some((v, i) => i % 4 === 3 && v > 0)
}

test('a feature with no score lays out an arc the viewport can hold', () => {
  const arc = scorelessArc().laidOutArcs[0]!
  expect(arc.strokeWidth).toBeGreaterThan(0)
  expect(arc.xMin).toBeLessThan(arc.xMax)
  expect(Number.isFinite(arc.xMin)).toBe(true)
})

test('a feature with no score reaches the canvas as pixels', () => {
  const { container } = render(<Arcs model={scorelessArc()} />)
  expect(hasInk(container.querySelector('canvas')!)).toBe(true)
})

// The tell that it was the screen that was wrong: the export path never culls,
// so the same track exported with visible arcs — carrying a literal
// `stroke-width="NaN"` the browser silently substituted 1 for.
test('the export of a scoreless feature carries a real stroke width', () => {
  const { container } = render(
    <svg>
      <ArcsSvg arcs={scorelessArc().laidOutArcs} />
    </svg>,
  )
  const width = container.querySelector('path')!.getAttribute('stroke-width')
  expect(Number(width)).toBeGreaterThan(0)
})

// `log10(end-start)*50` is -Infinity here, and `arcExtent` never sees a bezier's
// height: the arc counted as on screen while its curve was a Canvas2D no-op and
// its hit distance was Infinity. Flat is what a 1bp feature already gets.
test('a zero-length feature gets a flat arc rather than an infinite one', () => {
  const { display } = createDisplay()
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'point',
      refName: 'ctgA',
      start: 500,
      end: 500,
      score: 10,
    }),
  ])
  const arc = display.laidOutArcs[0]!
  expect(arc.shape).toEqual({
    kind: 'bezier',
    left: 500,
    right: 500,
    height: 0,
  })
  expect(arcDistancePx(arc.shape, 500, 5)).toBeLessThan(50)
})

// The paired display's own default slot, unreachable for the same reason. The
// caption comes along because it is now built from the endpoint pair the style
// already holds, rather than from a second `parseSvAlt` of its own.
test('the paired display colors and captions an arc off its ALT by default', () => {
  const { display, view } = createPairedDisplay()
  view.setNewView(1, 0)
  display.setFeatures([
    new SimpleFeature({
      uniqueId: 'sv1',
      refName: 'ctgA',
      start: 100,
      end: 2000,
      ALT: ['<DEL>'],
      INFO: { END: [2000] },
    }),
  ])
  const arc = display.laidOutArcs[0]!
  expect(arc.color).toBe(set1[0])
  expect(arc.caption).toBe('ctgA:101<br/>ctgA:2,000<br/><DEL>')
})
