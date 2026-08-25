import { createJBrowseTheme } from '@jbrowse/core/ui'
import { defaultStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { colord } from '@jbrowse/core/util/colord'
import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'

import { LayoutRenderer } from './LayoutRenderer.tsx'
import { dv } from './dockviewTheme.ts'
import { WorkspaceLayoutMixin } from './model.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

const noDrag = {
  onTabPointerDown: () => {},
  onTabPointerMove: () => {},
  onTabPointerUp: () => {},
  onTabPointerCancel: () => {},
}

/**
 * `node` is a plain snapshot, so it has to be re-read for the render to follow
 * the tree — which is what `WorkspaceContainer` does by being an observer. The
 * harness does the same rather than passing `session.tree` once: a second
 * keypress on a splitter otherwise computes from the sizes the first one
 * replaced, and reads as an off-by-one-step bug in the handler.
 *
 * The pointer drag never needed this, which is why it went unnoticed — it
 * captures its start sizes in a ref on pointerdown and works from those.
 */
const Harness = observer(function Harness({
  session,
}: {
  session: ReturnType<typeof TestSession.create>
}) {
  return (
    <LayoutRenderer
      node={session.tree}
      layout={session}
      chrome={{
        dragHandlers: noDrag,
        renderTabLabel: tab => <span>{tab.title ?? tab.id}</span>,
        renderTabContent: tab => (
          <div data-testid={`content-${tab.id}`}>{tab.viewIds.join(',')}</div>
        ),
      }}
    />
  )
})

function renderLayout(session: ReturnType<typeof TestSession.create>) {
  return render(<Harness session={session} />)
}

test('each cell shows only its active tab', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const first = session.tabs[0]!.id
  session.addViewToTab(first, 'view-1')
  const second = session.addTab(p1, ['view-2'])!.id

  renderLayout(session)

  // second was added last, so it is active
  expect(screen.getByTestId(`content-${second}`).textContent).toBe('view-2')
  expect(screen.queryByTestId(`content-${first}`)).toBeNull()
  // but both tabs are in the strip
  expect(document.querySelectorAll('[role="tab"]')).toHaveLength(2)
})

test('a splitter sits between each pair of siblings, not at the edges', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')!.id
  session.splitPanel(p2, 'row')

  const { container } = renderLayout(session)

  // three panes, two boundaries
  expect(container.querySelectorAll('[data-splitter]')).toHaveLength(2)
})

test('sizes become flex-grow, so the browser does the resize maths', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  session.splitPanel(p1, 'row')
  session.setSizes((session.layout as unknown as { id: string }).id, [0.7, 0.3])

  const { container } = renderLayout(session)

  const grows = [...container.querySelectorAll('[data-panel-id]')].map(
    el => el.parentElement!.style.flexGrow,
  )
  expect(grows).toEqual(['0.7', '0.3'])
})

test('a nested split renders as a nested flex container', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')!.id
  session.splitPanel(p2, 'column')

  const { container } = renderLayout(session)

  const row = container.firstElementChild as HTMLElement
  expect(row.style.flexDirection).toBe('row')
  const nested = [...row.children].find(
    el => (el as HTMLElement).style.flexDirection === 'column',
  )
  expect(nested).toBeDefined()
  expect(container.querySelectorAll('[data-panel-id]')).toHaveLength(3)
})

test('a renamed tab shows its title', () => {
  const session = TestSession.create({ name: 't' })
  session.renameTab(session.tabs[0]!.id, 'My comparison')

  renderLayout(session)

  expect(screen.getByText('My comparison')).toBeDefined()
})

// A panel must FILL its cell, not shrink to its content. This is a real bug that
// shipped: the panel is a child of a `display: flex` row, so without `flex: 1`
// its width is its content's width — and a view measures its container to decide
// how wide to draw (useWidthSetter), so the two settle at the view's intrinsic
// width and the workspace renders at half the window with dead space beside it.
//
// jsdom computes no layout, so this asserts the declared style rather than a
// measured box. That is the whole mechanism here: the bug was a missing
// declaration, not a miscalculation.
test('a panel fills its cell rather than shrinking to its content', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')

  const { container } = renderLayout(session)

  for (const el of container.querySelectorAll('[data-panel-id]')) {
    const style = getComputedStyle(el)
    expect(style.flexGrow).toBe('1')
    // without this a long tab title or a wide view can push the cell past its
    // share of the split instead of scrolling inside it. jsdom reports the
    // class-derived value unitless and the inline one as `0px`, so compare
    // numerically rather than pinning a spelling.
    expect(Number.parseFloat(style.minWidth)).toBe(0)
  }
})

