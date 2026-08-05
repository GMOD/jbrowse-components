import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import { DockviewLayoutMixin, isSessionWithDockviewLayout } from './index.ts'

// Create a minimal session model with the DockviewLayoutMixin
const TestSessionModel = types
  .compose(
    'TestSession',
    types.model({
      name: types.string,
    }),
    DockviewLayoutMixin(),
  )
  .actions(() => ({
    // Stub action required by some internal checks
  }))

const defaultSnapshot = { name: 'test' }

function createTestSession(snapshot = defaultSnapshot) {
  return TestSessionModel.create(snapshot)
}

describe('DockviewLayoutMixin', () => {
  describe('isSessionWithDockviewLayout', () => {
    it('returns true for session with dockview layout mixin', () => {
      const session = createTestSession()
      expect(isSessionWithDockviewLayout(session)).toBe(true)
    })

    it('returns false for plain object', () => {
      expect(isSessionWithDockviewLayout({})).toBe(false)
    })
  })

  describe('panel view assignments', () => {
    it('starts with empty assignments', () => {
      const session = createTestSession()
      expect(session.panelViewAssignments.size).toBe(0)
    })

    it('assignViewToPanel adds view to panel', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')

      expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-1'])
    })

    it('assignViewToPanel adds multiple views to same panel', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-1',
        'view-2',
      ])
    })

    it('assignViewToPanel does not duplicate views', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-1')

      expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-1'])
    })

    it('assignViewToPanel works with multiple panels', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-2', 'view-2')

      expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-1'])
      expect(session.getViewIdsForPanel('panel-2')).toEqual(['view-2'])
    })

    it('removeViewFromPanel removes view from panel', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')

      session.removeViewFromPanel('view-1')

      expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-2'])
    })

    it('removeViewFromPanel removes panel when empty', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')

      session.removeViewFromPanel('view-1')

      expect(session.panelViewAssignments.has('panel-1')).toBe(false)
    })

    it('removePanel removes entire panel', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')

      session.removePanel('panel-1')

      expect(session.panelViewAssignments.has('panel-1')).toBe(false)
    })

    it('getViewIdsForPanel returns empty array for unknown panel', () => {
      const session = createTestSession()
      expect(session.getViewIdsForPanel('unknown-panel')).toEqual([])
    })
  })

  describe('active panel', () => {
    it('starts with no active panel', () => {
      const session = createTestSession()
      expect(session.activePanelId).toBeUndefined()
    })

    it('setActivePanelId sets the active panel', () => {
      const session = createTestSession()
      session.setActivePanelId('panel-1')
      expect(session.activePanelId).toBe('panel-1')
    })

    it('setActivePanelId can clear active panel', () => {
      const session = createTestSession()
      session.setActivePanelId('panel-1')
      session.setActivePanelId(undefined)
      expect(session.activePanelId).toBeUndefined()
    })
  })

  describe('dockview layout', () => {
    it('starts with no layout', () => {
      const session = createTestSession()
      expect(session.dockviewLayout).toBeUndefined()
    })

    it('setDockviewLayout sets the layout', () => {
      const session = createTestSession()
      const mockLayout = { grid: {}, panels: {}, activeGroup: 'group-1' }

      session.setDockviewLayout(mockLayout as any)

      expect(session.dockviewLayout).toEqual(mockLayout)
    })

    it('setDockviewLayout can clear layout', () => {
      const session = createTestSession()
      session.setDockviewLayout({ grid: {} } as any)
      session.setDockviewLayout(undefined)
      expect(session.dockviewLayout).toBeUndefined()
    })
  })

  describe('snapshot handling', () => {
    it('excludes empty panelViewAssignments from snapshot', () => {
      const session = createTestSession()
      const snapshot = getSnapshot(session)

      expect(snapshot).not.toHaveProperty('panelViewAssignments')
    })

    it('includes panelViewAssignments in snapshot when not empty', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      const snapshot = getSnapshot(session)

      expect(snapshot.panelViewAssignments).toEqual({
        'panel-1': ['view-1'],
      })
    })

    it('excludes undefined dockviewLayout from snapshot', () => {
      const session = createTestSession()
      const snapshot = getSnapshot(session)

      expect(snapshot).not.toHaveProperty('dockviewLayout')
    })

    it('excludes undefined activePanelId from snapshot', () => {
      const session = createTestSession()
      const snapshot = getSnapshot(session)

      expect(snapshot).not.toHaveProperty('activePanelId')
    })
  })
})

