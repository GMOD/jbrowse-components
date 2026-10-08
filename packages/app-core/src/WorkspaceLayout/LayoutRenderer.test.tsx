import { useState } from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { defaultStyleTheme } from '@jbrowse/core/ui/styleTheme'
import { colord } from '@jbrowse/core/util/colord'
import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { observer } from 'mobx-react'

import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspaceLayoutMixin } from './model.ts'
import { workspaceTheme } from './workspaceTheme.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

const noDrag = {
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  onLostPointerCapture: () => {},
}

// an observer re-reading `visibleTree`, as `WorkspaceContainer` does; a
// snapshot passed once goes stale after the first splitter keypress
const Harness = observer(function Harness({
  session,
}: {
  session: ReturnType<typeof TestSession.create>
}) {
  return (
    <LayoutRenderer
      node={session.visibleTree}
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

// the strip only shows once there is a second tab or cell
function withTwoTabs(session: ReturnType<typeof TestSession.create>) {
  const panel = session.panels[0]!
  const first = panel.tabs[0]!.id
  session.addTab(panel.id)
  session.setActiveTab(panel.id, first)
  return session
}

test('a lone cell with one tab draws no strip', () => {
  const { container } = renderLayout(TestSession.create({ name: 't' }))

  expect(container.querySelector('[data-tab-strip]')).toBeNull()
  expect(container.querySelector('[role="tabpanel"]')).toBeTruthy()
})

test('a second tab or a second cell brings the strip in', () => {
  const tabbed = withTwoTabs(TestSession.create({ name: 't' }))
  const split = TestSession.create({ name: 't' })
  split.splitPanel(split.panels[0]!.id, 'row')

  expect(
    renderLayout(tabbed).container.querySelectorAll('[data-tab-strip]'),
  ).toHaveLength(1)
  expect(
    renderLayout(split).container.querySelectorAll('[data-tab-strip]'),
  ).toHaveLength(2)
})

// the strip holds the restore control, so a maximized one-tab cell keeps it
test('a maximized cell keeps its strip while other cells exist', () => {
  const session = TestSession.create({ name: 't' })
  const first = session.panels[0]!.id
  session.splitPanel(first, 'row')
  session.toggleMaximizedPanel(first)

  const { container } = renderLayout(session)

  expect(container.querySelectorAll('[data-panel-id]')).toHaveLength(1)
  expect(container.querySelector('[data-tab-strip]')).toBeTruthy()
})

test('switching tabs mounts the new tab content afresh', () => {
  function FirstTab({ tabId }: { tabId: string }) {
    const [first] = useState(tabId)
    return <div data-testid="first-tab">{first}</div>
  }
  const Remounting = observer(function Remounting({
    session,
  }: {
    session: ReturnType<typeof TestSession.create>
  }) {
    return (
      <LayoutRenderer
        node={session.visibleTree}
        layout={session}
        chrome={{
          dragHandlers: noDrag,
          renderTabLabel: tab => <span>{tab.id}</span>,
          renderTabContent: tab => <FirstTab tabId={tab.id} />,
        }}
      />
    )
  })
  const session = TestSession.create({ name: 't' })
  const panelId = session.panels[0]!.id
  const one = session.tabs[0]!.id
  const two = session.addTab(panelId)!.id
  render(<Remounting session={session} />)
  expect(screen.getByTestId('first-tab').textContent).toBe(two)

  act(() => {
    session.setActiveTab(panelId, one)
  })

  expect(screen.getByTestId('first-tab').textContent).toBe(one)
})

test('each cell shows only its active tab', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const first = session.tabs[0]!.id
  session.addViewToTab(first, 'view-1')
  const second = session.addTab(p1, ['view-2'])!.id

  renderLayout(session)

  expect(screen.getByTestId(`content-${second}`).textContent).toBe('view-2')
  expect(screen.queryByTestId(`content-${first}`)).toBeNull()
  expect(document.querySelectorAll('[role="tab"]')).toHaveLength(2)
})

test('a maximized cell is the only one drawn, and restoring brings the rest back', () => {
  const session = TestSession.create({ name: 't' })
  const left = session.panels[0]!.id
  const right = session.splitPanel(left, 'row')!.id
  const { container } = renderLayout(session)
  expect(container.querySelectorAll('[data-panel-id]')).toHaveLength(2)

  act(() => {
    session.toggleMaximizedPanel(right)
  })

  const drawn = [...container.querySelectorAll('[data-panel-id]')]
  expect(drawn.map(el => (el as HTMLElement).dataset.panelId)).toEqual([right])
  expect(container.querySelectorAll('[data-splitter]')).toHaveLength(0)
  expect(drawn[0]!.parentElement!.style.flexGrow).toBe('1')

  act(() => {
    session.restorePanels()
  })

  expect(container.querySelectorAll('[data-panel-id]')).toHaveLength(2)
  expect(container.querySelectorAll('[data-splitter]')).toHaveLength(1)
})

test('double-clicking the strip background maximizes the cell, and again restores', () => {
  const session = TestSession.create({ name: 't' })
  const left = session.panels[0]!.id
  session.splitPanel(left, 'row')
  const { container } = renderLayout(session)
  const strip = container.querySelector('[data-tab-strip]')!

  fireEvent.doubleClick(strip)
  expect(session.maximizedPanelId).toBe(left)

  fireEvent.doubleClick(container.querySelector('[data-tab-strip]')!)
  expect(session.maximizedPanelId).toBeUndefined()
})

test('double-clicking a tab does not maximize its cell', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')
  const { container } = renderLayout(session)

  fireEvent.doubleClick(container.querySelector('[role="tab"]')!)
  expect(session.maximizedPanelId).toBeUndefined()

  fireEvent.doubleClick(container.querySelector('[role="tab"] span')!)
  expect(session.maximizedPanelId).toBeUndefined()
})

test('a splitter sits between each pair of siblings, not at the edges', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')!.id
  session.splitPanel(p2, 'row')

  const { container } = renderLayout(session)

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
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  session.renameTab(session.tabs[0]!.id, 'My comparison')

  renderLayout(session)

  expect(screen.getByText('My comparison')).toBeDefined()
})

