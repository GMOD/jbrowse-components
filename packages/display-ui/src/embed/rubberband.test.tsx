import { fireEvent, render, screen } from '@testing-library/react'

import { useRubberband } from './rubberband.ts'

function Strip({
  onSelect,
  moveTo = () => {},
}: {
  onSelect?: (start: number, end: number) => void
  moveTo?: (start: number, end: number) => void
}) {
  const { range, props } = useRubberband(
    { width: 500, pxToBp: px => px * 10, moveTo },
    onSelect,
  )
  return (
    <div data-testid="strip" {...props}>
      {range ? `${range.left}-${range.right}` : 'idle'}
    </div>
  )
}

function drag(from: number, to: number) {
  const strip = screen.getByTestId('strip')
  strip.setPointerCapture = () => {}
  strip.releasePointerCapture = () => {}
  fireEvent.pointerDown(strip, { button: 0, pointerId: 1, clientX: from })
  fireEvent.pointerMove(strip, { pointerId: 1, clientX: to })
  const during = strip.textContent
  fireEvent.pointerUp(strip, { pointerId: 1, clientX: to })
  return during
}

test('a drag draws its range, then zooms to it on release', () => {
  const moveTo = jest.fn()
  render(<Strip moveTo={moveTo} />)
  expect(drag(300, 100)).toBe('100-300')
  expect(moveTo).toHaveBeenCalledWith(1000, 3000)
  expect(screen.getByTestId('strip').textContent).toBe('idle')
})

test('the range clamps to the view, and a click selects nothing', () => {
  const onSelect = jest.fn()
  render(<Strip onSelect={onSelect} />)
  expect(drag(450, 900)).toBe('450-500')
  expect(onSelect).toHaveBeenCalledWith(4500, 5000)
  onSelect.mockClear()
  drag(200, 202)
  expect(onSelect).not.toHaveBeenCalled()
})
