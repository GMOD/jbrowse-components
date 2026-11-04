import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { types } from '@jbrowse/mobx-state-tree'
import { MultipleViewsSessionMixin } from '@jbrowse/product-core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { WorkspaceLayoutMixin } from '../../WorkspaceLayout/model.ts'
import ViewButtons from './ViewButtons.tsx'

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

function setup(count: number) {
  const session = Session.create({ name: 'test' }, { pluginManager })
  for (let i = 0; i < count; i++) {
    session.addView('StubView', { displayName: `view ${i}` })
  }
  session.homeUnassignedViews(session.views.map(v => v.id))
  return session
}

test('closing the only view of a cell takes the cell too', () => {
  const session = setup(2)
  const [kept, closed] = session.views
  session.moveViewToSplit(closed!.id, 'row')
  expect(session.panels).toHaveLength(2)

  render(<ViewButtons view={closed!} />)
  fireEvent.click(screen.getByTestId('close_view'))

  expect(session.views.map(v => v.id)).toEqual([kept!.id])
  expect(session.panels).toHaveLength(1)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([[kept!.id]])
})

test('closing the last view leaves the launcher tab', () => {
  const session = setup(1)

  render(<ViewButtons view={session.views[0]!} />)
  fireEvent.click(screen.getByTestId('close_view'))

  expect(session.views).toHaveLength(0)
  expect(session.tabs.map(t => [...t.viewIds])).toEqual([[]])
})
