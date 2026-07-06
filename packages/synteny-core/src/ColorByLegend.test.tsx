import { fireEvent, render } from '@testing-library/react'

import { ColorByLegend } from './ColorByLegend.tsx'
import { NO_CIGAR_OPS } from './colorLegend.ts'

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
  const { getByText, queryByText } = render(
    <ColorByLegend colorBy="default" onClose={() => {}} />,
  )
  getByText('Default')
  getByText('match')
  getByText('insertion')
  getByText('deletion')
  // the rare N (skip) op is not shown
  expect(queryByText('skip')).toBeNull()
})

test('cigarOps hides indel chips when no indel is drawn on screen', () => {
  const { getByText, queryByText } = render(
    <ColorByLegend colorBy="default" cigarOps={NO_CIGAR_OPS} onClose={() => {}} />,
  )
  getByText('match')
  expect(queryByText('insertion')).toBeNull()
  expect(queryByText('deletion')).toBeNull()
})

test('chips blend over white by the ribbon alpha to match the canvas', () => {
  const { container } = render(
    <ColorByLegend colorBy="default" alpha={0.2} onClose={() => {}} />,
  )
  // #f00 match at alpha 0.2 over white -> rgb(255,204,204) (salmon), the same
  // color the ribbon paints, not full-saturation red
  const chip = container.querySelector('span[style*="rgb(255, 204, 204)"]')
  expect(chip).toBeTruthy()
})

test('per-name modes show a note instead of a gradient', () => {
  const { container, getByText } = render(
    <ColorByLegend colorBy="query" onClose={() => {}} />,
  )
  getByText('Query name')
  getByText('Distinct color per sequence')
  expect(container.querySelector('span[style*="gradient"]')).toBeNull()
})
