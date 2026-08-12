import { createJBrowseTheme } from '@jbrowse/core/ui'
import { colord } from '@jbrowse/core/util/colord'
import { types } from '@jbrowse/mobx-state-tree'
import { render, screen } from '@testing-library/react'

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
}

function renderLayout(session: ReturnType<typeof TestSession.create>) {
  return render(
    <LayoutRenderer
      node={session.tree}
      layout={session}
      dragHandlers={noDrag}
      renderTabLabel={tab => <span>{tab.title ?? tab.id}</span>}
      renderTabContent={tab => (
        <div data-testid={`content-${tab.id}`}>{tab.viewIds.join(',')}</div>
      )}
    />,
  )
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

  const strip = container.querySelector('[role="tablist"]')!
  const style = getComputedStyle(strip)
  expect(style.backgroundColor).toBe(colord(dv.tabsBackground).toRgbString())
  expect(style.height).toBe(`${dv.tabsHeight}px`)
  // and emphatically not the theme's surface colour
  expect(style.backgroundColor).not.toBe(
    colord(createJBrowseTheme().palette.background.paper).toRgbString(),
  )
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
