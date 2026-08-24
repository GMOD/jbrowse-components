import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { MultipleViewsSessionMixin } from '@jbrowse/product-core'
import { ThemeProvider } from '@mui/material'
import { cleanup, fireEvent, render } from '@testing-library/react'

import ViewContainer from './ViewContainer.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

afterEach(cleanup)

class FakeViewsPlugin extends Plugin {
  name = 'FakeViewsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'StubView',
          // composed over BaseViewModel rather than declared bare: the
          // container drives real view members on it (`setWidth`,
          // `setBodyMounted`, `minimized`), and a stub that merely happens not
          // to be asked for one passes by accident
          stateModel: types.compose(
            BaseViewModel,
            types.model('StubView', {
              type: types.literal('StubView'),
            }),
          ),
          ReactComponent: () => <div>view body</div>,
        }),
    )
  }
}

const pluginManager = new PluginManager([new FakeViewsPlugin()])
  .createPluggableElements()
  .configure()

function setup() {
  const session = MultipleViewsSessionMixin(pluginManager).create(
    { name: 'test' },
    { pluginManager },
  ) as unknown as SessionWithFocusedViewAndDrawerWidgets
  session.addView('StubView', { displayName: 'my view' })
  const view = session.views[0]!
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ViewContainer view={view} session={session} />
    </ThemeProvider>,
  )
  return {
    ...utils,
    session,
    view,
    container: utils.getByTestId(`view-container-${view.id}`),
  }
}

// WCAG 2.1.1 and 4.1.2 both fail on the same missing thing: the view is the
// application's primary surface and used to be neither reachable nor nameable.
// The ctrl/cmd + arrow shortcuts are gated on `session.focusedViewId`, so a
// container that cannot be Tabbed to is a keyboard user's dead end.
test('the view container is a tab stop, with a role and a name', () => {
  const { container } = setup()

  expect(container.getAttribute('tabindex')).toBe('0')
  expect(container.getAttribute('role')).toBe('region')
  expect(container.getAttribute('aria-label')).toBe('my view')
})

test('a Tab into the view focuses it in the session', () => {
  const { container, session, view } = setup()
  expect(session.focusedViewId).toBeUndefined()

  container.focus()

  expect(session.focusedViewId).toBe(view.id)
})

// The path every existing user is on. A regression here is worse than the
// feature is worth, so it is pinned alongside it.
test('a click still focuses the view', () => {
  const { container, session, view } = setup()

  fireEvent.mouseDown(container)

  expect(session.focusedViewId).toBe(view.id)
})
