import { cleanup, fireEvent, render } from '@testing-library/react'

import SetRowHeightDialog from './SetRowHeightDialog.tsx'

import type { RowHeightModel } from './rowHeightMenu.ts'

afterEach(cleanup)

function makeModel(extra?: Partial<RowHeightModel>) {
  return {
    rowHeight: 0,
    setRowHeight: jest.fn(),
    setFitToHeight: jest.fn(),
    ...extra,
  } as unknown as RowHeightModel & {
    setRowHeight: jest.Mock
    setFitToHeight: jest.Mock
    setRowProportion?: jest.Mock
  }
}

function open(model: RowHeightModel) {
  return render(<SetRowHeightDialog model={model} handleClose={() => {}} />)
}

function submit(getByText: (text: string) => HTMLElement) {
  fireEvent.click(getByText('Submit'))
}

// The trap this dialog exists to close once: in fit mode the resolved
// `effectiveRowHeight` is the computed fractional height, so a dialog seeded
// from it pins that number the moment the user presses submit without touching
// anything. The type has no such member, and the field shows the raw sentinel.
test('seeds from the raw rowHeight, so fit mode shows the 0 sentinel', () => {
  // baseElement, not container: the dialog renders into a portal
  const { baseElement } = open(makeModel({ rowHeight: 0 }))
  expect(baseElement.querySelector('input')?.value).toBe('0')
})

test('submitting 0 enters fit mode rather than pinning the sentinel', () => {
  const model = makeModel({ rowHeight: 0 })
  const { getByText } = open(model)
  submit(getByText)
  expect(model.setFitToHeight).toHaveBeenCalled()
  expect(model.setRowHeight).not.toHaveBeenCalled()
})

test('submitting a positive height pins it', () => {
  const model = makeModel({ rowHeight: 12 })
  const { getByText } = open(model)
  submit(getByText)
  expect(model.setRowHeight).toHaveBeenCalledWith(12)
  expect(model.setFitToHeight).not.toHaveBeenCalled()
})

// The per-consumer opt-out: only a display exposing both halves gets the second
// field. maf has one, multi-row features and the variant displays do not.
test('the proportion field appears only where the display has that axis', () => {
  const { baseElement: without } = open(makeModel({ rowHeight: 12 }))
  expect(without.querySelectorAll('input')).toHaveLength(1)

  cleanup()

  const withProportion = makeModel({
    rowHeight: 12,
    rowProportion: 0.8,
    setRowProportion: jest.fn(),
  })
  const { baseElement, getByText } = open(withProportion)
  expect(baseElement.querySelectorAll('input')).toHaveLength(2)
  submit(getByText)
  expect(withProportion.setRowProportion).toHaveBeenCalledWith(0.8)
})
