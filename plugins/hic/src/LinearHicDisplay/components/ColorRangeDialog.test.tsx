import { fireEvent, render } from '@testing-library/react'

import ColorRangeDialog from './ColorRangeDialog.tsx'

function host(overrides = {}) {
  return {
    colorDomain: [0, 40] as [number, number],
    colorDomainMin: undefined as number | undefined,
    colorDomainMax: undefined as number | undefined,
    colorQuantile: 0.95,
    setColorRange: jest.fn(),
    resetColorRange: jest.fn(),
    ...overrides,
  }
}

function field(getByLabelText: (t: string) => HTMLElement, label: string) {
  return getByLabelText(label) as HTMLInputElement
}

test('Apply writes the typed ends and the percentile as a quantile', () => {
  const model = host()
  const handleClose = jest.fn()
  const { getByLabelText, getByText } = render(
    <ColorRangeDialog model={model} handleClose={handleClose} />,
  )
  expect(field(getByLabelText, 'Percentile for an empty max').value).toBe('95')
  fireEvent.change(field(getByLabelText, 'Max'), { target: { value: '500' } })
  fireEvent.change(field(getByLabelText, 'Percentile for an empty max'), {
    target: { value: '99' },
  })
  fireEvent.click(getByText('Apply'))
  expect(model.setColorRange).toHaveBeenCalledWith({
    min: undefined,
    max: 500,
    quantile: 0.99,
  })
  expect(handleClose).toHaveBeenCalled()
})

test('a max at or below the min holds Apply back', () => {
  const model = host({ colorDomainMin: 10 })
  const { getByLabelText, getByText } = render(
    <ColorRangeDialog model={model} handleClose={jest.fn()} />,
  )
  fireEvent.change(field(getByLabelText, 'Max'), { target: { value: '5' } })
  expect(getByText('Max must be greater than min')).toBeTruthy()
  expect(getByText('Apply').closest('button')!.disabled).toBe(true)
})

test('Reset to defaults resets and closes', () => {
  const model = host({ colorDomainMax: 500 })
  const handleClose = jest.fn()
  const { getByText } = render(
    <ColorRangeDialog model={model} handleClose={handleClose} />,
  )
  fireEvent.click(getByText('Reset to defaults'))
  expect(model.resetColorRange).toHaveBeenCalled()
  expect(handleClose).toHaveBeenCalled()
})
