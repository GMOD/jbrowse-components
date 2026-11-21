import { destroy } from '@jbrowse/mobx-state-tree'

import SnackbarModel from './SnackbarModel.tsx'

test('destroying the model cancels a pending auto-dismiss', () => {
  jest.useFakeTimers()
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const model = SnackbarModel().create()
    model.notify('saved', 'info')
    expect(jest.getTimerCount()).toBe(1)
    destroy(model)
    expect(jest.getTimerCount()).toBe(0)
    jest.runAllTimers()
    expect(warn).not.toHaveBeenCalled()
  } finally {
    warn.mockRestore()
    jest.useRealTimers()
  }
})

test('an auto-dismiss still removes its toast', () => {
  jest.useFakeTimers()
  try {
    const model = SnackbarModel().create()
    model.notify('saved', 'info')
    jest.advanceTimersByTime(5000)
    expect(model.snackbarMessages).toHaveLength(0)
  } finally {
    jest.useRealTimers()
  }
})

test('a toast dismissed and notified again lasts its own five seconds', () => {
  jest.useFakeTimers()
  try {
    const model = SnackbarModel().create()
    model.notify('saved', 'info')
    jest.advanceTimersByTime(4000)
    model.removeSnackbarMessage('saved')
    model.notify('saved', 'info')
    jest.advanceTimersByTime(1000)
    expect(model.snackbarMessages).toHaveLength(1)
    jest.advanceTimersByTime(4000)
    expect(model.snackbarMessages).toHaveLength(0)
  } finally {
    jest.useRealTimers()
  }
})

test('a repeated error replaces its snackbar and reports the latest error', () => {
  const model = SnackbarModel().create()
  const second = new Error('second')
  model.notifyError('Failed to load', new Error('first'))
  model.notifyError('Failed to load', second)
  expect(model.snackbarMessages).toHaveLength(1)
  model.snackbarMessages[0]?.actions?.[0]?.onClick()
  expect(model.errorDialog?.error).toBe(second)
})

test('two same-text Undo toasts each keep their own Undo', () => {
  const model = SnackbarModel().create()
  const firstUndo = jest.fn()
  const secondUndo = jest.fn()
  model.notify('Filter added', 'info', { name: 'Undo', onClick: firstUndo })
  model.notify('Filter added', 'info', { name: 'Undo', onClick: secondUndo })
  expect(model.snackbarMessages).toHaveLength(2)
  model.snackbarMessages[0]?.actions?.[0]?.onClick()
  model.snackbarMessages[1]?.actions?.[0]?.onClick()
  expect(firstUndo).toHaveBeenCalledTimes(1)
  expect(secondUndo).toHaveBeenCalledTimes(1)
})

test('a repeated message moves to the top of the stack', () => {
  const model = SnackbarModel().create()
  model.notify('one', 'warning')
  model.notify('two', 'warning')
  model.notify('one', 'warning')
  expect(model.snackbarMessages.map(m => m.message)).toEqual(['two', 'one'])
})

test('a plain toast neither replaces nor dismisses a same-text Undo toast', () => {
  jest.useFakeTimers()
  try {
    const model = SnackbarModel().create()
    const undo = { name: 'Undo', onClick: () => {} }
    model.notify('Track removed', 'info', undo)
    model.notify('Track removed', 'info')
    model.notify('Track removed', 'info', undo)
    expect(model.snackbarMessages).toHaveLength(3)
    jest.advanceTimersByTime(5000)
    expect(model.snackbarMessages.map(m => m.actions?.length)).toEqual([1, 1])
  } finally {
    jest.useRealTimers()
  }
})
