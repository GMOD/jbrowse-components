import { cleanup, fireEvent, render } from '@testing-library/react'

import SetRowHeightDialog from './SetRowHeightDialog.tsx'

import type { RowHeightModel } from './rowHeightMenu.ts'

afterEach(cleanup)

function makeModel(extra?: Partial<RowHeightModel>) {
  return {
    rowStep: 'fit',
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

function typeHeight(baseElement: HTMLElement, value: string) {
  fireEvent.change(baseElement.querySelector('input')!, { target: { value } })
}

// The trap this dialog exists to close once: in fit mode the resolved
// `effectiveRowHeight` is the computed fractional height, so a dialog seeded
// from it pins that number the moment the user presses submit without touching
// anything. In fit mode the field starts empty and nothing submits.
test('in fit mode the field starts empty and submits nothing', () => {
  const model = makeModel()
  // baseElement, not container: the dialog renders into a portal
  const { baseElement, getByText } = open(model)
  expect(baseElement.querySelector('input')?.value).toBe('')
  submit(getByText)
  expect(model.setRowHeight).not.toHaveBeenCalled()
  expect(model.setFitToHeight).not.toHaveBeenCalled()
})

test('submitting a positive height pins it', () => {
  const model = makeModel({ rowStep: 12 })
  const { getByText } = open(model)
  submit(getByText)
  expect(model.setRowHeight).toHaveBeenCalledWith(12)
  expect(model.setFitToHeight).not.toHaveBeenCalled()
})

test.each(['0', '-5'])('a height of %s cannot be submitted', value => {
  const model = makeModel({ rowStep: 12 })
  const { baseElement, getByText } = open(model)
  typeHeight(baseElement, value)
  submit(getByText)
  expect(model.setRowHeight).not.toHaveBeenCalled()
  expect(model.setFitToHeight).not.toHaveBeenCalled()
})

// The per-consumer opt-out: only a display exposing both halves gets the second
// field. maf has one, multi-row features and the variant displays do not.
test('the proportion field appears only where the display has that axis', () => {
  const { baseElement: without } = open(makeModel({ rowStep: 12 }))
  expect(without.querySelectorAll('input')).toHaveLength(1)

  cleanup()

  const withProportion = makeModel({
    rowStep: 12,
    rowProportion: 0.8,
    setRowProportion: jest.fn(),
  })
  const { baseElement, getByText } = open(withProportion)
  expect(baseElement.querySelectorAll('input')).toHaveLength(2)
  submit(getByText)
  expect(withProportion.setRowProportion).toHaveBeenCalledWith(0.8)
})
