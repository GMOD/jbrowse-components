import { renderHook } from '@testing-library/react'

import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
  oneReadWithMate,
} from '../testUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

// `handleMouseDown` and `handleMouseLeave`, the two handlers that are pure
// guard: neither does anything visible when it works, so both fail silently.
//
// The press decides between three gestures that share one button-down —
// this display's pan, the LGV's shift+drag rubberband, and the browser's own
// context menu / autoscroll — and it decides by DECLINING two of them. A
// decline that stops working looks like the other gesture never firing, which
// is a bug reported against the LGV rather than against here.

const START = 300

function setup() {
  // The hover is coalesced onto an animation frame; hold the callback so a case
  // can decide whether it lands, which is the whole question for the leave.
  let frame: FrameRequestCallback | undefined
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    frame = cb
    return 1
  })
  // Stubbed too, and load-bearing: without it the real `cancelAnimationFrame`
  // has no id of ours to cancel, the held callback runs anyway, and the case
  // below reads as the leave failing to drop a queued hover when in fact the
  // harness never let it.
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frame = undefined
  })
  const runFrame = () => {
    const cb = frame
    frame = undefined
    cb?.(0)
  }
  const { view, display, openedWidgets } = createTestAlignmentsDisplay()
  applyView(view, 10, START)
  display.setRpcData(0, {
    groups: [
      {
        key: '',
        label: '',
        data: {
          ...makeEmptyPileupData(),
          ...oneReadWithMate(),
          coverageStartPos: 0,
          coverageDepths: new Float32Array(10_000).fill(10),
        },
      },
    ],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  const { result } = renderHook(() => useAlignmentsBase(display))

  function press({ button = 0, shiftKey = false } = {}) {
    const stopPropagation = jest.fn()
    result.current.handleMouseDown({
      button,
      shiftKey,
      clientX: 100,
      clientY: 50,
      stopPropagation,
    } as never)
    return { stopPropagation }
  }
  // A real document-level drag, which is where the pan lives: `startDocumentDrag`
  // listens on `document`, not on the canvas, so a press that declined to start
  // one is invisible until something moves.
  function dragTo(clientX: number) {
    document.dispatchEvent(
      new MouseEvent('mousemove', { clientX, clientY: 50 }),
    )
  }
  function release() {
    document.dispatchEvent(new MouseEvent('mouseup'))
  }
  function hover() {
    result.current.handleCanvasMouseMove({
      nativeEvent: { offsetX: 100, offsetY: 20 },
    } as never)
  }
  function contextMenu() {
    const preventDefault = jest.fn()
    result.current.handleContextMenu({
      nativeEvent: { offsetX: 100, offsetY: 20 },
      clientX: 100,
      clientY: 50,
      preventDefault,
    } as never)
    return { preventDefault }
  }
  return {
    view,
    display,
    openedWidgets,
    press,
    dragTo,
    release,
    hover,
    contextMenu,
    runFrame,
    hook: result,
  }
}

afterEach(() => {
  // a test that asserts a drag DIDN'T start leaves no listener; one that
  // asserts it did would leak it into the next case
  document.dispatchEvent(new MouseEvent('mouseup'))
})

test('the primary button pans, and the pan is what the other cases are measured against', () => {
  const { view, press, dragTo } = setup()
  const { stopPropagation } = press()
  // taken over from the LGV's own drag handling, which is the difference
  // between this display panning and the view doing it
  expect(stopPropagation).toHaveBeenCalled()
  dragTo(60)
  expect(view.offsetPx).toBe(START + 40)
})

test('a right or middle press starts no pan, so the browser menu still gets it', () => {
  for (const button of [1, 2]) {
    const { view, press, dragTo } = setup()
    const { stopPropagation } = press({ button })
    expect(stopPropagation).not.toHaveBeenCalled()
    dragTo(60)
    expect(view.offsetPx).toBe(START)
  }
})

test("shift+drag is the view's rubberband, and must reach it", () => {
  const { view, press, dragTo } = setup()
  const { stopPropagation } = press({ shiftKey: true })
  // NOT stopped: it has to bubble to the LGV's TracksContainer, which checks
  // `event.shiftKey` itself. Swallowing it here is how the region-select
  // gesture goes dead over this one track and nowhere else.
  expect(stopPropagation).not.toHaveBeenCalled()
  dragTo(60)
  expect(view.offsetPx).toBe(START)
})

test('a pan swallows the click that ends it, but a small wobble does not', () => {
  const click = (t: ReturnType<typeof setup>) => {
    t.hook.current.handleClick({
      nativeEvent: { offsetX: 100, offsetY: 20 },
    } as never)
  }

  // The control first: that pixel is a coverage bin, and clicking one opens its
  // widget. Every assertion below is this not happening.
  const plain = setup()
  click(plain)
  expect(plain.openedWidgets).toHaveLength(1)

  const panned = setup()
  panned.press()
  panned.dragTo(140)
  panned.release()
  expect(panned.view.offsetPx).not.toBe(START)
  click(panned)
  expect(panned.openedWidgets).toHaveLength(0)

  // Under CLICK_SUPPRESS_THRESHOLD_PX the press is still a click — otherwise a
  // hand that wobbles two pixels stops being able to select anything. The view
  // pans by those two pixels either way; it is only the click that is judged.
  const jitter = setup()
  jitter.press()
  jitter.dragTo(102)
  jitter.release()
  expect(jitter.view.offsetPx).toBe(START - 2)
  click(jitter)
  expect(jitter.openedWidgets).toHaveLength(1)
})

// Same pixel the click case above opens a coverage widget from. Right-clicking
// it used to resolve nothing, so the browser's own menu came up over the depth
// histogram — the one mark with a widget behind it that offered no menu.
test('right-clicking a coverage bin opens the pileup menu, not the browser one', () => {
  const { display, contextMenu } = setup()
  const { preventDefault } = contextMenu()
  expect(preventDefault).toHaveBeenCalled()
  expect(display.contextMenuHit?.coverageHit).toBeDefined()
  expect(
    display
      .contextMenuItems()
      .map((i: unknown) => (i as { label?: string }).label),
  ).toContain('Coverage')
})

test('leaving the canvas drops the hover, unless a context menu is holding it', () => {
  const { display, hover, runFrame, hook } = setup()

  hover()
  runFrame()
  // Non-vacuous: without this the case below passes on a hover that never
  // landed, which is the same assertion for the opposite reason.
  expect(display.mouseoverExtraInformation).toBeDefined()
  hook.current.handleMouseLeave()
  expect(display.mouseoverExtraInformation).toBeUndefined()

  // A hover queued but not yet landed has to be dropped, not just outrun: the
  // display is detached from the tree before React unmounts it, so a frame
  // landing after the leave writes hover state onto a node on its way out.
  hover()
  hook.current.handleMouseLeave()
  runFrame()
  expect(display.mouseoverExtraInformation).toBeUndefined()

  // An open context menu pins the hover to the read it acts on — the cursor is
  // over the MENU, which is outside the canvas, so the leave that opening it
  // produces must not take the highlight with it.
  display.openContextMenu({ anchor: { clientX: 0, clientY: 0 } })
  display.setHoverState({
    overCigarItem: false,
    featureIdUnderMouse: 'r0',
    mouseoverExtraInformation: undefined,
    highlightedChainReadIds: [],
    hoverCoverageBand: undefined,
  })
  hook.current.handleMouseLeave()
  expect(display.featureIdUnderMouse).toBe('r0')
})
