import { applyOrderWithin } from '@jbrowse/core/util'
import { cast, types } from '@jbrowse/mobx-state-tree'
import { act, renderHook } from '@testing-library/react'
import { createDockview } from 'dockview-react'
import { autorun } from 'mobx'

import { DockviewLayoutMixin } from '../../DockviewLayout/index.ts'
import { rearrangePanelsWithDirection } from './dockviewUtils.ts'
import { useDockviewController } from './useDockviewController.ts'

import type { DockviewApi } from 'dockview-react'

/**
 * One invariant, asserted over every workspace operation: **the controller
 * never calls into dockview while dockview is mid-mutation.**
 *
 * That is the shape of every hard bug this seam has had. dockview's panel
 * events fire synchronously, our handlers for them write to the session, and an
 * MST action flushes reactions the instant it returns — so the sync autorun
 * routinely runs from inside `_doAddPanel` or `_doRemovePanel`. Calling back in
 * from there disposes groups whose events are still being dispatched
 * ("invalid operation: resource is already disposed") or re-enters an add
 * already in flight.
 *
 * These tests assert the invariant rather than the symptom, because the symptom
 * depends on which listener happens to run next — the close-into-init case
 * below violated the invariant for a long time while surviving on the accident
 * that `clearPanelAssignments` empties the assignments before `api.clear()`
 * fires the removes that would have read them.
 */

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

let violations: string[] = []

// Wraps the mutating api methods and records any call made while dockview's own
// onWillMutateLayout/onDidMutateLayout bracket is open. Nested mutations join
// the outermost bracket, so depth is 0 or 1 and any 1 is a violation.
function createInstrumentedApi() {
  const element = document.createElement('div')
  document.body.append(element)
  const api = createDockview(element, {
    createComponent: () => ({
      element: document.createElement('div'),
      init: () => {},
      dispose: () => {},
    }),
  }) as DockviewApi & Record<string, any>
  api.layout(1000, 800)

  let depth = 0
  api.onWillMutateLayout(() => {
    depth++
  })
  api.onDidMutateLayout(() => {
    depth--
  })
  for (const name of ['fromJSON', 'clear', 'addPanel', 'removePanel']) {
    const original = api[name].bind(api)
    api[name] = (...args: unknown[]) => {
      if (depth > 0) {
        violations.push(`${name} during a dockview mutation`)
      }
      return original(...args)
    }
  }
  return api as DockviewApi
}

async function setup(viewIds: string[]) {
  const session = TestSessionModel.create({
    name: 'test',
    views: viewIds.map(id => ({ id })),
  })
  const { result } = renderHook(() =>
    useDockviewController(session as unknown as ControllerSession),
  )
  const api = createInstrumentedApi()
  await act(async () => {
    result.current.onReady({ api })
    await Promise.resolve()
  })
  return { api, session, controller: result }
}

// deferred work resumes on a microtask, so every assertion has to let it land
async function settle() {
  await act(async () => {
    await Promise.resolve()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  violations = []
})

test('opening an empty tab', async () => {
  const { controller } = await setup(['view-1'])
  act(() => {
    controller.current.contextValue.addEmptyTab()
  })
  await settle()
  expect(violations).toEqual([])
})

test('splitting', async () => {
  const { api, controller } = await setup(['view-1'])
  act(() => {
    const group = api.addGroup({
      referenceGroup: api.groups[0],
      direction: 'right',
    })
    controller.current.contextValue.addEmptyTab(group)
  })
  await settle()
  expect(violations).toEqual([])
})

test('moving a view to its own tab', async () => {
  const { controller } = await setup(['view-1', 'view-2'])
  act(() => {
    controller.current.contextValue.moveViewToNewTab('view-2')
  })
  await settle()
  expect(violations).toEqual([])
})

test('the user closing a panel', async () => {
  const { api, session, controller } = await setup(['view-1', 'view-2'])
  act(() => {
    controller.current.contextValue.moveViewToNewTab('view-2')
  })
  await settle()
  const panelId = session.getPanelContainingView('view-2')!.panelId
  act(() => {
    api.getPanel(panelId)!.api.close()
  })
  await settle()
  expect(violations).toEqual([])
})

test('the user closing the last panel', async () => {
  const { api, session } = await setup(['view-1'])
  act(() => {
    api.getPanel(session.activePanelId!)!.api.close()
  })
  await settle()
  expect(violations).toEqual([])
})

test('a tile preset', async () => {
  const { controller } = await setup(['view-1', 'view-2'])
  act(() => {
    controller.current.contextValue.moveViewToNewTab('view-2')
  })
  await settle()
  act(() => {
    controller.current.contextValue.rearrangePanels(dockviewApi => {
      rearrangePanelsWithDirection(dockviewApi, (idx, states) =>
        idx === 0
          ? undefined
          : { referencePanel: states[0]!.id, direction: 'right' },
      )
    })
  })
  await settle()
  expect(violations).toEqual([])
})

test('undo rewinding the layout', async () => {
  const { session, controller } = await setup(['view-1'])
  const before = session.dockviewLayout
  act(() => {
    controller.current.contextValue.addEmptyTab()
  })
  await settle()
  act(() => {
    session.setDockviewLayout(before)
  })
  await settle()
  expect(violations).toEqual([])
})

test('an init arriving while the workspace is up', async () => {
  const { session } = await setup(['view-1', 'view-2'])
  act(() => {
    session.setInit({
      direction: 'horizontal',
      children: [{ viewIds: ['view-1'] }, { viewIds: ['view-2'] }],
    })
  })
  await settle()
  expect(violations).toEqual([])
})

// The case the per-caller guards cannot reach, and the reason the invariant is
// stated as an invariant. A user close writes to the session synchronously; any
// other model reacting to `session.views` can turn that write into an `init`
// (setPendingMove is public API precisely so plugins can), and applyInit then
// clears the grid from inside the user's own close.
test('a reaction turning a user close into an init', async () => {
  const { api, session, controller } = await setup([
    'view-1',
    'view-2',
    'view-3',
  ])
  act(() => {
    controller.current.contextValue.moveViewToNewTab('view-3')
  })
  await settle()

  let armed = false
  const dispose = autorun(() => {
    const ids = session.views.map(v => v.id)
    if (armed && ids.length === 2) {
      session.setInit({
        direction: 'horizontal',
        children: ids.map(id => ({ viewIds: [id] })),
      })
    }
  })
  armed = true

  const panelId = session.getPanelContainingView('view-3')!.panelId
  act(() => {
    api.getPanel(panelId)!.api.close()
  })
  await settle()
  dispose()

  expect(violations).toEqual([])
  // and the deferral must not have cost us the operation itself
  expect(session.views.map(v => v.id)).toEqual(['view-1', 'view-2'])
  expect(api.panels.length).toBe(2)
  for (const view of session.views) {
    expect(session.getPanelContainingView(view.id)).toBeDefined()
  }
})