// jsdom computes no layout, so this asserts the declared style
test('a panel fills its cell rather than shrinking to its content', () => {
  const session = TestSession.create({ name: 't' })
  session.splitPanel(session.panels[0]!.id, 'row')

  const { container } = renderLayout(session)

  for (const el of container.querySelectorAll('[data-panel-id]')) {
    const style = getComputedStyle(el)
    expect(style.flexGrow).toBe('1')
    // jsdom reports this unitless or as `0px` depending on its source
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

// the chrome stays dark in a light theme, so the frame never reads as content
test('the tab strip is fixed workspace chrome, not the MUI theme', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  const { container } = renderLayout(session)

  const strip = container.querySelector('[data-tab-strip]')!
  const style = getComputedStyle(strip)
  expect(style.backgroundColor).toBe(
    colord(workspaceTheme.stripBackground).toRgbString(),
  )
  expect(style.height).toBe(`${workspaceTheme.stripHeight}px`)
  expect(style.backgroundColor).not.toBe(
    colord(createJBrowseTheme().palette.background.paper).toRgbString(),
  )
})

test('the panel body is content, so it follows the theme rather than the chrome', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  const { container } = renderLayout(session)

  const panel = container.querySelector('[data-panel-id]')!
  const strip = container.querySelector('[data-tab-strip]')!
  // the theme `makeStyles` uses with no provider mounted
  expect(getComputedStyle(panel).backgroundColor).toBe(
    colord(defaultStyleTheme.palette.background.default).toRgbString(),
  )
  expect(getComputedStyle(panel).backgroundColor).not.toBe(
    getComputedStyle(strip).backgroundColor,
  )
})

test('the tab list does not grow, so the panel actions stay beside the tabs', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  const { container } = renderLayout(session)

  const tabs = container.querySelector('[role="tab"]')!.parentElement!
  const style = getComputedStyle(tabs)
  expect(style.flexGrow).toBe('0')
  // shrinking is what makes the tabs scroll rather than push the buttons out
  expect(style.flexShrink).toBe('1')
})

