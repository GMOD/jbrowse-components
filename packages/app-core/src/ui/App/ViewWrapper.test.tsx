import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { MultipleViewsSessionMixin } from '@jbrowse/product-core'
import { cleanup, fireEvent, render } from '@testing-library/react'

import ViewWrapper from './ViewWrapper.tsx'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

afterEach(cleanup)

// flipped by a test to make the view's component recover, which is the only way
// to tell a boundary that reset from one that never caught anything
let viewThrows = true

function fakeView(name: string) {
  return types.model(name, {
    id: ElementId,
    type: types.literal(name),
    displayName: types.maybe(types.string),
  })
}

class FakeViewsPlugin extends Plugin {
  name = 'FakeViewsPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addViewType(
      () =>
        new ViewType({
          name: 'ThrowingView',
          stateModel: fakeView('ThrowingView'),
          ReactComponent: () => {
            if (viewThrows) {
              throw new Error('the view exploded')
            }
            return <div>view body</div>
          },
        }),
    )
  }
}

const pluginManager = new PluginManager([new FakeViewsPlugin()])
  .createPluggableElements()
  .configure()

function sessionWithView(type = 'ThrowingView') {
  const session = MultipleViewsSessionMixin(pluginManager).create(
    { name: 'test' },
    { pluginManager },
  )
  session.addView(type, { displayName: 'my crashed view' })
  return session as unknown as SessionWithFocusedViewAndDrawerWidgets
}

// The outer boundary stands in for the product's own — jbrowse-web's fallback
// there is FatalErrorDialog, i.e. the whole application. Every assertion that
// 'app boundary' is absent is the containment claim.
function renderView(session: SessionWithFocusedViewAndDrawerWidgets) {
  return render(
    <ErrorBoundary FallbackComponent={() => <div>app boundary</div>}>
      <ViewWrapper view={session.views[0]!} session={session} />
    </ErrorBoundary>,
  )
}

beforeEach(() => {
  viewThrows = true
})

test('a view that throws is contained, and the fallback names it', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const session = sessionWithView()

  const { queryByText, getByTestId, container } = renderView(session)

  expect(queryByText('app boundary')).toBeNull()
  expect(getByTestId('error-message-box').textContent).toContain(
    'the view exploded',
  )
  // type and title, so a session of six views says which one died
  expect(container.textContent).toContain('ThrowingView')
  expect(container.textContent).toContain('my crashed view')
  spy.mockRestore()
})

test('retry remounts the view once the cause has cleared', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const session = sessionWithView()
  const { getByTestId, getByText } = renderView(session)

  viewThrows = false
  fireEvent.click(getByTestId('reload_button'))

  expect(getByText('view body')).toBeTruthy()
  spy.mockRestore()
})

// The other way out, and the one that has to go through the session: removeView
// detaches before it destroys, so the components still mounted over the view get
// their final read against a live tree (ADR-069).
test('close removes the view from the session', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const session = sessionWithView()
  const { getByTestId, queryByText } = renderView(session)

  fireEvent.click(getByTestId('close_crashed_view'))

  expect(session.views).toHaveLength(0)
  expect(queryByText('app boundary')).toBeNull()
  spy.mockRestore()
})

// A build whose plugin set lacks the view type fails before any of the view's
// own code runs, which is why the lookup sits inside the boundary rather than in
// its own render.
test('an unregistered view type is contained too, and names itself', () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const session = sessionWithView()
  const view = {
    id: 'unregistered',
    type: 'NotRegisteredView',
    displayName: 'a view from a plugin that did not load',
    minimized: false,
  } as unknown as AbstractViewModel

  const { queryByText, getByTestId } = render(
    <ErrorBoundary FallbackComponent={() => <div>app boundary</div>}>
      <ViewWrapper view={view} session={session} />
    </ErrorBoundary>,
  )

  expect(queryByText('app boundary')).toBeNull()
  const message = getByTestId('error-message-box').textContent
  expect(message).toContain('NotRegisteredView')
  expect(message).toContain('ThrowingView')
  spy.mockRestore()
})
