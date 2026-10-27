import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { types } from '@jbrowse/mobx-state-tree'
import { MultipleViewsSessionMixin } from '@jbrowse/product-core'
import { cleanup, render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import { WorkspaceLayoutMixin } from '../../WorkspaceLayout/model.ts'
import ViewMenu from './ViewMenu.tsx'

afterEach(cleanup)

class FakeViewsPlugin extends Plugin {
  name = 'FakeViewsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'StubView',
          stateModel: types.compose(
            BaseViewModel,
            types.model('StubView', { type: types.literal('StubView') }),
          ),
          ReactComponent: () => null,
        }),
    )
  }
}

const pluginManager = new PluginManager([new FakeViewsPlugin()])
  .createPluggableElements()
  .configure()

const Session = types.compose(
  MultipleViewsSessionMixin(pluginManager),
  WorkspaceLayoutMixin(),
)

function setup() {
  const session = Session.create({ name: 'test' }, { pluginManager })
  for (const name of ['first', 'second', 'third']) {
    session.addView('StubView', { displayName: name })
  }
  session.homeUnassignedViews(session.views.map(v => v.id))
  return { session, user: userEvent.setup() }
}

async function openViewOptions(
  user: ReturnType<typeof userEvent.setup>,
  view: (typeof Session.Type)['views'][number],
) {
  render(<ViewMenu model={view} />)
  await user.click(screen.getByTestId('view_menu_icon'))
  await user.click(await screen.findByText('View options'))
}

const moveLabels = [
  'Move to new tab',
  'Move to split view (right)',
  'Move to split view (below)',
]

test('a lone view is offered none of the moves that change nothing', async () => {
  const session = Session.create({ name: 'test' }, { pluginManager })
  session.addView('StubView', { displayName: 'only' })
  session.homeUnassignedViews(session.views.map(v => v.id))
  const user = userEvent.setup()
  await openViewOptions(user, session.views[0]!)

  expect(await screen.findByText('Copy view')).toBeTruthy()
  for (const label of moveLabels) {
    expect(screen.queryByText(label)).toBeNull()
  }
})

test('a view alone in one of two tabs can split but not move to a new tab', async () => {
  const { session, user } = setup()
  const [first, second, third] = session.views
  session.moveViewToNewTab(third!.id)
  session.moveViewToNewTab(second!.id)
  expect(session.tabContainingView(first!.id)!.tab.viewIds).toHaveLength(1)
  await openViewOptions(user, session.views[2]!)

  expect(await screen.findByText('Move to split view (right)')).toBeTruthy()
  expect(screen.getByText('Move to split view (below)')).toBeTruthy()
  expect(screen.queryByText('Move to new tab')).toBeNull()
})

test('a view can be moved into a new tab or either split', async () => {
  const { session, user } = setup()
  await openViewOptions(user, session.views[0]!)

  expect(await screen.findByText('Move to new tab')).toBeTruthy()
  expect(screen.getByText('Move to split view (right)')).toBeTruthy()
  expect(screen.getByText('Move to split view (below)')).toBeTruthy()
})

test('a view moves into another tab, by that tab’s name, at its bottom', async () => {
  const { session, user } = setup()
  const [first, second, third] = session.views
  session.moveViewToNewTab(third!.id)
  const target = session.tabContainingView(third!.id)!.tab.id

  await openViewOptions(user, first!)
  await user.click(await screen.findByText('Move to tab'))
  await user.click(await screen.findByText('third'))

  expect(session.tabContainingView(first!.id)!.tab.id).toBe(target)
  expect(session.tabContainingView(second!.id)!.tab.id).not.toBe(target)
  const members = session.findTab(target)!.tab.viewIds
  expect(
    session.views.map(v => v.id).filter(id => members.includes(id)),
  ).toEqual([third!.id, first!.id])
})

test('with one tab there is no tab to move to', async () => {
  const { session, user } = setup()
  await openViewOptions(user, session.views[0]!)

  expect(await screen.findByText('Move to new tab')).toBeTruthy()
  expect(screen.queryByText('Move to tab')).toBeNull()
})
