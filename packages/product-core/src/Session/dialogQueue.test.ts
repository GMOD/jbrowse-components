import PluginManager from '@jbrowse/core/PluginManager'

import { BaseSessionModel } from './BaseSession.ts'

function First() {
  return null
}
function Second() {
  return null
}

function makeSession() {
  return BaseSessionModel(new PluginManager()).create({ name: 'test' })
}

test('a dialog closing twice leaves the one queued behind it', () => {
  const session = makeSession()
  let closeFirst = () => {}
  session.queueDialog(done => {
    closeFirst = done
    return [First, {}]
  })
  session.queueDialog(() => [Second, {}])

  closeFirst()
  expect(session.DialogComponent).toBe(Second)
  closeFirst()
  expect(session.DialogComponent).toBe(Second)
})

test('a queued dialog closing before it shows leaves the active one', () => {
  const session = makeSession()
  let closeSecond = () => {}
  session.queueDialog(() => [First, {}])
  session.queueDialog(done => {
    closeSecond = done
    return [Second, {}]
  })

  closeSecond()
  expect(session.DialogComponent).toBe(First)
  expect(session.queueOfDialogs).toHaveLength(1)
})

test('dismissing the active dialog closes it the way its own close button does', () => {
  const session = makeSession()
  const settled = jest.fn()
  session.queueDialog(done => [
    First,
    {
      handleClose: () => {
        settled()
        done()
      },
    },
  ])
  session.queueDialog(() => [Second, {}])

  session.removeActiveDialog()
  expect(settled).toHaveBeenCalledTimes(1)
  expect(session.DialogComponent).toBe(Second)
})

test('dismissing a dialog that has no close handler, or whose handler leaves it queued, still removes it', () => {
  const session = makeSession()
  session.queueDialog(() => [First, {}])
  session.queueDialog(() => [Second, { handleClose: () => {} }])

  session.removeActiveDialog()
  expect(session.DialogComponent).toBe(Second)
  session.removeActiveDialog()
  expect(session.DialogComponent).toBeUndefined()
})
