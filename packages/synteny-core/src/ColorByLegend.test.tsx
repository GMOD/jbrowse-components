import { fireEvent, render } from '@testing-library/react'

import { ColorByLegend } from './ColorByLegend.tsx'

test('shows the mode title and gradient, and fires onClose', () => {
  const onClose = jest.fn()
  const { container, getByText, getByRole } = render(
    <ColorByLegend colorBy="identity" onClose={onClose} />,
  )
  getByText('Identity')
  getByText('0%')
  getByText('100%')
  expect(container.querySelector('span[style*="linear-gradient"]')).toBeTruthy()
  fireEvent.click(getByRole('button'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('default mode lists CIGAR-op chips with labels', () => {
  const { getByText } = render(
    <ColorByLegend colorBy="default" onClose={() => {}} />,
  )
  getByText('Default')
  getByText('match')
  getByText('insertion')
  getByText('deletion')
  getByText('skip')
})

test('per-name modes show a note instead of a gradient', () => {
  const { container, getByText } = render(
    <ColorByLegend colorBy="query" onClose={() => {}} />,
  )
  getByText('Query name')
  getByText('Distinct color per sequence')
  expect(container.querySelector('span[style*="gradient"]')).toBeNull()
})