describe('init configuration', () => {
  it('starts with no init', () => {
    const session = createTestSession()
    expect(session.init).toBeUndefined()
  })

  it('setInit sets a simple panel layout', () => {
    const session = createTestSession()
    const initConfig = {
      viewIds: ['view-1', 'view-2'],
    }

    session.setInit(initConfig)

    expect(session.init).toEqual(initConfig)
  })

  it('setInit sets a nested layout', () => {
    const session = createTestSession()
    const initConfig = {
      direction: 'horizontal' as const,
      children: [{ viewIds: ['view-1', 'view-2'] }, { viewIds: ['view-3'] }],
    }

    session.setInit(initConfig)

    expect(session.init).toEqual(initConfig)
  })

  it('setInit sets a deeply nested layout', () => {
    const session = createTestSession()
    const initConfig = {
      direction: 'horizontal' as const,
      children: [
        { viewIds: ['view-1'] },
        {
          direction: 'vertical' as const,
          children: [{ viewIds: ['view-2'] }, { viewIds: ['view-3'] }],
        },
      ],
    }

    session.setInit(initConfig)

    expect(session.init).toEqual(initConfig)
  })

  it('setInit can clear init', () => {
    const session = createTestSession()
    session.setInit({ viewIds: ['view-1'] })
    session.setInit(undefined)
    expect(session.init).toBeUndefined()
  })

  it('init round-trips through the snapshot (so a loaded session can carry a layout)', () => {
    const session = createTestSession()
    const initConfig = {
      direction: 'horizontal' as const,
      children: [{ viewIds: ['view-1'] }, { viewIds: ['view-2'] }],
    }
    session.setInit(initConfig)

    expect(getSnapshot(session)).toHaveProperty('init', initConfig)
  })

  it('init is stripped from the snapshot once cleared', () => {
    const session = createTestSession()
    session.setInit({ viewIds: ['view-1'] })
    session.setInit(undefined)

    expect(getSnapshot(session)).not.toHaveProperty('init')
  })
})

describe('getViewIdsForPanel', () => {
  // callers iterate this list while removing views, which splices the
  // underlying array — a live MST node would skip elements mid-iteration
  it('returns a copy, not the live MST array', () => {
    const session = createTestSession()
    session.assignViewToPanel('panel-1', 'view-1')

    const ids = session.getViewIdsForPanel('panel-1')
    session.removeViewFromPanel('view-1')

    expect(ids).toEqual(['view-1'])
    expect(session.getViewIdsForPanel('panel-1')).toEqual([])
  })
})

// `setPendingMove` is public API an external plugin calls behind a
// `'setPendingMove' in session` guard (jbrowse-plugin-protein3d, to put a
// protein view beside its genome view). A capability-detecting caller cannot
// report that the capability went away — it just quietly stops asking — so
// these tests are what says the entry point still exists and still means the
// same thing.
//
// `isSessionWithMultipleViews` wants a real session's id/name/root, so the
// double carries them; the bare model above would fall to the no-other-views
// branch and the split cases would pass vacuously.
const MoveSessionModel = types
  .compose(
    'MoveTestSession',
    types.model({
      id: types.identifier,
      name: types.string,
      views: types.array(types.model({ id: types.identifier })),
    }),
    DockviewLayoutMixin(),
  )
  .views(() => ({
    get root() {
      return {}
    },
  }))

function createMoveSession(viewIds: string[]) {
  return MoveSessionModel.create({
    id: 'session-1',
    name: 'test',
    views: viewIds.map(id => ({ id })),
  })
}

describe('setPendingMove', () => {
  it('splitRight puts the view beside everything else', () => {
    const session = createMoveSession(['view-1', 'view-2', 'view-3'])

    session.setPendingMove({ type: 'splitRight', viewId: 'view-3' })

    expect(session.init).toEqual({
      direction: 'horizontal',
      children: [{ viewIds: ['view-1', 'view-2'] }, { viewIds: ['view-3'] }],
    })
  })

  // 'tabs' is how the layout vocabulary says "one group, another tab" rather
  // than splitting the space
  it('newTab puts the view in its own tab', () => {
    const session = createMoveSession(['view-1', 'view-2'])

    session.setPendingMove({ type: 'newTab', viewId: 'view-2' })

    expect(session.init).toEqual({
      direction: 'tabs',
      children: [{ viewIds: ['view-1'] }, { viewIds: ['view-2'] }],
    })
  })

  it('takes the whole space when there is nothing to split from', () => {
    const session = createMoveSession(['view-1'])

    session.setPendingMove({ type: 'splitRight', viewId: 'view-1' })

    expect(session.init).toEqual({ viewIds: ['view-1'] })
  })

  it('clears the request', () => {
    const session = createMoveSession(['view-1', 'view-2'])
    session.setPendingMove({ type: 'splitRight', viewId: 'view-2' })

    session.setPendingMove(undefined)

    expect(session.init).toBeUndefined()
  })
})
