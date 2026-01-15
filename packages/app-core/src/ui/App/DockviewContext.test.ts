import {
  clearPendingMoveAction,
  getPendingMoveAction,
  peekPendingMoveAction,
  setPendingMoveToNewTab,
  setPendingMoveToSplitRight,
} from './DockviewContext.tsx'

describe('DockviewContext pending move actions', () => {
  beforeEach(() => {
    // Clear any pending action before each test
    clearPendingMoveAction()
  })

  describe('when no pending action exists', () => {
    it('peekPendingMoveAction returns null', () => {
      expect(peekPendingMoveAction()).toBeNull()
    })

    it('getPendingMoveAction returns null', () => {
      expect(getPendingMoveAction()).toBeNull()
    })
  })

  describe('setPendingMoveToNewTab', () => {
    it('stores the pending action', () => {
      setPendingMoveToNewTab('view-123')

      const action = peekPendingMoveAction()
      expect(action).toEqual({ type: 'newTab', viewId: 'view-123' })
    })

    it('peekPendingMoveAction does not consume the action', () => {
      setPendingMoveToNewTab('view-123')

      // Peek multiple times - should always return the same action
      expect(peekPendingMoveAction()).toEqual({
        type: 'newTab',
        viewId: 'view-123',
      })
      expect(peekPendingMoveAction()).toEqual({
        type: 'newTab',
        viewId: 'view-123',
      })
    })

    it('getPendingMoveAction consumes the action', () => {
      setPendingMoveToNewTab('view-123')

      // First call returns the action
      expect(getPendingMoveAction()).toEqual({
        type: 'newTab',
        viewId: 'view-123',
      })
      // Second call returns null (action was consumed)
      expect(getPendingMoveAction()).toBeNull()
    })

    it('clearPendingMoveAction clears the action', () => {
      setPendingMoveToNewTab('view-123')

      clearPendingMoveAction()

      expect(peekPendingMoveAction()).toBeNull()
    })
  })

  describe('setPendingMoveToSplitRight', () => {
    it('stores the pending action with splitRight type', () => {
      setPendingMoveToSplitRight('view-456')

      const action = peekPendingMoveAction()
      expect(action).toEqual({ type: 'splitRight', viewId: 'view-456' })
    })
  })

  describe('action overwriting', () => {
    it('later action overwrites earlier action', () => {
      setPendingMoveToNewTab('view-1')
      setPendingMoveToSplitRight('view-2')

      const action = peekPendingMoveAction()
      expect(action).toEqual({ type: 'splitRight', viewId: 'view-2' })
    })
  })
})
