import {
  openConnectionMenuItem,
  openTrackMenuItem,
  preferencesMenuItem,
  redoMenuItem,
  undoMenuItem,
  workspacesMenuItem,
} from './menuItems.ts'

import type { SessionWithMultipleViews } from '../Session/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem, NormalMenuItem } from '@jbrowse/core/ui'

// the renderer binds the active session into onClick, so the tests call the
// handler the same way (a stub session standing in for the real model)
function clickOf(item: MenuItem) {
  return (item as NormalMenuItem).onClick
}

describe('openTrackMenuItem', () => {
  it('warns instead of adding a widget when there are no views', () => {
    const notify = jest.fn()
    const addWidget = jest.fn()
    clickOf(openTrackMenuItem())({ views: [], notify, addWidget })
    expect(notify).toHaveBeenCalledWith(
      'Please open a view to add a track first',
    )
    expect(addWidget).not.toHaveBeenCalled()
  })

  it('adds + shows a track widget for the first view', () => {
    const widget = { id: 'w' }
    const addWidget = jest.fn().mockReturnValue(widget)
    const showWidget = jest.fn()
    const notify = jest.fn()
    clickOf(openTrackMenuItem())({
      views: [{ id: 'view1' }],
      addWidget,
      showWidget,
      notify,
    })
    expect(addWidget).toHaveBeenCalledWith('AddTrackWidget', 'addTrackWidget', {
      view: 'view1',
    })
    expect(showWidget).toHaveBeenCalledWith(widget)
    expect(notify).not.toHaveBeenCalled()
  })

  it('notifies about multi-view ambiguity when more than one view is open', () => {
    const notify = jest.fn()
    clickOf(openTrackMenuItem())({
      views: [{ id: 'view1' }, { id: 'view2' }],
      addWidget: jest.fn().mockReturnValue({}),
      showWidget: jest.fn(),
      notify,
    })
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toContain('first view')
  })
})

describe('openConnectionMenuItem', () => {
  it('adds + shows the connection widget', () => {
    const widget = { id: 'c' }
    const addWidget = jest.fn().mockReturnValue(widget)
    const showWidget = jest.fn()
    clickOf(openConnectionMenuItem())({ addWidget, showWidget })
    expect(addWidget).toHaveBeenCalledWith(
      'AddConnectionWidget',
      'addConnectionWidget',
    )
    expect(showWidget).toHaveBeenCalledWith(widget)
  })
})

describe('preferencesMenuItem', () => {
  it('queues the supplied dialog with the session + pluginManager', () => {
    const Dialog = () => null
    const pluginManager = { id: 'pm' } as unknown as PluginManager
    const queueDialog = jest.fn()
    const item = preferencesMenuItem(pluginManager, Dialog)
    const session = { queueDialog }
    clickOf(item)(session)
    const [[cb]] = queueDialog.mock.calls
    const handleClose = jest.fn()
    expect(cb(handleClose)).toEqual([
      Dialog,
      { session, pluginManager, handleClose },
    ])
  })
})

describe('undoMenuItem / redoMenuItem', () => {
  it('undoes only when history can undo', () => {
    const undo = jest.fn()
    const history = { canUndo: true, canRedo: false, undo, redo: jest.fn() }
    clickOf(undoMenuItem(history))()
    expect(undo).toHaveBeenCalledTimes(1)

    history.canUndo = false
    clickOf(undoMenuItem(history))()
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('redoes only when history can redo', () => {
    const redo = jest.fn()
    const history = { canUndo: false, canRedo: true, undo: jest.fn(), redo }
    clickOf(redoMenuItem(history))()
    expect(redo).toHaveBeenCalledTimes(1)

    history.canRedo = false
    clickOf(redoMenuItem(history))()
    expect(redo).toHaveBeenCalledTimes(1)
  })
})

describe('workspacesMenuItem', () => {
  it('reflects current state and toggles on click', () => {
    const setUseWorkspaces = jest.fn()
    const item = workspacesMenuItem({
      effectiveUseWorkspaces: true,
      setUseWorkspaces,
    } as unknown as SessionWithMultipleViews)
    expect('checked' in item && item.checked).toBe(true)
    clickOf(item)()
    expect(setUseWorkspaces).toHaveBeenCalledWith(false)
  })

  it('defaults checked to false when no session', () => {
    const item = workspacesMenuItem(undefined)
    expect('checked' in item && item.checked).toBe(false)
  })
})
