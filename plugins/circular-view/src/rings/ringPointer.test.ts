import { RingPointer } from './ringPointer.ts'

import type { RingHostModel } from './ringHost.ts'

const root = { left: 7, top: 3 } as DOMRect

// a strip as RingStrips mounts it: the wrapper, the display's chrome, and the
// canvas the ring samples
function setup(hit = true) {
  const strip = document.createElement('div')
  const chrome = document.createElement('div')
  chrome.dataset.displayId = 'd1'
  const canvas = document.createElement('canvas')
  chrome.append(canvas)
  strip.append(chrome)
  document.body.append(strip)
  const host = {
    stripElements: new Map([['d1', strip]]),
    ringHit: () =>
      hit ? { ring: { display: { id: 'd1' } }, x: 40, y: 12 } : undefined,
  } as unknown as RingHostModel
  return { strip, chrome, canvas, pointer: new RingPointer(host) }
}

// the canvas feature display listens on its canvas and wiggle on its chrome
test('a move over a ring reaches the canvas and bubbles to the chrome', () => {
  const { strip, chrome, canvas, pointer } = setup()
  const heard: string[] = []
  canvas.addEventListener('mousemove', () => heard.push('canvas'))
  chrome.addEventListener('mousemove', () => heard.push('chrome'))

  expect(pointer.move(100, 50, 0, 0, root)).toBe(true)
  expect(heard).toEqual(['canvas', 'chrome'])
  expect(strip.style.left).toBe(`${100 - 40 - 7}px`)
  expect(strip.style.top).toBe(`${50 - 12 - 3}px`)
})

test('a right-click the display handles reports it cancelled', () => {
  const { canvas, pointer } = setup()
  expect(pointer.move(100, 50, 0, 0, root, 'contextmenu')).toBe(true)
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault()
  })
  expect(pointer.move(100, 50, 0, 0, root, 'contextmenu')).toBe(false)
})

test('off every ring nothing is dispatched', () => {
  const { canvas, pointer } = setup(false)
  const heard: string[] = []
  canvas.addEventListener('mousemove', () => heard.push('canvas'))
  expect(pointer.move(100, 50, 0, 0, root)).toBeUndefined()
  expect(heard).toEqual([])
})

test('a leave is a mouseout from the canvas bound for the strip', () => {
  const { strip, canvas, pointer } = setup()
  const related: (EventTarget | null)[] = []
  canvas.addEventListener('mouseout', event =>
    related.push(event.relatedTarget),
  )
  pointer.move(100, 50, 0, 0, root)
  pointer.leave()
  expect(related).toEqual([strip])
})
