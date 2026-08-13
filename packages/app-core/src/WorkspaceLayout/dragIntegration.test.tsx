import { useMemo } from 'react'

import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'

import JBrowseTabMenu from '../ui/App/JBrowseTabMenu.tsx'
import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspaceLayoutMixin } from './model.ts'
import { useLayoutDrag } from './useLayoutDrag.ts'

import type { TabNode } from './tree.ts'

/**
 * The wiring, end to end: a pointer gesture on a tab reaches the layout.
 *
 * jsdom has no layout engine, so `getBoundingClientRect` and
 * `elementsFromPoint` are stubbed from a map of panel id -> rect. That means
 * this test covers the wiring and NOT the geometry — the geometry is
 * `dropZone.test.ts`, which is pure and needs no DOM at all. Splitting them
 * that way is deliberate: a test that stubs the thing it is checking proves
 * nothing, and drag-and-drop is mostly geometry.
 */

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

const Harness = observer(function Harness({
  session,
  tabMenu,
  onTabClose,
}: {
  session: ReturnType<typeof TestSession.create>
  /** draw the real per-tab menu in the label, as `WorkspaceContainer` does */
  tabMenu?: boolean
  onTabClose?: (tabId: string) => void
}) {
  const { drag, handlers } = useLayoutDrag(session)
  return (
    <LayoutRenderer
      node={session.tree}
      layout={session}
      drag={drag}
      chrome={{
        dragHandlers: handlers,
        onTabClose,
        renderTabLabel: tab => (
          <>
            <span data-testid={`tab-${tab.id}`}>{tab.id}</span>
            {tabMenu ? (
              <JBrowseTabMenu
                onRename={() => {}}
                onClose={() => {
                  session.closeTab(tab.id)
                }}
              />
            ) : null}
          </>
        ),
        renderTabContent: tab => <div>{tab.viewIds.join(',')}</div>,
      }}
    />
  )
})

const NO_RECT = { left: 0, top: 0, width: 0, height: 0 } as DOMRect

/**
 * Rects are keyed by panel id, `strip:<panelId>` and `tab:<tabId>`. A key that
 * is absent measures zero, which is how the tests that only care about panel
 * bodies opt out of the strip entirely — a zero-width strip contains no point,
 * so `elementsFromPoint` never reports one and the drag takes the panel path.
 */
function stubGeometry(rects: Record<string, DOMRect>) {
  const rectFor = (el: HTMLElement) => {
    if (el.dataset.panelId) {
      return rects[el.dataset.panelId]
    }
    if (el.dataset.tabId) {
      return rects[`tab:${el.dataset.tabId}`]
    }
    if ('tabStrip' in el.dataset) {
      const panelId =
        el.closest<HTMLElement>('[data-panel-id]')?.dataset.panelId
      return panelId ? rects[`strip:${panelId}`] : undefined
    }
    return undefined
  }

  Element.prototype.getBoundingClientRect = function () {
    return rectFor(this as HTMLElement) ?? NO_RECT
  }
  document.elementsFromPoint = (x: number, y: number) =>
    [
      ...document.querySelectorAll(
        '[data-panel-id],[data-tab-strip],[data-tab-id]',
      ),
    ].filter(el => {
      const r = rectFor(el as HTMLElement)
      return (
        !!r &&
        r.width > 0 &&
        x >= r.left &&
        x <= r.left + r.width &&
        y >= r.top &&
        y <= r.top + r.height
      )
    })
}

// pointer capture is not implemented in jsdom
beforeAll(() => {
  Element.prototype.setPointerCapture = () => {}
  Element.prototype.releasePointerCapture = () => {}
})

function setup(tabMenu?: boolean, onTabClose?: (tabId: string) => void) {
  const session = TestSession.create({ name: 't' })
  const left = session.panels[0]!.id
  const tabA = session.tabs[0]!.id
  session.addViewToTab(tabA, 'view-1')
  const rightPanel = session.splitPanel(left, 'row')!
  const right = rightPanel.id
  session.addViewToTab(rightPanel.tabs[0]!.id, 'view-3')

  stubGeometry({
    [left]: { left: 0, top: 0, width: 400, height: 400 } as DOMRect,
    [right]: { left: 400, top: 0, width: 400, height: 400 } as DOMRect,
  })
  const { container } = render(
    <Harness session={session} tabMenu={tabMenu} onTabClose={onTabClose} />,
  )
  return { session, left, right, tabA, container }
}