test('the cell wrapper carries the size, and does not collapse either', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')
  session.setSizes((session.layout as unknown as { id: string }).id, [0.7, 0.3])

  const { container } = renderLayout(session)

  const wrappers = [...container.querySelectorAll('[data-panel-id]')].map(
    el => el.parentElement!,
  )
  expect(wrappers.map(w => w.style.flexGrow)).toEqual(['0.7', '0.3'])
  expect(wrappers.every(w => Number.parseFloat(w.style.minWidth) === 0)).toBe(
    true,
  )
})

// The chrome is dockview's dark theme, FIXED — not derived from the MUI theme,
// and dark in a light JBrowse theme too. Pinned because "follow the theme" is
// the obvious thing to write and is wrong here: a light strip reads as content
// rather than as the frame around it.
test('the tab strip is dockview chrome, not the MUI theme', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)

  const strip = container.querySelector('[data-tab-strip]')!
  const style = getComputedStyle(strip)
  expect(style.backgroundColor).toBe(colord(dv.tabsBackground).toRgbString())
  expect(style.height).toBe(`${dv.tabsHeight}px`)
  // and emphatically not the theme's surface colour
  expect(style.backgroundColor).not.toBe(
    colord(createJBrowseTheme().palette.background.paper).toRgbString(),
  )
})

// The other half of that rule, and the one that shipped wrong: dockview's dark
// theme also colours the surface its content sits on, and transcribing THAT
// made a light JBrowse theme come up dark everywhere a view did not reach the
// bottom of its cell — the frame swallowing the thing it frames. The strip is
// chrome; the body is content and follows the theme.
test('the panel body is content, so it follows the theme rather than the chrome', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)

  const panel = container.querySelector('[data-panel-id]')!
  const strip = container.querySelector('[data-tab-strip]')!
  // the theme `makeStyles` hands a component with no provider mounted, which is
  // what this bare render has
  expect(getComputedStyle(panel).backgroundColor).toBe(
    colord(defaultStyleTheme.palette.background.default).toRgbString(),
  )
  expect(getComputedStyle(panel).backgroundColor).not.toBe(
    getComputedStyle(strip).backgroundColor,
  )
})

// The strip's children are the tab list and then the panel's own buttons, so a
// tab list that takes the leftover space puts the `+` hard against the right
// edge of the cell — arbitrarily far from the tabs it adds to, and reading as
// part of the window chrome rather than of the panel.
test('the tab list does not grow, so the panel actions stay beside the tabs', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)

  const tabs = container.querySelector('[role="tab"]')!.parentElement!
  const style = getComputedStyle(tabs)
  expect(style.flexGrow).toBe('0')
  // but it must still SHRINK, or a cell too narrow for its tabs pushes the
  // buttons off the strip instead of scrolling the tabs under them
  expect(style.flexShrink).toBe('1')
})

// All four states dockview enumerates. The focused panel's selected tab is the
// only fully-white label on screen, which is the whole point of having four.
test('a tab is coloured by both its panel and its selection', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const firstTab = session.tabs[0]!.id
  const secondTab = session.addTab(p1)!.id
  const p2 = session.splitPanel(p1, 'row')!
  // p2 is active after a split, so p1 is the inactive panel
  expect(session.activePanelId).toBe(p2.id)

  const { container } = renderLayout(session)
  // looked up by dataset rather than an attribute selector: jsdom has no
  // `CSS.escape`, which is what lint rewrites an interpolated selector to use
  const bg = (tabId: string) =>
    getComputedStyle(
      [...container.querySelectorAll('[data-tab-id]')].find(
        el => (el as HTMLElement).dataset.tabId === tabId,
      )!,
    ).backgroundColor

  expect(bg(secondTab)).toBe(
    colord(dv.inactiveGroupVisibleTabBackground).toRgbString(),
  )
  expect(bg(firstTab)).toBe(
    colord(dv.inactiveGroupHiddenTabBackground).toRgbString(),
  )
  expect(bg(p2.tabs[0]!.id)).toBe(
    colord(dv.activeGroupVisibleTabBackground).toRgbString(),
  )
})

// ---------------------------------------------------------------------------
// Keyboard. The strip carried `role="tab"` and `aria-selected` with no way to
// reach or operate any of it, which is worse than plain divs would have been:
// it announces tabs to a screen reader whose user then cannot find them.
// ---------------------------------------------------------------------------

const tabsIn = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="tab"]')] as HTMLElement[]

