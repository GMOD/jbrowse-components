import { act, render } from '@testing-library/react'
import { observable } from 'mobx'

import ScrollZoomToggle from './ScrollZoomToggle.tsx'

// The ring that says where the preference lives. It is the only durable answer
// to "what did I just turn on, and where do I turn it off" — every other
// surface that writes this (the prompt at the cursor, a view menu, the
// Preferences dialog) is somewhere else on the screen and then goes away.
function makeModel(scrollZoom: boolean) {
  return observable({
    scrollZoom,
    setScrollZoom(flag: boolean) {
      this.scrollZoom = flag
    },
  })
}

test('a button nobody has touched draws no ring', () => {
  const { queryByTestId } = render(<ScrollZoomToggle model={makeModel(true)} />)
  expect(queryByTestId('scroll-zoom-pulse')).toBe(null)
})

test('a change made elsewhere rings the button, and each one restarts it', () => {
  const model = makeModel(false)
  const { queryByTestId } = render(<ScrollZoomToggle model={model} />)
  act(() => {
    model.setScrollZoom(true)
  })
  const first = queryByTestId('scroll-zoom-pulse')
  expect(first).not.toBe(null)
  act(() => {
    model.setScrollZoom(false)
  })
  // a fresh element, because a class alone would not replay the animation
  expect(queryByTestId('scroll-zoom-pulse')).not.toBe(first)
})