// Pointer capture routes POINTER events to the tab and does nothing for the
// keyboard, so the listener is on `window` — focus during a drag is wherever it
// was when the drag started, which is not the tab.
test('Escape abandons a drag in flight, and it does not resume', () => {
  const { session, left, tabA } = setup()
  const tab = screen.getByTestId(`tab-${tabA}`)

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 600, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeTruthy()

  act(() => {
    fireEvent.keyDown(window, { key: 'Escape' })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()

  // the drag is rebuilt from `pending` on every move, so cancelling only what
  // is on screen would let the next pixel of movement bring it back
  act(() => {
    fireEvent.pointerMove(tab, { clientX: 650, clientY: 220 })
    fireEvent.pointerUp(tab, { clientX: 650, clientY: 220 })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()
  expect(session.findTab(tabA)?.panel.id).toBe(left)
  expect(session.panels).toHaveLength(2)
})

describe('middle-click closes a tab', () => {
  // RTL has no `fireEvent.auxClick`, and `auxclick` is the event React's
  // `onAuxClick` listens for — a plain `click` never carries button 1
  const auxClick = (el: Element, button: number) =>
    fireEvent(
      el,
      new MouseEvent('auxclick', { button, bubbles: true, cancelable: true }),
    )

  test('the middle button closes rather than dragging', () => {
    const closed: string[] = []
    const { session, tabA } = setup(false, id => closed.push(id))
    const tab = screen.getByTestId(`tab-${tabA}`)
    const before = session.panels.map(p => p.id)

    act(() => {
      fireEvent.pointerDown(tab, { button: 1, clientX: 10, clientY: 10 })
      // a middle-press that wanders must not become a drag
      fireEvent.pointerMove(tab, { button: 1, clientX: 600, clientY: 200 })
    })
    expect(document.querySelector('[data-drop-indicator]')).toBeNull()

    act(() => {
      auxClick(tab, 1)
    })

    expect(closed).toEqual([tabA])
    // the handler reports; the CALLER closes, because closing a tab also has to
    // close its views and the layout does not own them
    expect(session.panels.map(p => p.id)).toEqual(before)
  })

  test('the right button does nothing, so the context menu is left alone', () => {
    const closed: string[] = []
    const { tabA } = setup(false, id => closed.push(id))
    const tab = screen.getByTestId(`tab-${tabA}`)

    act(() => {
      auxClick(tab, 2)
    })

    expect(closed).toEqual([])
  })
})

/**
 * A drag starts on the primary button of the primary pointer, and nothing else.
 *
 * dockview never had to say this: its tab drags over HTML5 dnd, where the
 * browser owns the rule, and its pointer source is touch/pen only by default.
 * Pointer events here are for capture, which means owning the rule as well.
 */
describe('which press starts a drag', () => {
  test('the right button does not drag a tab', () => {
    const { session, left, tabA } = setup()
    const tab = screen.getByTestId(`tab-${tabA}`)

    act(() => {
      fireEvent.pointerDown(tab, { button: 2, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { button: 2, clientX: 600, clientY: 200 })
    })
    expect(document.querySelector('[data-drop-indicator]')).toBeNull()

    act(() => {
      fireEvent.pointerUp(tab, { button: 2, clientX: 600, clientY: 200 })
    })
    expect(session.findTab(tabA)?.panel.id).toBe(left)
    expect(session.panels).toHaveLength(2)
  })

  // The shape that made it more than a curiosity: a native context menu eats
  // the `pointerup` that would have cleared `pending`, so a right-press armed a
  // drag that the next move of a BUTTON-LESS pointer started, and the click
  // dismissing the menu dropped the tab wherever it had got to.
  test('a right press left hanging arms nothing', () => {
    const { tabA } = setup()
    const tab = screen.getByTestId(`tab-${tabA}`)

    act(() => {
      fireEvent.pointerDown(tab, { button: 2, clientX: 10, clientY: 10 })
    })
    act(() => {
      fireEvent.pointerMove(tab, { clientX: 600, clientY: 200 })
    })

    expect(document.querySelector('[data-drop-indicator]')).toBeNull()
  })

  // Showing a tab mounts its views, at a WebGL2 context per display against a
  // ceiling of 16, so it is the left button that asks for it — dockview gates
  // `_activateOnPointerDown` the same way.
  test('the right button does not show the tab either', () => {
    const { session, left } = setup()
    const other = session.addTab(left, ['view-2'])!.id
    const first = session.panels.find(p => p.id === left)!.tabs[0]!.id

    act(() => {
      fireEvent.pointerDown(screen.getByTestId(`tab-${first}`), {
        button: 2,
        clientX: 10,
        clientY: 10,
      })
    })

    expect(session.activeTabOf(left)?.id).toBe(other)
  })

  // A second finger elsewhere in the strip must not steer the first one's drag,
  // and its release must not end it. dockview tracks the same pointerId.
  test('a second pointer does not steer the first one’s drag', () => {
    const { session, left, tabA } = setup()
    const tab = screen.getByTestId(`tab-${tabA}`)

    act(() => {
      fireEvent.pointerDown(tab, { pointerId: 1, clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { pointerId: 1, clientX: 600, clientY: 200 })
      // a second pointer wanders off and lifts somewhere else entirely
      fireEvent.pointerMove(tab, { pointerId: 2, clientX: 5000, clientY: 5000 })
      fireEvent.pointerUp(tab, { pointerId: 2, clientX: 5000, clientY: 5000 })
    })

    // the first pointer's drag is still where it was, and still in flight
    expect(
      document.querySelector('[data-drop-indicator="center"]'),
    ).toBeTruthy()
    expect(session.findTab(tabA)?.panel.id).toBe(left)
  })
})

// The browser can end a gesture without a `pointerup`: a long-press on a touch
// device opens the platform's own context menu and cancels the pointer. The
// same clearing as Escape, and for the same reason — clearing only what is on
// screen leaves `pending` behind to rebuild it from the next move.
test('a cancelled pointer takes the drag with it, and it does not resume', () => {
  const { session, left, tabA } = setup()
  const tab = screen.getByTestId(`tab-${tabA}`)

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 600, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeTruthy()

  act(() => {
    fireEvent.pointerCancel(tab, { clientX: 600, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()

  act(() => {
    fireEvent.pointerMove(tab, { clientX: 650, clientY: 220 })
    fireEvent.pointerUp(tab, { clientX: 650, clientY: 220 })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()
  expect(session.findTab(tabA)?.panel.id).toBe(left)
  expect(session.panels).toHaveLength(2)
})

test('dragging a tab into the middle of another cell moves it there', () => {
  const { session, right, tabA } = setup()
  const tab = screen.getByTestId(`tab-${tabA}`)

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 600, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator="center"]')).toBeTruthy()

  act(() => {
    fireEvent.pointerUp(tab, { clientX: 600, clientY: 200 })
  })

  expect(session.findTab(tabA)?.panel.id).toBe(right)
  // the left cell had only that tab, so it collapsed
  expect(session.panels.length).toBe(1)
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()
})

test('dragging a tab to a cell edge splits it', () => {
  const { session, tabA } = setup()
  const tab = screen.getByTestId(`tab-${tabA}`)

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    // far right of the right-hand cell
    fireEvent.pointerMove(tab, { clientX: 790, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator="right"]')).toBeTruthy()

  act(() => {
    fireEvent.pointerUp(tab, { clientX: 790, clientY: 200 })
  })

  // left collapsed as its only tab left; right split into two
  expect(session.panels.length).toBe(2)
  expect(session.findTab(tabA)!.tab.viewIds).toEqual(['view-1'])
})

test('a click on a tab is not a zero-distance drag', () => {
  const { session, left, tabA } = setup()
  const before = session.panels.map(p => p.id)
  const tab = screen.getByTestId(`tab-${tabA}`)

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 11, clientY: 10 })
    fireEvent.pointerUp(tab, { clientX: 11, clientY: 10 })
  })

  expect(session.panels.map(p => p.id)).toEqual(before)
  expect(session.findTab(tabA)?.panel.id).toBe(left)
})

test('releasing outside every cell drops nothing', () => {
  const { session, left, tabA } = setup()
  const tab = screen.getByTestId(`tab-${tabA}`)

  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tab, { clientX: 5000, clientY: 5000 })
    fireEvent.pointerUp(tab, { clientX: 5000, clientY: 5000 })
  })

  expect(session.findTab(tabA)?.panel.id).toBe(left)
  expect(session.panels.length).toBe(2)
})

// A tab's own ⋮ menu did nothing at all, and the cause is one line away from
// here rather than in the menu: the strip takes POINTER CAPTURE on pointerdown
// so a drag survives leaving the tab, and a captured pointer drags the
// compatibility mouse events along with it — the `click` that follows is
// delivered to the capturing tab, not to the button under the finger, so the
// button is never told it was pressed.
//
// jsdom implements neither capture nor that retargeting (`setPointerCapture` is
// stubbed to nothing above), so it cannot reproduce the symptom and a test that
// only clicked the button passed against the broken code. What is testable is
// the fix: a press that starts on the menu never becomes a drag, so there is no
// capture to retarget anything.
test('a press on a tab menu never starts a drag, so its click survives', () => {
  const { session, left, tabA, container } = setup(true)
  const before = session.panels.map(p => p.id)
  const menuButton = container.querySelector('.jbrowse-tab-menu button')!

  act(() => {
    fireEvent.pointerDown(menuButton, { clientX: 10, clientY: 10 })
    // well past the drag slop, and over the OTHER cell: were this a drag it
    // would light an indicator and land the tab there on release
    fireEvent.pointerMove(menuButton, { clientX: 600, clientY: 200 })
  })
  expect(document.querySelector('[data-drop-indicator]')).toBeNull()

  act(() => {
    fireEvent.pointerUp(menuButton, { clientX: 600, clientY: 200 })
  })

  expect(session.findTab(tabA)?.panel.id).toBe(left)
  expect(session.panels.map(p => p.id)).toEqual(before)
})

test('the tab menu opens on click', () => {
  const { container } = setup(true)
  // by selector, not `getByRole`: the button is `visibility: hidden` until its
  // tab is hovered, which takes it out of the accessibility tree jsdom exposes
  const menuButton = container.querySelector('.jbrowse-tab-menu button')!

  act(() => {
    fireEvent.click(menuButton)
  })

  expect(screen.getByText('Rename tab')).toBeTruthy()
  expect(screen.getByText('Close tab')).toBeTruthy()
})

// Reordering tabs by dragging within a strip. The model could already do this
// — `dropTabInPanel` has taken an `index` since it was written, and passed it
// to `moveTabToPanel` — but nothing ever supplied one, so a tab dragged onto
// its own strip went to the end. The missing half was the geometry: which GAP
// the pointer is over, which `dropZoneAt` has no vocabulary for.
describe('reordering within a strip', () => {
  // 3 tabs of 100px in the left panel's strip, which is its top 35px
  function setupStrip() {
    const session = TestSession.create({ name: 't' })
    const left = session.panels[0]!.id
    const a = session.tabs[0]!.id
    session.addViewToTab(a, 'view-1')
    const b = session.addTab(left, ['view-2'])!.id
    const c = session.addTab(left, ['view-3'])!.id

    stubGeometry({
      [left]: { left: 0, top: 0, width: 400, height: 400 } as DOMRect,
      [`strip:${left}`]: { left: 0, top: 0, width: 400, height: 35 } as DOMRect,
      [`tab:${a}`]: { left: 0, top: 0, width: 100, height: 35 } as DOMRect,
      [`tab:${b}`]: { left: 100, top: 0, width: 100, height: 35 } as DOMRect,
      [`tab:${c}`]: { left: 200, top: 0, width: 100, height: 35 } as DOMRect,
    })
    render(<Harness session={session} />)
    const order = () => session.panels[0]!.tabs.map(t => t.id)
    return { session, left, a, b, c, order }
  }

  function dragTabTo(tabId: string, x: number, y: number) {
    const tab = screen.getByTestId(`tab-${tabId}`)
    act(() => {
      fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { clientX: x, clientY: y })
    })
    return {
      drop: () => {
        act(() => {
          fireEvent.pointerUp(tab, { clientX: x, clientY: y })
        })
      },
    }
  }

  test('a tab dropped between two others lands between them', () => {
    const { a, b, c, order } = setupStrip()
    expect(order()).toEqual([a, b, c])

    // c spans 200..300, so its midpoint is 250 and x=220 is in its left half:
    // the gap BEFORE c, index 2 of the strip as it stands
    dragTabTo(a, 220, 10).drop()

    expect(order()).toEqual([b, a, c])
  })

  test('a tab dropped past the last one goes to the end', () => {
    const { a, b, c, order } = setupStrip()
    dragTabTo(a, 380, 10).drop()
    expect(order()).toEqual([b, c, a])
  })

  test('a tab dropped at the start goes first', () => {
    const { a, b, c, order } = setupStrip()
    dragTabTo(c, 5, 10).drop()
    expect(order()).toEqual([c, a, b])
  })

  test('a tab dropped back in its own gap changes nothing', () => {
    const { a, b, c, order } = setupStrip()
    dragTabTo(b, 120, 10).drop()
    expect(order()).toEqual([a, b, c])
  })

  // A caret, not the half-panel wash: the drop is between two tabs, and shading
  // half the cell would say it splits.
  test('the strip shows a caret at the gap rather than a split indicator', () => {
    const { a } = setupStrip()
    const dragging = dragTabTo(a, 220, 10)

    const caret = document.querySelector<HTMLElement>('[data-drop-caret]')
    expect(caret).toBeTruthy()
    expect(caret!.dataset.dropCaret).toBe('2')
    expect(caret!.style.left).toBe('200px')
    expect(document.querySelector('[data-drop-indicator]')).toBeNull()

    dragging.drop()
    expect(document.querySelector('[data-drop-caret]')).toBeNull()
  })

  // The strip sits inside the panel's own top edge band, so testing the panel
  // first would read every strip drop as "split this cell upwards".
  test('the strip wins over the top edge band it sits inside', () => {
    const { a, b, c, session, order } = setupStrip()
    dragTabTo(a, 220, 10).drop()

    expect(session.panels).toHaveLength(1)
    expect(order()).toEqual([b, a, c])
  })

  // Below the strip is the body, and the old behaviour is untouched there.
  test('a drop below the strip still splits or appends as before', () => {
    const { a, session } = setupStrip()
    dragTabTo(a, 380, 200).drop()
    expect(session.panels).toHaveLength(2)
  })

  // The centre of a cell means "be a tab of this cell", and a tab already in it
  // already is — so the gesture asks for nothing and nothing happens. There is
  // no gap under the pointer to state a position with, and the indicator washes
  // the whole cell rather than drawing a caret, so a reorder is the one thing
  // the drop did not say. It used to send the tab to the end.
  test('a drop on its own body leaves the order alone', () => {
    const { a, b, c, session, order } = setupStrip()
    dragTabTo(a, 200, 200).drop()

    expect(order()).toEqual([a, b, c])
    expect(session.panels).toHaveLength(1)
  })

  // ...but the same drop into a DIFFERENT cell states a cell and not a
  // position, which is `dropTabInPanel` with no index and still means append.
  test('a drop on another cell’s body appends to that strip', () => {
    const { a, b, c, session, left, order } = setupStrip()
    const right = session.splitPanel(left, 'row')!
    session.dropTabInPanel(a, right.id)

    expect(order()).toEqual([b, c])
    expect(session.findTab(a)?.panel.id).toBe(right.id)
  })
})

/**
 * A drag must not re-render the cells it passes over.
 *
 * `PanelChrome` is a prop of every panel, so anything in it that changes per
 * render defeats `observer`'s memo for all of them at once — and a panel's
 * render rebuilds its `ViewStack`, which is a stack of genome views. With the
 * in-flight drag as React state that is pointer-event rate.
 *
 * The half of that inside this package is `useLayoutDrag` keeping `handlers`
 * identity-stable while the drag changes, which it does by reading the drag
 * from a ref. The other half is the caller memoising the chrome object, which
 * `WorkspaceContainer` does and which the harness below copies — the assertion
 * is meaningless without it, so it is spelled out rather than shared.
 *
 * **Including the cell it is over.** That one has an indicator to draw, but the
 * indicator is a function of the cell and the zone — or, on a strip, the gap —
 * and a pointer emits events far faster than it crosses between any of those.
 * So the cost the memoised handlers removed for every other cell was still
 * being paid, at full rate, by the cell being dragged over.
 */
describe('a drag in flight', () => {
  const drawn: string[] = []
  const Harness = observer(function Harness({
    session,
  }: {
    session: ReturnType<typeof TestSession.create>
  }) {
    const { drag, handlers } = useLayoutDrag(session)
    const chrome = useMemo(
      () => ({
        dragHandlers: handlers,
        renderTabLabel: (tab: TabNode) => (
          <span data-testid={`tab-${tab.id}`}>{tab.id}</span>
        ),
        renderTabContent: (tab: TabNode) => {
          drawn.push(tab.id)
          return <div>{tab.viewIds.join(',')}</div>
        },
      }),
      [handlers],
    )
    return (
      <LayoutRenderer
        node={session.tree}
        layout={session}
        drag={drag}
        chrome={chrome}
      />
    )
  })

  function dragInto() {
    drawn.length = 0
    const session = TestSession.create({ name: 't' })
    const left = session.panels[0]!.id
    const tabA = session.tabs[0]!.id
    session.addViewToTab(tabA, 'view-1')
    const rightPanel = session.splitPanel(left, 'row')!
    const tabB = rightPanel.tabs[0]!.id
    session.addViewToTab(tabB, 'view-3')
    stubGeometry({
      [left]: { left: 0, top: 0, width: 400, height: 400 } as DOMRect,
      [rightPanel.id]: {
        left: 400,
        top: 0,
        width: 400,
        height: 400,
      } as DOMRect,
    })
    render(<Harness session={session} />)

    const tab = screen.getByTestId(`tab-${tabA}`)
    act(() => {
      fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
      fireEvent.pointerMove(tab, { clientX: 600, clientY: 200 })
    })
    drawn.length = 0
    return { tab, tabA, tabB }
  }

  test('redraws nothing while it stays in one zone', () => {
    const { tab } = dragInto()

    // four more moves, all in the centre band of the right-hand cell
    act(() => {
      for (const x of [610, 620, 630, 640]) {
        fireEvent.pointerMove(tab, { clientX: x, clientY: 200 })
      }
    })

    expect(drawn).toEqual([])
  })

  test('redraws the cell whose indicator changes, and only that one', () => {
    const { tab, tabA, tabB } = dragInto()

    // out of the centre band and into the right edge one: a different
    // indicator, so this cell genuinely has something new to draw
    act(() => {
      fireEvent.pointerMove(tab, { clientX: 790, clientY: 200 })
    })

    expect(drawn).toContain(tabB)
    // the cell the drag started in has nothing new to say and must hold still
    expect(drawn).not.toContain(tabA)
  })
})

test('clicking a tab makes it active without moving anything', () => {
  const { session, left } = setup()
  const other = session.addTab(left, ['view-2'])!.id
  const first = session.panels.find(p => p.id === left)!.tabs[0]!.id

  const tab = screen.getByTestId(`tab-${first}`)
  act(() => {
    fireEvent.pointerDown(tab, { clientX: 10, clientY: 10 })
    fireEvent.pointerUp(tab, { clientX: 10, clientY: 10 })
  })

  expect(session.activeTabOf(left)?.id).toBe(first)
  expect(session.findTab(other)?.panel.id).toBe(left)
})
