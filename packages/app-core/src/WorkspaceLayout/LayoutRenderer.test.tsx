import { types } from '@jbrowse/mobx-state-tree'
import { render, screen } from '@testing-library/react'

import { LayoutRenderer } from './LayoutRenderer.tsx'
import { WorkspaceLayoutMixin } from './model.ts'

const TestSession = types.compose(
  'TestSession',
  types.model({ name: types.string }),
  WorkspaceLayoutMixin(),
)

function renderLayout(session: ReturnType<typeof TestSession.create>) {
  return render(
    <LayoutRenderer
      node={session.tree}
      layout={session}
      renderPanel={(panelId, viewIds) => (
        <div data-testid={`panel-${panelId}`}>{viewIds.join(',')}</div>
      )}
    />,
  )
}

test('renders one panel per leaf, with its views', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  session.addViewToPanel(p1, 'view-1')
  const p2 = session.splitPanel(p1, 'row')
  session.addViewToPanel(p2, 'view-2')

  renderLayout(session)

  expect(screen.getByTestId(`panel-${p1}`).textContent).toBe('view-1')
  expect(screen.getByTestId(`panel-${p2}`).textContent).toBe('view-2')
})

test('a splitter sits between each pair of siblings, not at the edges', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')
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

  const grows = [...container.querySelectorAll('[data-testid^="panel-"]')].map(
    el => el.parentElement!.style.flexGrow,
  )
  expect(grows).toEqual(['0.7', '0.3'])
})

test('a nested split renders as a nested flex container', () => {
  const session = TestSession.create({ name: 't' })
  const p1 = session.panels[0]!.id
  const p2 = session.splitPanel(p1, 'row')
  session.splitPanel(p2, 'column')

  const { container } = renderLayout(session)

  const row = container.firstElementChild as HTMLElement
  expect(row.style.flexDirection).toBe('row')
  const nested = [...row.children].find(
    el => (el as HTMLElement).style.flexDirection === 'column',
  )
  expect(nested).toBeDefined()
  expect(container.querySelectorAll('[data-testid^="panel-"]')).toHaveLength(3)
})
