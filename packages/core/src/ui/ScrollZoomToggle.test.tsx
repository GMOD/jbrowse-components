import { act, fireEvent, render } from '@testing-library/react'
import { observable } from 'mobx'

import ScrollZoomToggle from './ScrollZoomToggle.tsx'

function makeModel(scrollZoom: boolean) {
  return observable({
    scrollZoom,
    setScrollZoom(flag: boolean) {
      this.scrollZoom = flag
    },
  })
}

test('the labelled form is a checkbox that flips the preference', () => {
  const model = makeModel(false)
  const { getByRole } = render(<ScrollZoomToggle model={model} />)
  const box = getByRole('checkbox', { name: 'Zoom on scroll' })
  expect((box as HTMLInputElement).checked).toBe(false)
  fireEvent.click(box)
  expect(model.scrollZoom).toBe(true)
  expect((box as HTMLInputElement).checked).toBe(true)
})

test('the icon-only form is a pressed button named by its tooltip', () => {
  const model = makeModel(true)
  const { getByRole } = render(<ScrollZoomToggle model={model} iconOnly />)
  const button = getByRole('button', { name: /mouse wheel zooms/ })
  expect(button.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(button)
  expect(model.scrollZoom).toBe(false)
})

test('a control nobody has touched draws no ring', () => {
  const { queryByTestId } = render(<ScrollZoomToggle model={makeModel(true)} />)
  expect(queryByTestId('scroll-zoom-pulse')).toBe(null)
})

test('a change made elsewhere rings the control, and each one restarts it', () => {
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
  expect(queryByTestId('scroll-zoom-pulse')).not.toBe(first)
})
