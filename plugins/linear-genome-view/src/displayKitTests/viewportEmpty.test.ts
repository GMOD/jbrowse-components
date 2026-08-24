import { createPerRegionTestEnvironment } from './perRegionTestEnv.ts'

import type { Region } from '@jbrowse/core/util'

// A scaffold-level assembly: hundreds of short regions, none of which survives
// `minimumBlockWidth` once the whole set is on screen, so every block elides and
// the view holds no content block at all. This is the only way in — the view
// clamps `offsetPx` to the region extent, so no amount of scrolling parks the
// viewport off content — but the term is still expressed over the view's
// `hasVisibleContent` rather than over elision, because that is the question
// every reader is actually asking.
const SCAFFOLDS: Region[] = Array.from({ length: 400 }, (_, i) => ({
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: i * 1000,
  end: i * 1000 + 100,
}))

// 100bp per region at 50bp/px is 2px, under the 3px floor.
const ELIDING_BP_PER_PX = 50

function offContentDisplay() {
  const { view, display } = createPerRegionTestEnvironment({
    assemblyEnd: 1_000_000,
  }).createDisplay({ displayedRegions: SCAFFOLDS })
  view.zoomTo(ELIDING_BP_PER_PX)
  return { view, display }
}

test('the fixture really does elide every block', () => {
  const { view } = offContentDisplay()
  expect(view.initialized).toBe(true)
  expect(view.dynamicBlocks.blocks.length).toBeGreaterThan(0)
  expect(view.hasVisibleContent).toBe(false)
})

// Nothing is fetched here (`needed` is empty), so no region is ever committed
// and no canvas is ever painted. Every readiness answer that waits on one of
// those would wait forever: the scrim would sit over the display for as long as
// the viewport stayed off content, and `awaitSvgReady` — an unbounded `when` —
// would hang the whole view's SVG export on this one track.
describe('a display parked off content is at rest, so it reads as terminal', () => {
  test('displayPhase is ready', () => {
    const { display } = offContentDisplay()
    expect(display.viewportEmpty).toBe(true)
    expect(display.canvasDrawn).toBe(false)
    expect(display.displayPhase).toBe('ready')
  })

  test('svgReady resolves even though dataCurrent cannot', () => {
    const { display } = offContentDisplay()
    expect(display.dataCurrent).toBe(false)
    expect(display.svgReady).toBe(true)
  })

  test('painted reports finished', () => {
    expect(offContentDisplay().display.painted).toBe(true)
  })
})

// The control: the same display over a viewport that does hold content is
// untouched by the term, so these assertions are what keeps the ones above from
// passing against a display that reads as ready everywhere.
describe('a viewport holding content is unaffected', () => {
  function onContentDisplay() {
    return createPerRegionTestEnvironment().createDisplay()
  }

  test('viewportEmpty is false', () => {
    const { view, display } = onContentDisplay()
    expect(view.hasVisibleContent).toBe(true)
    expect(display.viewportEmpty).toBe(false)
  })

  test('the pre-first-paint scrim still shows', () => {
    const { display } = onContentDisplay()
    expect(display.canvasDrawn).toBe(false)
    expect(display.displayPhase).toBe('loading')
  })

  test('svgReady still waits for data', () => {
    expect(onContentDisplay().display.svgReady).toBe(false)
  })
})
