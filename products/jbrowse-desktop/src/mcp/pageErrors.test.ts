import { autorun, observable, runInAction } from 'mobx'

import { drainPageErrors, watchPageErrors } from './pageErrors.ts'

// The class nothing else in the envelope carries: notifications hold what
// someone chose to raise, notReady what a display recorded on itself, and these
// three reached devtools and stopped there.
beforeAll(() => {
  watchPageErrors()
})

beforeEach(() => {
  drainPageErrors()
})

function raise(type: string, init: Record<string, unknown>) {
  window.dispatchEvent(Object.assign(new Event(type), init))
}

it('carries an uncaught error', () => {
  raise('error', { error: new TypeError('x is not a function') })
  expect(drainPageErrors()).toEqual([
    { source: 'uncaught', message: 'TypeError: x is not a function' },
  ])
})

it('falls back to the message when there is no error object', () => {
  raise('error', { message: 'Script error.' })
  expect(drainPageErrors()).toEqual([
    { source: 'uncaught', message: 'Script error.' },
  ])
})

it('carries a rejection nobody awaited', () => {
  raise('unhandledrejection', { reason: new Error('fetch failed') })
  expect(drainPageErrors()).toEqual([
    { source: 'unhandledRejection', message: 'Error: fetch failed' },
  ])
})

// mobx reports a reaction's throw to onReactionError and to no caller, so a
// view that dies inside one leaves no trace an agent can reach. The
// console.error is mobx's own report of it.
it('carries a reaction throw', () => {
  const box = observable.box(0)
  const dispose = autorun(() => {
    if (box.get() > 0) {
      throw new Error('the reaction died')
    }
  })
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  runInAction(() => {
    box.set(1)
  })
  spy.mockRestore()
  dispose()
  expect(drainPageErrors()).toEqual([
    { source: 'reaction', message: 'Error: the reaction died' },
  ])
})

it('delivers each one once', () => {
  raise('error', { error: new Error('a') })
  expect(drainPageErrors()).toHaveLength(1)
  expect(drainPageErrors()).toEqual([])
})

it('caps the buffer and says how many it dropped', () => {
  for (let i = 0; i < 25; i++) {
    raise('error', { error: new Error(`e${i}`) })
  }
  const drained = drainPageErrors()
  expect(drained).toHaveLength(21)
  expect(drained.at(-1)).toEqual({
    source: 'dropped',
    message: '5 further page error(s) dropped',
  })
})

it('clips a long message', () => {
  raise('error', { error: new Error('y'.repeat(2000)) })
  expect(drainPageErrors()[0]!.message.length).toBeLessThan(520)
})
