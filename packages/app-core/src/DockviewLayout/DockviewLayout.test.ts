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

  describe('view ordering within panel', () => {
    it('moveViewUpInPanel moves view up', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')
      session.assignViewToPanel('panel-1', 'view-3')

      session.moveViewUpInPanel('view-2')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-2',
        'view-1',
        'view-3',
      ])
    })

    it('moveViewUpInPanel does nothing for first view', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')

      session.moveViewUpInPanel('view-1')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-1',
        'view-2',
      ])
    })

    it('moveViewDownInPanel moves view down', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')
      session.assignViewToPanel('panel-1', 'view-3')

      session.moveViewDownInPanel('view-2')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-1',
        'view-3',
        'view-2',
      ])
    })

    it('moveViewDownInPanel does nothing for last view', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')

      session.moveViewDownInPanel('view-2')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-1',
        'view-2',
      ])
    })

    it('moveViewToTopInPanel moves view to top', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')
      session.assignViewToPanel('panel-1', 'view-3')

      session.moveViewToTopInPanel('view-3')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-3',
        'view-1',
        'view-2',
      ])
    })

    it('moveViewToBottomInPanel moves view to bottom', () => {
      const session = createTestSession()
      session.assignViewToPanel('panel-1', 'view-1')
      session.assignViewToPanel('panel-1', 'view-2')
      session.assignViewToPanel('panel-1', 'view-3')

      session.moveViewToBottomInPanel('view-1')

      expect(session.getViewIdsForPanel('panel-1')).toEqual([
        'view-2',
        'view-3',
        'view-1',
      ])
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

  it('init is excluded from snapshot', () => {
    const session = createTestSession()
    session.setInit({
      direction: 'horizontal',
      children: [{ viewIds: ['view-1'] }, { viewIds: ['view-2'] }],
    })
    const snapshot = getSnapshot(session)

    expect(snapshot).not.toHaveProperty('init')
  })
})

describe('Move to new tab scenario', () => {
  it('correctly sets up two panels when moving a view to new tab', () => {
    const session = createTestSession()

    // Simulate: 3 views exist, user clicks "Move to new tab" on view-3
    const allViewIds = ['view-1', 'view-2', 'view-3']
    const pendingViewId = 'view-3'
    const otherViewIds = allViewIds.filter(id => id !== pendingViewId)

    // Create first panel for other views
    const firstPanelId = 'panel-1'
    for (const viewId of otherViewIds) {
      session.assignViewToPanel(firstPanelId, viewId)
    }

    // Create second panel for the pending view
    const secondPanelId = 'panel-2'
    session.assignViewToPanel(secondPanelId, pendingViewId)
    session.setActivePanelId(secondPanelId)

    // Verify structure
    expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-1', 'view-2'])
    expect(session.getViewIdsForPanel('panel-2')).toEqual(['view-3'])
    expect(session.activePanelId).toBe('panel-2')
    expect(session.panelViewAssignments.size).toBe(2)
  })

  it('correctly moves a view from one panel to another', () => {
    const session = createTestSession()

    // Initial state: all views in one panel
    session.assignViewToPanel('panel-1', 'view-1')
    session.assignViewToPanel('panel-1', 'view-2')
    session.assignViewToPanel('panel-1', 'view-3')

    // Move view-3 to new panel
    session.removeViewFromPanel('view-3')
    session.assignViewToPanel('panel-2', 'view-3')

    // Verify structure
    expect(session.getViewIdsForPanel('panel-1')).toEqual(['view-1', 'view-2'])
    expect(session.getViewIdsForPanel('panel-2')).toEqual(['view-3'])
  })

  it('handles moving the only view to new tab (first panel becomes empty)', () => {
    const session = createTestSession()

    // Only 1 view exists, user clicks "Move to new tab"
    const pendingViewId = 'view-1'

    // Second panel gets the only view
    const secondPanelId = 'panel-2'
    session.assignViewToPanel(secondPanelId, pendingViewId)
    session.setActivePanelId(secondPanelId)

    // Verify structure - first panel doesn't exist (no views)
    expect(session.getViewIdsForPanel('panel-1')).toEqual([])
    expect(session.getViewIdsForPanel('panel-2')).toEqual(['view-1'])
    expect(session.panelViewAssignments.size).toBe(1)
  })

  it('handles clearing all panel assignments', () => {
    const session = createTestSession()

    // Set up some panels
    session.assignViewToPanel('panel-1', 'view-1')
    session.assignViewToPanel('panel-1', 'view-2')
    session.assignViewToPanel('panel-2', 'view-3')
    session.setDockviewLayout({ grid: {} } as any)

    // Clear all panels (simulates what happens on remount)
    for (const panelId of session.panelViewAssignments.keys()) {
      session.removePanel(panelId)
    }
    session.setDockviewLayout(undefined)

    // Verify everything is cleared
    expect(session.panelViewAssignments.size).toBe(0)
    expect(session.dockviewLayout).toBeUndefined()
  })
})
