import { redoMenuItem, undoMenuItem } from './menuItems.ts'

import type { MenuItem, NormalMenuItem } from '@jbrowse/core/ui'

function clickOf(item: MenuItem) {
  return (item as NormalMenuItem).onClick
}

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

  it('disables each row while its history is empty', () => {
    const history = {
      canUndo: false,
      canRedo: true,
      undo: jest.fn(),
      redo: jest.fn(),
    }
    expect(undoMenuItem(history)).toMatchObject({ disabled: true })
    expect(redoMenuItem(history)).toMatchObject({ disabled: false })
  })
})
