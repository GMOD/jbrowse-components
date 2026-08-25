import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { MultipleViewsSessionMixin } from '@jbrowse/product-core'
import { ThemeProvider } from '@mui/material'
import { act, cleanup, render } from '@testing-library/react'
import { observer } from 'mobx-react'

import { LayoutRenderer } from '../../WorkspaceLayout/LayoutRenderer.tsx'
import { WorkspaceLayoutMixin } from '../../WorkspaceLayout/model.ts'
import ViewContainer from './ViewContainer.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
          ReactComponent: () => <div>view body</div>,
        }),
    )
  }
}

const pluginManager = new PluginManager([new FakeViewsPlugin()])
  .createPluggableElements()
  .configure()

const Session = types.compose(
  'TestWorkspaceSession',
  MultipleViewsSessionMixin(pluginManager),
  WorkspaceLayoutMixin(),
)

type TestSession = SessionWithFocusedViewAndDrawerWidgets &
  Instance<typeof Session>

// As much of the workspace as this is about: one panel, two tabs, a view in
// each, rendered the way `WorkspaceContainer` renders them — a `ViewContainer`
// per view of whichever tab is showing, and nothing at all for the other tab.
// Reading `session.tree` inside the observer is load-bearing: a layout action
// replaces the tree node, so a captured one is dead after the first tab switch.
const Workspace = observer(function Workspace({
  session,
}: {
  session: TestSession
}) {
  return (
    <LayoutRenderer
      node={session.tree}
      layout={session}
      chrome={{
        dragHandlers: {
          onTabPointerDown: () => {},
          onTabPointerMove: () => {},
          onTabPointerUp: () => {},
          onTabPointerCancel: () => {},
        },
        renderTabLabel: tab => <span>{tab.id}</span>,
        renderTabContent: tab => (
          <>
            {session.views
              .filter(v => tab.viewIds.includes(v.id))
              .map(v => (
                <ViewContainer key={v.id} view={v} session={session} />
              ))}
          </>
        ),
      }}
    />
  )
})

function setup() {
  const session = Session.create(
    { name: 'test' },
    { pluginManager },
  ) as TestSession
  session.addView('StubView', { displayName: 'front' })
  session.addView('StubView', { displayName: 'back' })
  const front = session.views[0]!
  const back = session.views[1]!
  session.homeUnassignedViews([front.id])
  session.addTab(session.panels[0]!.id, [back.id])

  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Workspace session={session} />
    </ThemeProvider>,
  )
  const showTab = (index: number) => {
    act(() => {
      session.setActiveTab(session.panels[0]!.id, session.tabs[index]!.id)
    })
  }
  return { ...utils, session, front, back, showTab }
}

// A view whose container has left the DOM has no canvas to paint, so every
// display in it waits for a first paint that is never coming — the hang
// `bodyMounted` exists to prevent. The effect that writes the flag only ever
// wrote `true`: React unmounts the container without running the effect again,
// so a view went on claiming a body it no longer had.
test('a view whose tab stops showing reports its body unmounted', () => {
  const { front, back, showTab, queryByTestId } = setup()

  expect(queryByTestId(`view-container-${back.id}`)).not.toBeNull()
  expect(back.bodyMounted).toBe(true)

  showTab(0)

  expect(queryByTestId(`view-container-${back.id}`)).toBeNull()
  expect(back.bodyMounted).toBe(false)
  expect(queryByTestId(`view-container-${front.id}`)).not.toBeNull()
  expect(front.bodyMounted).toBe(true)
})

test('showing the tab again puts the wait back', () => {
  const { back, showTab, queryByTestId } = setup()

  showTab(0)
  showTab(1)

  expect(queryByTestId(`view-container-${back.id}`)).not.toBeNull()
  expect(back.bodyMounted).toBe(true)
})
