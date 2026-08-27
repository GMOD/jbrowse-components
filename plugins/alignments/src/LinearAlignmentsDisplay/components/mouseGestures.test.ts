import { renderHook } from '@testing-library/react'

import {
  applyView,
  createTestAlignmentsDisplay,
  makeEmptyPileupData,
  oneReadWithMate,
} from '../testUtils.ts'
import { useAlignmentsBase } from './useAlignmentsBase.ts'

// The handlers that are pure guard: none does anything visible when it works,
// so each fails silently. The pan itself is the LGV's (`useSideScroll`); what
// is this display's is declining to act on top of it — no hover while it runs,
// no click when it ends — and holding the hover a context menu pinned.

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

  // TracksContainer in miniature: the LGV's pan writes its state as attributes
  // on the container, and the canvas handlers read them with `closest`.
  const container = document.createElement('div')
  const canvas = document.createElement('canvas')
  container.append(canvas)
  function panStarts() {
    container.dataset.panDragging = ''
  }
  function panMoves() {
    container.dataset.panMoved = ''
  }
  function panEnds() {
    delete container.dataset.panDragging
  }
  function hover() {
    result.current.handleCanvasMouseMove({
      currentTarget: canvas,
      nativeEvent: { offsetX: 100, offsetY: 20 },
    } as never)
  }
  function click() {
    result.current.handleClick({
      currentTarget: canvas,
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
    panStarts,
    panMoves,
    panEnds,
    hover,
    click,
    contextMenu,
    runFrame,
    queuedFrame: () => frame !== undefined,
    hook: result,
  }
}

test('a pan swallows the click that ends it, but a small wobble does not', () => {
  // The control first: that pixel is a coverage bin, and clicking one opens its
  // widget. Every assertion below is this not happening.
  const plain = setup()
  plain.click()
  expect(plain.openedWidgets).toHaveLength(1)

  const panned = setup()
  panned.panStarts()
  panned.panMoves()
  panned.panEnds()
  panned.click()
  expect(panned.openedWidgets).toHaveLength(0)

  // A press that never travelled past the threshold sets no `data-pan-moved`,
  // and is still a click — otherwise a hand that wobbles two pixels stops being
  // able to select anything.
  const jitter = setup()
  jitter.panStarts()
  jitter.panEnds()
  jitter.click()
  expect(jitter.openedWidgets).toHaveLength(1)
})

test('no hover lands while the view is being panned', () => {
  const { display, hover, panStarts, panEnds, runFrame, queuedFrame } = setup()

  panStarts()
  hover()
  expect(queuedFrame()).toBe(false)
  expect(display.mouseoverExtraInformation).toBeUndefined()

  // Queued before the press: the frame has to re-ask, since the event-time
  // guard saw no pan yet.
  panEnds()
  hover()
  panStarts()
  runFrame()
  expect(display.mouseoverExtraInformation).toBeUndefined()

  panEnds()
  hover()
  runFrame()
  expect(display.mouseoverExtraInformation).toBeDefined()
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

// Opening the menu clears the tooltip and pins the hover to the menu's read. A
// hover frame queued by the mousemove just before the right-click would land
// after that, on top of the pin: the open cancels the frame, and the model
// refuses hover writes while the menu is up in case one still arrives.
test('a hover queued before a right-click does not land on the open menu', () => {
  const { display, hover, contextMenu, runFrame, queuedFrame } = setup()

  hover()
  expect(queuedFrame()).toBe(true)
  contextMenu()
  expect(queuedFrame()).toBe(false)
  runFrame()
  expect(display.mouseoverExtraInformation).toBeUndefined()

  display.closeContextMenu()
  display.openContextMenu({ clientX: 0, clientY: 0, featureId: 'r0' })
  display.setHoverState({
    overCigarItem: false,
    featureIdUnderMouse: undefined,
    mouseoverExtraInformation: undefined,
    highlightedChainReadIds: [],
    hoverCoverageBand: undefined,
  })
  expect(display.featureIdUnderMouse).toBe('r0')
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
  display.openContextMenu({ clientX: 0, clientY: 0, featureId: 'r0' })
  hook.current.handleMouseLeave()
  expect(display.featureIdUnderMouse).toBe('r0')
})
