import { fireEvent, render, screen } from '@testing-library/react'

import SetScoreRulesDialog from './SetScoreRulesDialog.tsx'

import type { ValueScaleRule } from '@jbrowse/display-ui'

function open(rules: ValueScaleRule[]) {
  const setScoreRules = jest.fn()
  render(
    <SetScoreRulesDialog
      model={{ scoreRules: rules, setScoreRules }}
      handleClose={jest.fn()}
    />,
  )
  return setScoreRules
}

const submit = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Submit' })
const fieldAt = (label: string, index: number) =>
  screen.getAllByLabelText(label)[index]!

test('a line added in the dialog is written with only the parts it names', () => {
  const setScoreRules = open([{ value: 5, color: 'red', label: 'suggestive' }])
  fireEvent.click(screen.getByRole('button', { name: 'Add line' }))
  fireEvent.change(fieldAt('Value', 1), { target: { value: '7.3' } })
  fireEvent.click(submit())
  expect(setScoreRules).toHaveBeenCalledWith([
    { value: 5, color: 'red', label: 'suggestive' },
    { value: 7.3 },
  ])
})

test('the dialog refuses a value that is not a number and a colour no browser knows', () => {
  open([{ value: 5 }])
  fireEvent.change(fieldAt('Value', 0), { target: { value: 'five' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(fieldAt('Value', 0), { target: { value: '5' } })
  expect(submit().disabled).toBe(false)
  fireEvent.change(fieldAt('Color', 0), { target: { value: 'reddish' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(fieldAt('Color', 0), { target: { value: '#ff0000' } })
  expect(submit().disabled).toBe(false)
})

test('removing every row removes every line', () => {
  const setScoreRules = open([{ value: 5 }, { value: 8 }])
  fireEvent.click(screen.getAllByRole('button', { name: 'remove line' })[1]!)
  fireEvent.click(screen.getAllByRole('button', { name: 'remove line' })[0]!)
  fireEvent.click(submit())
  expect(setScoreRules).toHaveBeenCalledWith([])
})
