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
