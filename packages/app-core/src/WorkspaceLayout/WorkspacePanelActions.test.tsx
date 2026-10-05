import { types } from '@jbrowse/mobx-state-tree'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { WorkspacePanelActions } from './WorkspacePanelActions.tsx'
import { WorkspaceLayoutMixin } from './model.ts'

import type { WorkspaceSessionType } from '../ui/App/types.ts'
import type { WorkspaceLayout } from './model.ts'

// asserts labels: a deleted menu item fails no type check and no model test

const TestSession = types.compose(
  'TestSession',
  types.model({
    name: types.string,
    views: types.array(types.model('TestView', { id: types.identifier })),
  }),
  WorkspaceLayoutMixin(),
)

function setup(viewCount: number) {
  const session = TestSession.create({
    name: 't',
    views: Array.from({ length: viewCount }, (_, i) => ({ id: `view-${i}` })),
  })
  session.homeUnassignedViews(session.views.map(v => v.id))
  render(
    <WorkspacePanelActions
      panel={session.panels[0]!}
      session={session as unknown as WorkspaceSessionType & WorkspaceLayout}
      onClose={() => {}}
    />,
  )
  return { session, user: userEvent.setup() }
}

const ARRANGEMENTS = ['As tabs', 'Side by side', 'Stacked', 'Grid']

test('the cell menu offers the four whole-workspace arrangements', async () => {
  const { user } = setup(3)
  await user.click(screen.getByRole('button', { name: 'Panel menu' }))
  await user.click(await screen.findByText('Arrange all views'))

  for (const label of ARRANGEMENTS) {
    expect(await screen.findByText(label)).toBeTruthy()
  }
})

test('side by side from the menu rearranges every cell', async () => {
  const { session, user } = setup(3)
  expect(session.panels).toHaveLength(1)

  await user.click(screen.getByRole('button', { name: 'Panel menu' }))
  await user.click(await screen.findByText('Arrange all views'))
  await user.click(await screen.findByText('Side by side'))

  expect(session.panels).toHaveLength(3)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([
    ['view-0'],
    ['view-1'],
    ['view-2'],
  ])
})

test('a lone view gets the per-cell items and no arrangements', async () => {
  const { user } = setup(1)
  await user.click(screen.getByRole('button', { name: 'Panel menu' }))

  expect(await screen.findByText('New empty tab')).toBeTruthy()
  expect(screen.queryByText('Arrange all views')).toBeNull()
})

test('the cell menu offers maximize, and says restore once maximized', async () => {
  const session = TestSession.create({
    name: 't',
    views: [{ id: 'view-0' }, { id: 'view-1' }],
  })
  session.homeUnassignedViews(session.views.map(v => v.id))
  const panel = session.panels[0]!
  session.splitPanel(panel.id, 'row')
  const cast = session as unknown as WorkspaceSessionType & WorkspaceLayout

  const view = render(
    <WorkspacePanelActions panel={panel} session={cast} onClose={() => {}} />,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Panel menu' }))
  await user.click(await screen.findByText('Maximize panel'))

  expect(session.maximizedPanelId).toBe(panel.id)

  view.rerender(
    <WorkspacePanelActions panel={panel} session={cast} onClose={() => {}} />,
  )
  await user.click(screen.getByRole('button', { name: 'Panel menu' }))
  expect(await screen.findByText('Restore panel')).toBeTruthy()
  expect(screen.queryByText('Maximize panel')).toBeNull()
})

test('a maximized cell shows a restore button beside its menu', async () => {
  const session = TestSession.create({ name: 't', views: [{ id: 'view-0' }] })
  session.homeUnassignedViews(['view-0'])
  const panel = session.panels[0]!
  session.splitPanel(panel.id, 'row')
  session.toggleMaximizedPanel(panel.id)

  render(
    <WorkspacePanelActions
      panel={panel}
      session={session as unknown as WorkspaceSessionType & WorkspaceLayout}
      onClose={() => {}}
    />,
  )
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'Restore panel' }))

  expect(session.maximizedPanelId).toBeUndefined()
})

test('a lone cell is not offered maximize', async () => {
  const { user } = setup(2)
  await user.click(screen.getByRole('button', { name: 'Panel menu' }))

  expect(await screen.findByText('New empty tab')).toBeTruthy()
  expect(screen.queryByText('Maximize panel')).toBeNull()
})

// `WorkspaceContainer.closeViews` owns removing the views, so the button must
// not touch the session itself
test('the cell close button delegates rather than closing anything itself', async () => {
  const closed: string[] = []
  const session = TestSession.create({
    name: 't',
    views: [{ id: 'view-0' }, { id: 'view-1' }],
  })
  session.homeUnassignedViews(session.views.map(v => v.id))
  const panel = session.panels[0]!
  session.splitPanel(panel.id, 'row')

  render(
    <WorkspacePanelActions
      panel={panel}
      session={session as unknown as WorkspaceSessionType & WorkspaceLayout}
      onClose={() => {
        closed.push(panel.id)
      }}
    />,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Close panel' }))

  expect(closed).toEqual([panel.id])
  expect(session.panels).toHaveLength(2)
  expect(session.tabs.flatMap(t => [...t.viewIds])).toEqual([
    'view-0',
    'view-1',
  ])
})
