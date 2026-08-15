import { render } from '@testing-library/react'

import ScrollEdgeShadow from './ScrollEdgeShadow.tsx'

// Which edges are marked, for the four scroll states. That mapping is the whole
// component: a mark at an edge means "there is content past this one", so a
// track that fits marking either edge, or a scrolled-to-the-end track still
// marking its bottom, is the affordance lying about the state it exists to
// report.
function edges(props: React.ComponentProps<typeof ScrollEdgeShadow>) {
  const { queryByTestId } = render(<ScrollEdgeShadow {...props} />)
  return {
    top: Boolean(queryByTestId('scroll-edge-shadow-top')),
    bottom: Boolean(queryByTestId('scroll-edge-shadow-bottom')),
  }
}

test('a track whose content fits marks neither edge', () => {
  expect(
    edges({ scrollTop: 0, viewportHeight: 100, contentHeight: 100 }),
  ).toEqual({ top: false, bottom: false })
})

test('content taller than the viewport marks the bottom at the top of it', () => {
  expect(
    edges({ scrollTop: 0, viewportHeight: 100, contentHeight: 300 }),
  ).toEqual({ top: false, bottom: true })
})

test('mid-scroll marks both', () => {
  expect(
    edges({ scrollTop: 100, viewportHeight: 100, contentHeight: 300 }),
  ).toEqual({ top: true, bottom: true })
})

test('scrolled to the end marks the top alone', () => {
  expect(
    edges({ scrollTop: 200, viewportHeight: 100, contentHeight: 300 }),
  ).toEqual({ top: true, bottom: false })
})

// A fit/grow scale leaves float epsilon in contentHeight; without the slack a
// track that exactly fits would draw a permanent bottom fade, which is the one
// thing this must never do.
test('a sub-pixel overflow is not an overflow', () => {
  expect(
    edges({ scrollTop: 0, viewportHeight: 100, contentHeight: 100.2 }),
  ).toEqual({ top: false, bottom: false })
})

// Virtual-scroll displays don't self-correct like a native overflow container,
// so a scrollTop past the end must still read as "at the end" rather than
// marking both edges.
test('a scrollTop past the end still reads as the end', () => {
  expect(
    edges({ scrollTop: 9999, viewportHeight: 100, contentHeight: 300 }),
  ).toEqual({ top: true, bottom: false })
})

// Where each edge lands, which is the half a display gets wrong: `top` is the
// band stack a display pins above its scrolling region, and both edges are
// placed relative to it.
function spans(props: React.ComponentProps<typeof ScrollEdgeShadow>) {
  const { queryByTestId } = render(<ScrollEdgeShadow {...props} />)
  const read = (testId: string) => {
    const el = queryByTestId(testId)
    return el ? { top: el.style.top, height: el.style.height } : undefined
  }
  return {
    top: read('scroll-edge-shadow-top'),
    bottom: read('scroll-edge-shadow-bottom'),
  }
}

test('both edges are placed inside the viewport, not the display', () => {
  expect(
    spans({ scrollTop: 100, viewportHeight: 100, contentHeight: 300, top: 40 }),
  ).toEqual({
    top: { top: '40px', height: '16px' },
    bottom: { top: '124px', height: '16px' },
  })
})

// A viewport shorter than the shadow is reachable both ways — the variants
// displays floor availableHeight at 0 because lineZoneHeight alone can exceed
// the display height, and the pileup's coverage band drags up to the same
// place. Unclamped, the bottom edge is placed above the viewport's own top and
// inks the pinned band instead.
test('a viewport shorter than the shadow does not ink the band above it', () => {
  expect(
    spans({ scrollTop: 0, viewportHeight: 8, contentHeight: 300, top: 40 })
      .bottom,
  ).toEqual({ top: '40px', height: '8px' })
})

test('a zero-height viewport draws nothing above itself', () => {
  expect(
    spans({ scrollTop: 0, viewportHeight: 0, contentHeight: 300, top: 40 })
      .bottom,
  ).toEqual({ top: '40px', height: '0px' })
})
