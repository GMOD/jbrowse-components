import { useRef } from 'react'

import { act, render } from '@testing-library/react'

import { SCROLL_ZOOM_HINT_ATTR, useScrollZoomHint } from './usePanZoom.ts'

// The wheel decision matrix belongs to wheelZoom.test and the drag half to
// usePanZoom.test; what is tested here is the second gate — that the prompt
// appears only for a wheel that moved *nothing* — and that it holds and clears
// the way the UI needs it to.

// must match the hook's own SETTLE_MS; the linger is the one the harness passes
const SETTLE_MS = 150
const LINGER_MS = 5000
// must match the hook's own HINT_MAX_MS, the one timer nothing can hold off
const HINT_MAX_MS = 15000

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

function Harness({
  view,
  enabled = true,
  onShow,
  onAnswered,
}: {
  view: ReturnType<typeof makeView>
  enabled?: boolean
  onShow?: () => void
  onAnswered?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { showZoomHint, dismissZoomHint, setZoomHintHeld } = useScrollZoomHint(
    ref,
    view,
    { lingerMs: LINGER_MS, enabled, onShow, onAnswered },
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

// A held prompt is the one that gets stuck: `held` is latched by a pointer that
// arrived and is released by a `mouseleave` that, in the cases below, never
// comes. Everything here is about it going away anyway.
test('a held prompt still goes away eventually', () => {
  const { el } = setup()
  wheel(el)
  settle()
  act(() => {
    held(true)
  })
  // the pointer entered and never left — a tab switch, or the card drawn under
  // a cursor that then stopped moving
  advance(HINT_MAX_MS + 1)
  expect(el.textContent).toBe('')
})

test('a hold taken while it is down is ignored', () => {
  const { el } = setup()
  // the card is still in the DOM through its fade-out, so the pointer can
  // reach it after the prompt is logically gone
  act(() => {
    held(true)
  })
  wheel(el)
  settle()
  expect(el.textContent).toBe('hint')
  // that stale hold must not be keeping this raise alive
  advance(LINGER_MS)
  expect(el.textContent).toBe('')
})

test('escape takes it down', () => {
  const { el } = setup()
  wheel(el)
  settle()
  act(() => {
    held(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
  expect(el.textContent).toBe('')
})

test('a press anywhere else takes it down, a press on it does not', () => {
  const { el } = setup()
  wheel(el)
  settle()

  // the prompt's own element, marked so its button's press isn't a dismissal
  const card = document.createElement('div')
  card.setAttribute(SCROLL_ZOOM_HINT_ATTR, '')
  document.body.append(card)
  act(() => {
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  })
  expect(el.textContent).toBe('hint')

  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  })
  expect(el.textContent).toBe('')
  card.remove()
})

test('a ctrl+wheel takes it down — they did the thing it asked', () => {
  const { el } = setup()
  wheel(el)
  settle()
  act(() => {
    held(true)
  })
  wheel(el, { ctrlKey: true })
  expect(el.textContent).toBe('')
})

test('switching away from the tab takes it down', () => {
  const { el } = setup()
  wheel(el)
  settle()
  // the case `held` cannot recover from on its own: the pointer is on the card
  // and the `mouseleave` is never dispatched
  act(() => {
    held(true)
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(el.textContent).toBe('')
})

test('dismissing drops a verdict still pending behind it', () => {
  const { el } = setup()
  wheel(el)
  settle()
  act(() => {
    dismiss()
  })
  // a wheel arriving as it was dismissed must not raise it again a moment later
  wheel(el)
  act(() => {
    dismiss()
  })
  settle()
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

// The caller owns the budget (JBrowse spends one session-wide across every
// view), so what is checked here is that the hook asks and reports honestly.
test('a spent budget raises nothing', () => {
  const { getByTestId } = render(<Harness view={makeView()} enabled={false} />)
  const el = getByTestId('c')
  wheel(el)
  settle()
  expect(el.textContent).toBe('')
  // and nothing is left pending to fire if the budget comes back
  expect(jest.getTimerCount()).toBe(0)
})

test('one raise is charged once, however long the user keeps pushing', () => {
  const onShow = jest.fn()
  const { getByTestId } = render(<Harness view={makeView()} onShow={onShow} />)
  const el = getByTestId('c')
  wheel(el)
  settle()
  expect(onShow).toHaveBeenCalledTimes(1)

  // still pushing at the bottom of the page: the prompt is held up, not
  // re-raised, so the budget is not spent again mid-gesture
  for (let i = 0; i < 5; i++) {
    wheel(el)
    advance(100)
  }
  expect(getByTestId('c').textContent).toBe('hint')
  expect(onShow).toHaveBeenCalledTimes(1)

  // a fresh attempt after it has cleared is a second interruption, and is
  // charged as one
  advance(LINGER_MS)
  wheel(el)
  settle()
  expect(onShow).toHaveBeenCalledTimes(2)
})

// The budget exists for a user who might not have noticed the prompt. An answer
// says they did, and is worth more than one raise — but only escape and the
// card's own button are answers, and the caller is the one that decides what an
// answer costs.
test('escape is an answer; timing out and a tab switch are not', () => {
  const onAnswered = jest.fn()
  const { getByTestId } = render(
    <Harness view={makeView()} onAnswered={onAnswered} />,
  )
  const el = getByTestId('c')

  wheel(el)
  settle()
  advance(LINGER_MS)
  expect(el.textContent).toBe('')
  expect(onAnswered).not.toHaveBeenCalled()

  wheel(el)
  settle()
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(onAnswered).not.toHaveBeenCalled()

  wheel(el)
  settle()
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
  expect(onAnswered).toHaveBeenCalledTimes(1)
})

test('a press on the app is not an answer — it is "not now"', () => {
  const onAnswered = jest.fn()
  const { getByTestId } = render(
    <Harness view={makeView()} onAnswered={onAnswered} />,
  )
  const el = getByTestId('c')
  wheel(el)
  settle()
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  })
  expect(el.textContent).toBe('')
  expect(onAnswered).not.toHaveBeenCalled()
})

test('the host acting on the prompt is an answer', () => {
  const onAnswered = jest.fn()
  const { getByTestId } = render(
    <Harness view={makeView()} onAnswered={onAnswered} />,
  )
  wheel(getByTestId('c'))
  settle()
  act(() => {
    // what the card's "Always zoom on scroll" button does
    dismiss()
  })
  expect(onAnswered).toHaveBeenCalledTimes(1)
})

test('a wheel the page scrolled is not charged', () => {
  const onShow = jest.fn()
  const { getByTestId } = render(<Harness view={makeView()} onShow={onShow} />)
  wheel(getByTestId('c'))
  pageScrolls()
  settle()
  expect(onShow).not.toHaveBeenCalled()
})

test('a pending verdict is dropped on unmount', () => {
  const { el, unmount } = setup()
  wheel(el)
  unmount()
  // nothing left pending to fire against a gone component
  expect(jest.getTimerCount()).toBe(0)
})

// The gestures bind to part of the view (JBrowse's tracks area) and the chrome
// around them is left to the page on purpose. These pin the difference between
// "left to the page" and "taken by it" — see useOuterDeadWheels.

function OuterHarness({ view }: { view: ReturnType<typeof makeView> }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const { showZoomHint } = useScrollZoomHint(innerRef, view, {
    lingerMs: LINGER_MS,
    outerRef,
  })
  return (
    <div ref={outerRef} data-testid="outer">
      {showZoomHint ? 'hint' : ''}
      <div data-testid="chrome" />
      <div ref={innerRef} data-testid="inner" />
    </div>
  )
}

function setupOuter(view = makeView()) {
  const utils = render(<OuterHarness view={view} />)
  return { ...utils, chrome: utils.getByTestId('chrome') }
}

test('a wheel over the chrome that moved nothing raises the prompt', () => {
  const { chrome, getByTestId } = setupOuter()
  wheel(chrome)
  settle()
  expect(getByTestId('outer').textContent).toBe('hint')
})

test('a wheel over the chrome the page scrolled stays quiet', () => {
  const { chrome, getByTestId } = setupOuter()
  wheel(chrome)
  pageScrolls()
  settle()
  expect(getByTestId('outer').textContent).toBe('')
})

test('the chrome says nothing once scroll-to-zoom is on', () => {
  const { chrome, getByTestId } = setupOuter(makeView(true))
  wheel(chrome)
  settle()
  expect(getByTestId('outer').textContent).toBe('')
})

test('a wheel over the chrome a display consumed raises nothing', () => {
  const { chrome, getByTestId } = setupOuter()
  wheel(chrome, { consumed: true })
  settle()
  expect(getByTestId('outer').textContent).toBe('')
})

test('a gesture the tracks released is not re-reported by the chrome', () => {
  const { getByTestId } = setupOuter()
  const inner = getByTestId('inner')
  // the pointer left the tracks, so the controller stops taking the wheel
  // events the browser keeps latching there (see trackPointerPresence)
  act(() => {
    inner.dispatchEvent(new MouseEvent('mouseleave'))
  })
  wheel(inner)
  settle()
  expect(getByTestId('outer').textContent).toBe('')
})
