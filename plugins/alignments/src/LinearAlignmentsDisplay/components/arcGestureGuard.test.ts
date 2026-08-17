import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { renderHook } from '@testing-library/react'

import { packedInterbaseSegments } from '../../RenderAlignmentDataRPC/testPileupData.ts'
import {
  applyView,
  createTestAlignmentsDisplay,
  oneReadWithMate,
} from '../testUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'

// The three gestures this file is about, and the whole rule between them: a
// mark that resolves as an arc for the HOVER has to resolve as an arc for the
// click and the right-click too. The hover is asked ahead of the pileup
// pipeline (`resolveHoverAt`), so without the same question in the other two an
// arc is a thing you can hover, and then click or right-click straight THROUGH
// onto whatever it is painted over.
//
// Which is not a hypothetical: `93af1f54f0` added the guard to `handleClick`
// alone, and the right-click it left behind was the sharper half — coverage
// answers a click with a widget and a right-click with nothing, but an
// interbase bar answers both, so the menu built for the column under the arc
// was fully populated and titled after a mark the cursor was not on.
//
// Every case here works one pixel — the one where an arc's ink lies over an
// interbase bar — and each states the guarded gesture against its own control:
// the SAME pixel with `readConnections` off, which is the only difference
// between "the guard suppressed this" and "there was nothing here anyway".

// The band's contents under the arc: full-depth coverage, and an interbase
// event every 10bp across the arc's span. Every 10, so that whichever pixel the
// scan below settles on, `hitTestInterbase`'s tolerance (3px, here 30bp) has a
// bar to find — the point is to be sure the pileup pipeline has a real answer
// at the arc's pixel, not to test its own tolerance.
function coverageUnder(data: WorkerPileupData): WorkerPileupData {
  const pos: number[] = []
  for (let p = 900; p <= 2100; p += 10) {
    pos.push(p)
  }
  const n = pos.length
  return {
    ...data,
    coverageStartPos: 0,
    coverageDepths: new Float32Array(3000).fill(10),
    // the drawn histogram, which is what `hitTestInterbase` measures against
    interbasePackedBuffer: packedInterbaseSegments(
      pos.map(position => ({
        position,
        yOffset: 0,
        height: 1,
        colorType: 1,
      })),
    ),
    interbaseMaxCount: 10,
    // the per-event tallies behind the tooltip and the widget; without them
    // `getInterbaseBin` answers undefined and the click opens nothing, which
    // would make the control indistinguishable from the guard working
    interbasePositions: new Uint32Array(pos),
    interbaseLengths: new Uint32Array(n).fill(5),
    interbaseTypes: new Uint8Array(n).fill(1),
    // The block counts are the other half of that: the reader binary-searches
    // the (insertions, softclips, hardclips) runs, so counts left at 0 answer
    // "no interbase events" and put the control back where it started. All n
    // events here are type 1.
    numInsertions: n,
    numSoftclips: 0,
    numHardclips: 0,
  }
}

function setup({ down }: { down: boolean }) {
  // The hover is coalesced onto an animation frame, so hold the callback and
  // run it by hand — `cb(0)` inline instead would leave `hoverRafRef` holding
  // the id assigned AFTER the callback returned, and every later move would see
  // a frame already queued and never schedule one.
  let frame: FrameRequestCallback | undefined
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    frame = cb
    return 1
  })

  const { view, display, session, openedWidgets } =
    createTestAlignmentsDisplay()
  applyView(view, 10, 0)
  display.setReadConnections('arc')
  display.setReadConnectionsDown(down)
  display.setRpcData(0, {
    groups: [
      { key: '', label: '', data: coverageUnder(oneReadWithMate(2000)) },
    ],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })

  const { result } = renderHook(() => useAlignmentsBase(display))
  const event = (x: number, y: number) => ({
    nativeEvent: { offsetX: x, offsetY: y },
    clientX: x,
    clientY: y,
    preventDefault: jest.fn(),
  })
  return {
    display,
    session,
    openedWidgets,
    // What the tooltip would say — the discriminant only, which is the whole
    // question here: which mark did this pixel resolve to.
    hover(x: number, y: number) {
      result.current.handleCanvasMouseMove(event(x, y) as never)
      const cb = frame
      frame = undefined
      cb?.(0)
      return (
        display.mouseoverExtraInformation as { type?: string } | undefined
      )?.type
    },
    click(x: number, y: number) {
      result.current.handleClick(event(x, y) as never)
    },
    // Returns the event, so a case can ask whether the handler took the menu
    // over (`preventDefault`) or let it fall through to the browser's.
    contextMenu(x: number, y: number) {
      const e = event(x, y)
      result.current.handleContextMenu(e as never)
      return e
    },
  }
}

