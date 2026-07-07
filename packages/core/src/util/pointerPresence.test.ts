import { trackPointerPresence } from './pointerPresence.ts'

function fireMouse(el: HTMLElement, type: 'mouseenter' | 'mouseleave') {
  el.dispatchEvent(new MouseEvent(type, { bubbles: false }))
}

test('defaults to over so a scroll before any mouseenter still counts', () => {
  const el = document.createElement('div')
  const presence = trackPointerPresence(el)
  expect(presence.isOver).toBe(true)
  presence.dispose()
})

test('mouseleave flips it off, mouseenter flips it back', () => {
  const el = document.createElement('div')
  const presence = trackPointerPresence(el)
  fireMouse(el, 'mouseleave')
  expect(presence.isOver).toBe(false)
  fireMouse(el, 'mouseenter')
  expect(presence.isOver).toBe(true)
  presence.dispose()
})

test('onLeave fires only on leave', () => {
  const el = document.createElement('div')
  const onLeave = jest.fn()
  const presence = trackPointerPresence(el, onLeave)
  fireMouse(el, 'mouseenter')
  expect(onLeave).not.toHaveBeenCalled()
  fireMouse(el, 'mouseleave')
  expect(onLeave).toHaveBeenCalledTimes(1)
  presence.dispose()
})

test('dispose detaches listeners so later events are ignored', () => {
  const el = document.createElement('div')
  const onLeave = jest.fn()
  const presence = trackPointerPresence(el, onLeave)
  presence.dispose()
  fireMouse(el, 'mouseleave')
  expect(onLeave).not.toHaveBeenCalled()
  // the getter keeps its last value; no throw after dispose
  expect(presence.isOver).toBe(true)
})
