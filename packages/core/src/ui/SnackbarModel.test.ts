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
