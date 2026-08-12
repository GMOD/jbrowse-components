import { applyOrderWithin } from '@jbrowse/core/util'
import { cast, types } from '@jbrowse/mobx-state-tree'
import { act, renderHook } from '@testing-library/react'
import { createDockview } from 'dockview-react'

import { DockviewLayoutMixin } from '../../DockviewLayout/index.ts'
import { useDockviewController } from './useDockviewController.ts'

import type { DockviewGroupPanel } from 'dockview-react'

// Same stand-in as dockviewUtils.test.ts: the controller only ever reads ids
// off `session.views`, so a bare id model is the whole surface it needs.
const TestSessionModel = types
  .compose(
    'TestSession',
    types.model({
      name: types.string,
      views: types.array(types.model({ id: types.identifier })),
    }),
    DockviewLayoutMixin(),
  )
  .actions(self => ({
    orderViews(ids: string[]) {
      self.views = cast(applyOrderWithin(self.views, ids, v => v.id))
    },
    removeView(view: { id: string }) {
      self.views.splice(
        self.views.findIndex(v => v.id === view.id),
        1,
      )
    },
  }))

type ControllerSession = Parameters<typeof useDockviewController>[0]

/**
 * Stands in for dockview-react's ReactHeaderActionsRendererPart, which is the
 * thing that actually blew up: it subscribes to its group's panel events and
 * throws "invalid operation: resource is already disposed" if one reaches it
 * after the group has gone. Reproducing that here keeps the regression visible
 * without mounting React portals.
 */
class ThrowingHeaderActions {
  element = document.createElement('div')
  private disposed = false
  private disposables: { dispose: () => void }[] = []

  constructor(private group: DockviewGroupPanel) {}

  init() {
    const assertLive = () => {
      if (this.disposed) {
        throw new Error('invalid operation: resource is already disposed')
      }
    }
    this.disposables.push(
      this.group.model.onDidActivePanelChange(assertLive),
      this.group.model.onDidAddPanel(assertLive),
    )
  }

  dispose() {
    for (const disposable of this.disposables) {
      disposable.dispose()
    }
    this.disposed = true
  }
}

function createApi() {
  const element = document.createElement('div')
  document.body.append(element)
  const api = createDockview(element, {
    createComponent: () => ({
      element: document.createElement('div'),
      init: () => {},
      dispose: () => {},
    }),
    createLeftHeaderActionComponent: group => new ThrowingHeaderActions(group),
  })
  api.layout(1000, 800)
  return api
}

async function setup(viewIds: string[]) {
  const session = TestSessionModel.create({
    name: 'test',
    views: viewIds.map(id => ({ id })),
  })
  const { result } = renderHook(() =>
    useDockviewController(session as unknown as ControllerSession),
  )
  const api = createApi()
  await act(async () => {
    result.current.onReady({ api })
    // let dockview's AsapEvent layout echo land, so the session's persisted
    // layout is the one the panels are actually in before the test acts
    await Promise.resolve()
  })
  return { api, session, controller: result }
}

// Adding a panel makes dockview fire onDidActivePanelChange synchronously,
// which writes session.activePanelId, which runs the sync autorun mid-mutation.
// The autorun used to compare dockview against a `dockviewLayout` that is
// merely stale — onDidLayoutChange has not persisted the new panel yet — and
// "restore" it, tearing down the groups dockview was in the middle of using.
test('a split survives the autorun running mid-mutation', async () => {
  const { api, controller } = await setup(['view-1'])
  const group = api.groups[0]!

  act(() => {
    const newGroup = api.addGroup({ referenceGroup: group, direction: 'right' })
    controller.current.contextValue.addEmptyTab(newGroup)
  })

  expect(api.groups.length).toBe(2)
  expect(api.panels.length).toBe(2)
})

test('a new empty tab survives the autorun running mid-mutation', async () => {
  const { api, controller } = await setup(['view-1'])

  act(() => {
    controller.current.contextValue.addEmptyTab()
  })

  expect(api.groups.length).toBe(1)
  expect(api.panels.length).toBe(2)
})

// The reason the comparison cannot simply be dropped: undo rewinds
// dockviewLayout through applySnapshot, and dockview has to be told.
test('a layout rewound out from under dockview is re-applied', async () => {
  const { api, session, controller } = await setup(['view-1'])
  const oneGroup = session.dockviewLayout

  act(() => {
    const group = api.groups[0]!
    const newGroup = api.addGroup({ referenceGroup: group, direction: 'right' })
    controller.current.contextValue.addEmptyTab(newGroup)
  })
  expect(api.groups.length).toBe(2)

  await act(async () => {
    await Promise.resolve()
  })
  act(() => {
    session.setDockviewLayout(oneGroup)
  })

  expect(api.groups.length).toBe(1)
})