const childSizes = (session: ReturnType<typeof TestSession.create>) =>
  (session.tree as unknown as { children: { size: number }[] }).children.map(
    c => c.size,
  )

// One tab stop for the whole strip, not one per tab — otherwise a panel with
// eight tabs is eight stops between the user and the view.
test('the strip is a single tab stop, and the shown tab holds it', () => {
  const session = TestSession.create({ name: 't' })
  session.addTab(session.panels[0]!.id)
  const { container } = renderLayout(session)

  const tabs = tabsIn(container)
  const shown = tabs.filter(t => t.getAttribute('aria-selected') === 'true')
  expect(shown).toHaveLength(1)
  expect(shown[0]!.tabIndex).toBe(0)
  expect(tabs.filter(t => t.tabIndex === 0)).toHaveLength(1)
  expect(tabs.filter(t => t.tabIndex === -1)).toHaveLength(tabs.length - 1)
})

// MANUAL activation — the WAI tabs pattern's exception rather than its default,
// and the right one here: only the shown tab's views are mounted, and each
// display costs a WebGL2 context against a ceiling of 16, so activating on
// arrow would build and tear down a set of them per keypress.
test('arrowing moves focus without showing the tab it lands on', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const first = session.tabs[0]!.id
  const second = session.addTab(p1)!.id
  const { container } = renderLayout(session)
  expect(session.activeTabOf(p1)?.id).toBe(second)

  const shownTab = tabsIn(container).find(t => t.dataset.tabId === second)!
  shownTab.focus()
  fireEvent.keyDown(shownTab, { key: 'ArrowLeft' })

  // focus moved to the other tab...
  expect((document.activeElement as HTMLElement).dataset.tabId).toBe(first)
  // ...and the second tab is still the one being shown
  expect(session.activeTabOf(p1)?.id).toBe(second)
  expect(screen.getByTestId(`content-${second}`)).toBeTruthy()
  expect(screen.queryByTestId(`content-${first}`)).toBeNull()
})

test('Enter shows the focused tab, and Home and End reach the ends', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const first = session.tabs[0]!.id
  const second = session.addTab(p1)!.id
  const { container } = renderLayout(session)

  const focused = tabsIn(container).find(t => t.dataset.tabId === second)!
  focused.focus()
  fireEvent.keyDown(focused, { key: 'Home' })
  expect((document.activeElement as HTMLElement).dataset.tabId).toBe(first)

  fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
  expect(session.activeTabOf(p1)?.id).toBe(first)

  fireEvent.keyDown(document.activeElement!, { key: 'End' })
  expect((document.activeElement as HTMLElement).dataset.tabId).toBe(second)
})

test('arrowing wraps around rather than stopping at the ends', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const first = session.tabs[0]!.id
  const second = session.addTab(p1)!.id
  const { container } = renderLayout(session)

  const firstTab = tabsIn(container).find(t => t.dataset.tabId === first)!
  firstTab.focus()
  fireEvent.keyDown(firstTab, { key: 'ArrowLeft' })

  expect((document.activeElement as HTMLElement).dataset.tabId).toBe(second)
})

// A tablist's children have to be tabs, so the panel's own +/× buttons sit
// beside it rather than inside — inside, a screen reader counts them as tabs.
test('the panel actions are in the strip but not in the tablist', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = render(
    <LayoutRenderer
      node={session.tree}
      layout={session}
      chrome={{
        dragHandlers: noDrag,
        renderTabLabel: tab => <span>{tab.id}</span>,
        renderTabContent: () => null,
        renderPanelActions: () => <button type="button">add</button>,
      }}
    />,
  )

  const tablist = container.querySelector('[role="tablist"]')!
  const strip = container.querySelector('[data-tab-strip]')!
  expect(strip.contains(tablist)).toBe(true)
  expect(tablist.querySelector('button')).toBeNull()
  expect(strip.querySelector('button')).toBeTruthy()
})

// Wired both ways, which is what lets a screen reader say which tab's content
// it is about to read.
test('the shown tab and its panel name each other', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)

  const tab = container.querySelector('[role="tab"]')!
  const tabpanel = container.querySelector('[role="tabpanel"]')!
  expect(tab.id).toBeTruthy()
  expect(tabpanel.id).toBeTruthy()
  expect(tab.getAttribute('aria-controls')).toBe(tabpanel.id)
  expect(tabpanel.getAttribute('aria-labelledby')).toBe(tab.id)
})

