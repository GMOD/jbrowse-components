import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import BaseViewModel from '@jbrowse/core/pluggableElementTypes/models/BaseViewModel'
import { createJBrowseTheme } from '@jbrowse/core/ui/theme'
import { types } from '@jbrowse/mobx-state-tree'
import { MultipleViewsSessionMixin } from '@jbrowse/product-core'
import { ThemeProvider } from '@mui/material'
import { cleanup, render } from '@testing-library/react'

import { WorkspaceLayoutMixin } from '../../WorkspaceLayout/model.ts'
import ViewStack from './ViewStack.tsx'

import type { WorkspaceSessionType } from './types.ts'

afterEach(cleanup)

class ZoomStubPlugin extends Plugin {
  name = 'ZoomStubPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'ZoomStubView',
          stateModel: types
            .compose(
              BaseViewModel,
              types.model('ZoomStubView', {
                type: types.literal('ZoomStubView'),
                zoomOf: types.maybe(types.string),
              }),
            )
            .views(self => ({
              get zoomConnector() {
                return self.zoomOf
                  ? {
                      top: { leftPx: 100, rightPx: 120 },
                      bottom: { leftPx: 0, rightPx: 800 },
                    }
                  : undefined
              },
            })),
          ReactComponent: () => <div>view body</div>,
        }),
    )
  }
}

const pluginManager = new PluginManager([new ZoomStubPlugin()])
  .createPluggableElements()
  .configure()

function renderStack(views: { id: string; zoomOf?: string }[]) {
  const session = types
    .compose(MultipleViewsSessionMixin(pluginManager), WorkspaceLayoutMixin())
    .create({ name: 'test' }, { pluginManager }) as WorkspaceSessionType
  for (const view of views) {
    session.addView('ZoomStubView', view)
  }
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <ViewStack views={session.views} session={session} />
    </ThemeProvider>,
  )
}

test('a connector joins a close-up to the view directly above it', () => {
  const { queryAllByTestId, getByTestId } = renderStack([
    { id: 'overview' },
    { id: 'closeUp', zoomOf: 'overview' },
    { id: 'farCloseUp', zoomOf: 'overview' },
  ])
  expect(getByTestId('zoom-connector-overview-closeUp')).toBeTruthy()
  expect(queryAllByTestId(/^zoom-connector-/)).toHaveLength(1)
})

test('a close-up stacked above its source gets a connector pointing up', () => {
  const { getByTestId } = renderStack([
    { id: 'closeUp', zoomOf: 'overview' },
    { id: 'overview' },
  ])
  const points = getByTestId('zoom-connector-closeUp-overview')
    .querySelector('polygon')!
    .getAttribute('points')
  expect(points).toBe('106,44 126,44 806,0 6,0')
})

test('an unlinked stack has no connector', () => {
  const { queryAllByTestId } = renderStack([{ id: 'a' }, { id: 'b' }])
  expect(queryAllByTestId(/^zoom-connector-/)).toHaveLength(0)
})
