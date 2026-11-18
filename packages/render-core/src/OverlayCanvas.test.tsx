import { act, render } from '@testing-library/react'

import OverlayCanvas from './OverlayCanvas.tsx'

// A canvas is a REPLACED element, so it takes its INTRINSIC size wherever CSS
// leaves width/height auto — and `prepareCanvas` sets that intrinsic size to the
// DPR-scaled backing store. An overlay positioned with `inset: 0` and no CSS
// size therefore lays out at twice the band on a retina display, drawing every
// mark at twice its x with the right half off the edge, and looking plausible
// while it does it. That is not hypothetical: the synteny off-screen-mate
// overlay shipped that way, hand-rolled, until a figure of it disagreed with the
// data behind it.
test('the canvas lays out at the size asked for, not at its backing store', () => {
  const { getByTestId } = render(
    <OverlayCanvas
      data-testid="overlay"
      width={800}
      height={100}
      draw={() => {}}
    />,
  )
  const canvas = getByTestId('overlay')
  expect(canvas.style.width).toBe('800px')
  expect(canvas.style.height).toBe('100px')
})

test('and stays out of the way of the hit test underneath it', () => {
  const { getByTestId } = render(
    <OverlayCanvas
      data-testid="overlay"
      width={800}
      height={100}
      draw={() => {}}
    />,
  )
  expect(getByTestId('overlay').style.pointerEvents).toBe('none')
})

class FakeMediaQueryList extends EventTarget implements MediaQueryList {
  onchange = null

  constructor(
    readonly media: string,
    public matches: boolean,
  ) {
    super()
  }

  addListener() {}
  removeListener() {}
}

// Dragging the window onto a screen of another ratio changes no CSS size, so
// the draw has to follow the ratio itself or the store stays at the old scale.
test('redraws when the window moves to a screen of another ratio', () => {
  const original = globalThis.devicePixelRatio
  const lists: FakeMediaQueryList[] = []
  window.matchMedia = (media: string) => {
    const list = new FakeMediaQueryList(media, true)
    lists.push(list)
    return list
  }
  try {
    globalThis.devicePixelRatio = 1
    const backing: number[] = []
    const { getByTestId } = render(
      <OverlayCanvas
        data-testid="overlay"
        width={800}
        height={100}
        draw={ctx => {
          backing.push(ctx.canvas.width)
        }}
      />,
    )
    act(() => {
      globalThis.devicePixelRatio = 2
      for (const list of lists.splice(0)) {
        list.matches = false
        list.dispatchEvent(new Event('change'))
      }
    })
    expect(backing).toEqual([800, 1600])
    expect(getByTestId('overlay').style.width).toBe('800px')
  } finally {
    Reflect.deleteProperty(window, 'matchMedia')
    globalThis.devicePixelRatio = original
  }
})