test('a hidden tab controls nothing, because none of it is rendered', () => {
  const session = TestSession.create({ name: 't' })
  session.addTab(session.panels[0]!.id)
  const { container } = renderLayout(session)

  const hidden = tabsIn(container).filter(
    t => t.getAttribute('aria-selected') !== 'true',
  )
  expect(hidden.length).toBeGreaterThan(0)
  for (const tab of hidden) {
    expect(tab.getAttribute('aria-controls')).toBeNull()
  }
})

// The splitter claimed `role="separator"` while being neither focusable nor
// operable: an affordance announced and then not there.
test('the splitter resizes from the keyboard, in both directions', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')
  const { container } = renderLayout(session)

  const splitter = container.querySelector('[data-splitter]') as HTMLElement
  expect(splitter.tabIndex).toBe(0)

  // 2% of the pair, moved from the right pane to the left
  fireEvent.keyDown(splitter, { key: 'ArrowRight' })
  expect(childSizes(session)[0]!).toBeCloseTo(0.52, 5)
  expect(childSizes(session)[1]!).toBeCloseTo(0.48, 5)

  fireEvent.keyDown(splitter, { key: 'ArrowLeft' })
  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)

  // Home and End drive the boundary to its limits, never through them — a pane
  // dragged to nothing still exists and can be brought back
  fireEvent.keyDown(splitter, { key: 'Home' })
  expect(childSizes(session)[0]!).toBeCloseTo(0, 5)
  expect(childSizes(session)[1]!).toBeCloseTo(1, 5)
  expect(session.panels).toHaveLength(2)

  fireEvent.keyDown(splitter, { key: 'End' })
  expect(childSizes(session)[0]!).toBeCloseTo(1, 5)
  expect(session.panels).toHaveLength(2)
})

test('a vertical split takes the vertical arrows and ignores the others', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'column')
  const { container } = renderLayout(session)

  const splitter = container.querySelector('[data-splitter]') as HTMLElement
  expect(splitter.getAttribute('aria-orientation')).toBe('horizontal')

  fireEvent.keyDown(splitter, { key: 'ArrowRight' })
  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)

  fireEvent.keyDown(splitter, { key: 'ArrowDown' })
  expect(childSizes(session)[0]!).toBeCloseTo(0.52, 5)
})

test('the splitter reports where it sits, as a percentage of its pair', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')
  session.setSizes((session.layout as unknown as { id: string }).id, [0.7, 0.3])
  const { container } = renderLayout(session)

  const splitter = container.querySelector('[data-splitter]')!
  expect(splitter.getAttribute('aria-valuenow')).toBe('70')
  expect(splitter.getAttribute('aria-valuemin')).toBe('0')
  expect(splitter.getAttribute('aria-valuemax')).toBe('100')
  expect(splitter.getAttribute('aria-label')).toBeTruthy()
})

// ---------------------------------------------------------------------------
// The splitter's pointer drag. Pointer events are chosen for capture, which
// means owning the rules the browser was applying — the same three the tab drag
// owns (`useLayoutDrag`), on the handle that predates them being written down.
//
// jsdom lays nothing out, so every rect is zero, `measurePairPx` returns 0 and
// the handler bails before arming: the pair has to be given a width for any of
// this to be reachable at all, which is why it went untested.
// ---------------------------------------------------------------------------

function splitterOverPanes(session: ReturnType<typeof TestSession.create>) {
  const { container } = renderLayout(session)
  for (const el of container.querySelectorAll<HTMLElement>('div')) {
    el.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 500, height: 500 }) as DOMRect
  }
  return container.querySelector('[data-splitter]') as HTMLElement
}

function twoPanes() {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')
  return session
}

test('a splitter drag moves the boundary with the pointer', () => {
  const session = twoPanes()
  const splitter = splitterOverPanes(session)

  fireEvent.pointerDown(splitter, { button: 0, pointerId: 1, clientX: 500 })
  fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 600 })

  // 100px of a 1000px pair, moved from the right pane to the left
  expect(childSizes(session)[0]!).toBeCloseTo(0.6, 5)
  expect(childSizes(session)[1]!).toBeCloseTo(0.4, 5)
})

// A right-press armed the drag and then lost its `pointerup` to the native
// context menu, and capture routes every later move back to the handle — so a
// button-less pointer went on resizing from where the right-press started.
test('only the primary button of the primary pointer starts a resize', () => {
  const session = twoPanes()
  const splitter = splitterOverPanes(session)

  fireEvent.pointerDown(splitter, { button: 2, pointerId: 1, clientX: 500 })
  fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 600 })
  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)

  fireEvent.pointerDown(splitter, {
    button: 0,
    pointerId: 7,
    isPrimary: false,
    clientX: 500,
  })
  fireEvent.pointerMove(splitter, { pointerId: 7, clientX: 600 })
  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)
})

