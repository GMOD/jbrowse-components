import { act, fireEvent, render, screen } from '@testing-library/react'

import { useResizeDrag } from './useResizeDrag.ts'

import type { ResizeDragCallback } from './useResizeDrag.ts'

let frames: FrameRequestCallback[] = []
const realRaf = window.requestAnimationFrame

beforeEach(() => {
  frames = []
  window.requestAnimationFrame = cb => frames.push(cb)
})

afterEach(() => {
  window.requestAnimationFrame = realRaf
})

function Handle({ gain, ...callback }: ResizeDragCallback & { gain?: number }) {
  const props = useResizeDrag({ ...callback, gain })
  return <div data-testid="handle" {...props} />
}

function moveTo(clientY: number) {
  fireEvent.pointerMove(screen.getByTestId('handle'), {
    clientY,
    pointerId: 1,
  })
  const pending = frames
  frames = []
  act(() => {
    for (const cb of pending) {
      cb(0)
    }
  })
}

function press() {
  fireEvent.pointerDown(screen.getByTestId('handle'), {
    clientY: 0,
    pointerId: 1,
  })
}

// a 50px band floored at 10, as a band setter clamps it
function clampedBand() {
  const band = { height: 50 }
  const setHeight = (height: number) => {
    band.height = Math.max(10, height)
  }
  return { band, setHeight }
}

function BandHandle({
  band,
  setHeight,
  gain,
  reverse,
}: ReturnType<typeof clampedBand> & { gain?: number; reverse?: boolean }) {
  return (
    <Handle
      value={band.height}
      onChange={h => {
        setHeight(h)
      }}
      gain={gain}
      reverse={reverse}
    />
  )
}

test('the edge stays under the pointer past a clamp', () => {
  const band = clampedBand()
  render(<BandHandle {...band} />)

  press()
  moveTo(-100)
  expect(band.band.height).toBe(10)
  moveTo(-60)
  expect(band.band.height).toBe(10)
  moveTo(-30)
  expect(band.band.height).toBe(20)
  moveTo(20)
  expect(band.band.height).toBe(70)
})

test('with a gain the value moves by the travel over the gain', () => {
  const band = clampedBand()
  render(<BandHandle {...band} gain={2} />)

  press()
  moveTo(-200)
  expect(band.band.height).toBe(10)
  moveTo(-100)
  expect(band.band.height).toBe(10)
  moveTo(-40)
  expect(band.band.height).toBe(30)
})

test('reversed, a drag down lowers the value', () => {
  const band = clampedBand()
  render(<BandHandle {...band} reverse />)

  press()
  moveTo(15)
  expect(band.band.height).toBe(35)
  moveTo(-15)
  expect(band.band.height).toBe(65)
})

// the deprecated form, kept for plugins: the pointer's travel since the last
// commit, whatever the consumer applied
test('onDrag reports the travel since the last commit', () => {
  const distances: number[] = []
  render(
    <Handle
      onDrag={d => {
        distances.push(d)
      }}
    />,
  )

  press()
  moveTo(-100)
  moveTo(-60)
  expect(distances).toEqual([-100, 40])
})