// A pixel on the arc's ink, where the pileup underneath answers `underneath`.
//
// Found by asking the hover rather than by projecting the dome here: this file
// is about the three gestures agreeing with each other, and a fourth placement
// of the arc written into the test would be free to disagree with all of them —
// which is the drift `arcMark` exists to prevent, reintroduced in the test that
// checks it.
//
// `underneath` is read with the arcs switched OFF, which is what makes it the
// pileup's own answer: with them on the hover would just say 'arc' again, that
// being the whole point.
function arcPixelOver(
  t: ReturnType<typeof setup>,
  underneath: string | undefined,
) {
  const arcPixels: [number, number][] = []
  for (let x = 90; x <= 220; x += 2) {
    for (let y = 0; y <= 90; y++) {
      if (t.hover(x, y) === 'arc') {
        arcPixels.push([x, y])
      }
    }
  }
  t.display.setReadConnections('off')
  const found = arcPixels.find(([x, y]) => t.hover(x, y) === underneath)
  t.display.setReadConnections('arc')
  return found
}

test('an arc over an interbase bar: the hover names the arc, and so do the other two gestures', () => {
  const t = setup({ down: false })
  const pixel = arcPixelOver(t, 'indicator')
  // Not a formality: every case below is vacuous without it, and the two ways
  // it goes missing — the arc band moving off the coverage band, or the arc
  // ceasing to be hoverable at all — are both things this file is here to
  // catch rather than to skip over.
  expect(pixel).toBeDefined()
  const [x, y] = pixel!

  // The control, at the same pixel: with arcs off the pileup pipeline answers
  // here, and answers with a mark that has BOTH a widget and a menu. Each
  // assertion below is the negative of one of these.
  t.display.setReadConnections('off')
  expect(t.hover(x, y)).toBe('indicator')
  t.click(x, y)
  expect(t.openedWidgets).toHaveLength(1)
  expect(t.contextMenu(x, y).preventDefault).toHaveBeenCalled()
  expect(t.display.contextMenuAnchor).toBeDefined()
  expect(t.display.contextMenuHit?.indicatorHit).toBeDefined()

  t.display.closeContextMenu()
  t.openedWidgets.length = 0
  t.display.setReadConnections('arc')

  expect(t.hover(x, y)).toBe('arc')
  t.click(x, y)
  expect(t.openedWidgets).toHaveLength(0)
  // No `preventDefault` either: an arc has nothing to offer, and a mark with
  // nothing to offer falls through to the browser's own menu here. It is now
  // the ONLY such mark — coverage used to fall through beside it and no longer
  // does — so this is the whole of that rule rather than an example of it.
  expect(t.contextMenu(x, y).preventDefault).not.toHaveBeenCalled()
  expect(t.display.contextMenuAnchor).toBeUndefined()
})

test('clicking an arc with nothing under it keeps the selection', () => {
  // Down mode, where the arc band is its own strip below coverage and the
  // pileup hit test answers `none` inside it. `none` is not inert — it is the
  // branch that CLEARS THE SELECTION — so an unguarded click on an arc threw
  // away the read the user had selected, and this is the half that hides,
  // because nothing opens and nothing looks wrong.
  const t = setup({ down: true })
  const pixel = arcPixelOver(t, undefined)
  expect(pixel).toBeDefined()
  const [x, y] = pixel!

  const feature = new SimpleFeature({
    uniqueId: 'selected-read',
    refName: 'ctgA',
    start: 1000,
    end: 1100,
  })
  t.session.setSelection(feature)
  t.display.setReadConnections('off')
  t.click(x, y)
  expect(t.session.selection).toBeUndefined()

  t.session.setSelection(feature)
  t.display.setReadConnections('arc')
  t.click(x, y)
  expect(t.session.selection).toBe(feature)
})