test('a tab is colored by both its panel and its selection', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const firstTab = session.tabs[0]!.id
  const secondTab = session.addTab(p1)!.id
  const p2 = session.splitPanel(p1, 'row')!
  // p2 is active after a split, so p1 is the inactive panel
  expect(session.activePanelId).toBe(p2.id)

  const { container } = renderLayout(session)
  // by dataset: jsdom lacks the `CSS.escape` an attribute selector would need
  const bg = (tabId: string) =>
    getComputedStyle(
      [...container.querySelectorAll('[data-tab-id]')].find(
        el => (el as HTMLElement).dataset.tabId === tabId,
      )!,
    ).backgroundColor

  expect(bg(secondTab)).toBe(
    colord(workspaceTheme.selectedTabBackground).toRgbString(),
  )
  expect(bg(firstTab)).toBe(colord(workspaceTheme.tabBackground).toRgbString())
  expect(bg(p2.tabs[0]!.id)).toBe(
    colord(workspaceTheme.selectedTabBackground).toRgbString(),
  )
})

const tabsIn = (container: HTMLElement) =>
  [...container.querySelectorAll('[role="tab"]')] as HTMLElement[]

const childSizes = (session: ReturnType<typeof TestSession.create>) =>
  (session.tree as unknown as { children: { size: number }[] }).children.map(
    c => c.size,
  )

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

// manual activation, since showing a tab mounts views that cost WebGL2 contexts
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

  expect((document.activeElement as HTMLElement).dataset.tabId).toBe(first)
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

test('the panel actions are in the strip but not in the tablist', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
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

test('the shown tab and its panel name each other', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
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

  // unmeasured in jsdom, so Home reaches zero but the pane survives
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

// jsdom measures every rect as zero and the splitter will not arm on a zero
// pair, so the panes get a width
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

// a right-press loses its `pointerup` to the context menu
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

// a touch long-press cancels the pointer with no `pointerup`
test('pointercancel ends the resize', () => {
  const session = twoPanes()
  const splitter = splitterOverPanes(session)

  fireEvent.pointerDown(splitter, { button: 0, pointerId: 1, clientX: 500 })
  fireEvent.pointerCancel(splitter, { pointerId: 1 })
  fireEvent.pointerMove(splitter, { pointerId: 1, clientX: 600 })

  expect(childSizes(session)[0]!).toBeCloseTo(0.5, 5)
})

// jsdom computes no layout, so only the handler's arithmetic is checkable
test('a mouse wheel over the strip scrolls it sideways', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  const { container } = renderLayout(session)
  const list = container.querySelector('[role="tablist"]') as HTMLElement

  list.scrollLeft = 0
  fireEvent.wheel(list, { deltaY: 120, deltaX: 0 })
  expect(list.scrollLeft).toBe(120)

  fireEvent.wheel(list, { deltaY: -40, deltaX: 0 })
  expect(list.scrollLeft).toBe(80)
})

// Firefox reports a mouse wheel in lines; Chrome-only checks cannot see this
test('a wheel reporting lines or pages is converted to pixels', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  const { container } = renderLayout(session)
  const list = container.querySelector('[role="tablist"]') as HTMLElement

  // one Firefox mouse-wheel notch
  list.scrollLeft = 0
  fireEvent.wheel(list, { deltaY: 3, deltaX: 0, deltaMode: 1 })
  expect(list.scrollLeft).toBe(48)

  // a page is the strip's visible width, which jsdom measures as 0
  list.scrollLeft = 0
  Object.defineProperty(list, 'clientWidth', {
    value: 400,
    configurable: true,
  })
  fireEvent.wheel(list, { deltaY: 2, deltaX: 0, deltaMode: 2 })
  expect(list.scrollLeft).toBe(800)
})

// the browser already applied a trackpad's deltaX
test('a horizontal gesture is left to the browser', () => {
  const session = withTwoTabs(TestSession.create({ name: 't' }))
  const { container } = renderLayout(session)
  const list = container.querySelector('[role="tablist"]') as HTMLElement

  list.scrollLeft = 50
  fireEvent.wheel(list, { deltaX: 200, deltaY: 5 })
  expect(list.scrollLeft).toBe(50)
})

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
