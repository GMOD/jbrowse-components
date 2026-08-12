import { types } from '@jbrowse/mobx-state-tree'
import { render, screen } from '@testing-library/react'

import { LayoutRenderer } from './LayoutRenderer.tsx'
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
