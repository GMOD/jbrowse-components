import { useRef } from 'react'

import { act, render } from '@testing-library/react'

import { useScrollZoomHint } from './useScrollZoomHint.ts'

// The wheel decision matrix belongs to wheelZoom.test and the raw
// `onModifierNeeded` signal to usePanZoom.test; what is tested here is the
// second gate — that the prompt appears only for a wheel that moved *nothing* —
// and that it holds and clears the way the UI needs it to.

// must match the hook's own constants
const SETTLE_MS = 150
const LINGER_MS = 5000

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// The verdict compares the wheel's timeStamp against the last scroll's, so the
// clock has to move for the tests to mean anything. Jest's fake timers drive
// `performance.now()`, which is where jsdom stamps its events from.
function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms)
  })
}

function settle() {
  advance(SETTLE_MS + 1)
}

// The gate listens for a real scroll event rather than measuring layout, which
// is the one part of this jsdom reproduces faithfully: dispatch what the browser
// would have dispatched had the page taken the gesture.
function pageScrolls(el: Element = document.body) {
  act(() => {
    el.dispatchEvent(new Event('scroll'))
  })
}

function makeView(scrollZoom = false) {
  return {
    bpPerPx: 10,
    scrollZoom,
    zoomTo: jest.fn(),
    horizontalScroll: jest.fn(),
  }
}

let held: (value: boolean) => void
let dismiss: () => void

function Harness({ view }: { view: ReturnType<typeof makeView> }) {
  const ref = useRef<HTMLDivElement>(null)
  const { showZoomHint, dismissZoomHint, setZoomHintHeld } = useScrollZoomHint(
    ref,
    view,
  )
  held = setZoomHintHeld
  dismiss = dismissZoomHint
  return (
    <div ref={ref} data-testid="c">
      {showZoomHint ? 'hint' : ''}
    </div>
  )
}

function wheel(
  el: Element,
  init: WheelEventInit & { consumed?: boolean } = {},
) {
  const { consumed, ...rest } = init
  act(() => {
    const event = new WheelEvent('wheel', {
      cancelable: true,
      bubbles: true,
      deltaY: 40,
      ...rest,
    })
    if (consumed) {
      // what a display's own virtual scroll has already done by the time the
      // event bubbles out to the view
      event.preventDefault()
    }
    el.dispatchEvent(event)
  })
}

function setup(view = makeView()) {
  const utils = render(<Harness view={view} />)
  return { ...utils, el: utils.getByTestId('c') }
}

test('a wheel that moved nothing at all raises the prompt', () => {
  const { el } = setup()
  wheel(el)
  settle()
  expect(el.textContent).toBe('hint')
})

test('the verdict waits for the wheel to go quiet', () => {
  const { el } = setup()
  wheel(el)
  // the scroll a wheel causes arrives a frame or more after the wheel itself,
  // so an early verdict would call a scrolling gesture dead
  advance(SETTLE_MS - 20)
  expect(el.textContent).toBe('')
  pageScrolls()
  settle()
  expect(el.textContent).toBe('')
})

test('a wheel the page scrolled stays quiet', () => {
  const { el } = setup()
  wheel(el)
  // the browser takes the gesture and scrolls something — anything, at any
  // depth; the stamp is on the document in capture phase
  pageScrolls()
  settle()
  // the gesture did something, so there is nothing to tell the user. This is
  // the case scroll-to-zoom being off is *for*
  expect(el.textContent).toBe('')
})

test('scrolling to the bottom and pushing on still raises it', () => {
  const { el } = setup()
  // the case this whole thing exists to catch, and the one a per-gesture
  // verdict gets wrong: one unbroken run of wheel events whose first half
  // scrolls and whose second half is dead
  for (let i = 0; i < 5; i++) {
    wheel(el)
    advance(20)
    pageScrolls()
    advance(100)
  }
  expect(el.textContent).toBe('')

  // now the page is at its end and the scrolls stop coming
  for (let i = 0; i < 5; i++) {
    wheel(el)
    advance(120)
  }
  settle()
  expect(el.textContent).toBe('hint')
})

test('a wheel a display consumed raises nothing', () => {
  const { el } = setup()
  // a pileup scrolling its reads paints from a model offset, not a DOM
  // scroller, so it fires no scroll event — preventDefault is the only trace
  wheel(el, { consumed: true })
  settle()
  expect(el.textContent).toBe('')
})

test('a wheel that zoomed raises nothing', () => {
  const scrollZoomOn = setup(makeView(true))
  wheel(scrollZoomOn.el)
  settle()
  expect(scrollZoomOn.el.textContent).toBe('')
  scrollZoomOn.unmount()

  // ctrl+wheel already zooms whatever the preference is
  const ctrl = setup()
  wheel(ctrl.el, { ctrlKey: true })
  settle()
  expect(ctrl.el.textContent).toBe('')
})

test('the prompt clears itself, and a later wheel raises it again', () => {
  const { el } = setup()
  wheel(el)
  settle()
  expect(el.textContent).toBe('hint')

  advance(LINGER_MS)
  expect(el.textContent).toBe('')

  wheel(el)
  settle()
  expect(el.textContent).toBe('hint')
})

test('wheeling on while it is up keeps it up', () => {
  const { el } = setup()
  wheel(el)
  settle()

  advance(LINGER_MS - 1000)
  wheel(el)
  advance(LINGER_MS - 1000)
  expect(el.textContent).toBe('hint')

  advance(LINGER_MS)
  expect(el.textContent).toBe('')
})

test('holding it open survives the timer, and releasing restarts it', () => {
  const { el } = setup()
  wheel(el)
  settle()

  act(() => {
    held(true)
  })
  advance(LINGER_MS * 2)
  // the pointer is on the button; it must not vanish out from under the click
  expect(el.textContent).toBe('hint')

  act(() => {
    held(false)
  })
  expect(el.textContent).toBe('hint')
  advance(LINGER_MS)
  expect(el.textContent).toBe('')
})

test('dismissing clears it immediately', () => {
  const { el } = setup()
  wheel(el)
  settle()
  act(() => {
    dismiss()
  })
  expect(el.textContent).toBe('')
})

test('a pending verdict is dropped on unmount', () => {
  const { el, unmount } = setup()
  wheel(el)
  unmount()
  // nothing left pending to fire against a gone component
  expect(jest.getTimerCount()).toBe(0)
})