// One pointerId per gesture: a second finger landing on the handle steered the
// first one's resize from the first one's start position, and its release ended
// the gesture the first one was still holding.
test('a second pointer neither steers nor ends the resize', () => {
  const session = twoPanes()
  const splitter = splitterOverPanes(session)

  fireEvent.pointerDown(splitter, { button: 0, pointerId: 1, clientX: 500 })
  fireEvent.pointerMove(splitter, { pointerId: 9, clientX: 900 })
  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)

  fireEvent.pointerUp(splitter, { pointerId: 9 })
  fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 600 })
  expect(childSizes(session)[0]!).toBeCloseTo(0.6, 5)
})

// A touch long-press opens the platform's context menu and cancels the pointer
// with no `pointerup` behind it, leaving the resize armed to resume from the
// next move.
test('pointercancel ends the resize', () => {
  const session = twoPanes()
  const splitter = splitterOverPanes(session)

  fireEvent.pointerDown(splitter, { button: 0, pointerId: 1, clientX: 500 })
  fireEvent.pointerCancel(splitter, { pointerId: 1 })
  fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 600 })

  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)
})

// ---------------------------------------------------------------------------
// Overflow. The strip scrolls and hides its scrollbar (it is chrome, and a
// scrollbar across it would be noise), so with more tabs than fit there is
// nothing saying there is more and nothing a mouse can do about it. Measured at
// 1400px with 30 tabs: 11 of them entirely outside the strip.
// ---------------------------------------------------------------------------

// jsdom computes no layout, so scrollLeft never moves on its own and
// scrollWidth is 0 — the handler's arithmetic is what is checkable here, and
// the reachability it buys was measured in a real browser.
test('a mouse wheel over the strip scrolls it sideways', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)
  const list = container.querySelector('[role="tablist"]') as HTMLElement

  list.scrollLeft = 0
  fireEvent.wheel(list, { deltaY: 120, deltaX: 0 })
  expect(list.scrollLeft).toBe(120)

  fireEvent.wheel(list, { deltaY: -40, deltaX: 0 })
  expect(list.scrollLeft).toBe(80)
})

// `deltaY` is only pixels when `deltaMode` says so. Firefox reports whole LINES
// for a mouse wheel (mode 1, deltaY ±3) where Chrome reports pixels (mode 0,
// ±100), so taking the number at face value moves the strip three pixels per
// notch there — which is scrolling, technically, and unusable. Chrome-only
// verification cannot see this, which is why it is pinned here.
test('a wheel reporting lines or pages is converted to pixels', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)
  const list = container.querySelector('[role="tablist"]') as HTMLElement

  // one Firefox mouse-wheel notch
  list.scrollLeft = 0
  fireEvent.wheel(list, { deltaY: 3, deltaX: 0, deltaMode: 1 })
  expect(list.scrollLeft).toBe(48)

  // pages are the strip's own visible width; jsdom measures 0, so this asserts
  // the multiplication happened rather than a distance
  list.scrollLeft = 0
  Object.defineProperty(list, 'clientWidth', {
    value: 400,
    configurable: true,
  })
  fireEvent.wheel(list, { deltaY: 2, deltaX: 0, deltaMode: 2 })
  expect(list.scrollLeft).toBe(800)
})

// A trackpad swipe already arrives as deltaX and the browser has applied it.
// Adding deltaY on top would scroll twice as far as the fingers moved.
test('a horizontal gesture is left to the browser', () => {
  const session = TestSession.create({ name: 't' })
  const { container } = renderLayout(session)
  const list = container.querySelector('[role="tablist"]') as HTMLElement

  list.scrollLeft = 50
  fireEvent.wheel(list, { deltaX: 200, deltaY: 5 })
  expect(list.scrollLeft).toBe(50)
})

// Clicking never needs this and arrowing gets it from focus(); the case is a
// tab that becomes current without being touched, which is what `+` does on a
// strip already full.
test('a tab that becomes current without being touched is scrolled into view', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const scrolled: string[] = []
  // record which tab asked; the shared jsdom stub is a bare no-op
  const original = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function (this: Element) {
    const id = (this as HTMLElement).dataset.tabId
    if (id) {
      scrolled.push(id)
    }
  }
  try {
    renderLayout(session)
    scrolled.length = 0
    let added = ''
    act(() => {
      added = session.addTab(p1)!.id
    })

    expect(session.activeTabOf(p1)?.id).toBe(added)
    expect(scrolled).toContain(added)
  } finally {
    Element.prototype.scrollIntoView = original
  }
})
