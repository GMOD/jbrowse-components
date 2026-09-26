import { fireEvent, render, screen } from '@testing-library/react'

import SetMinMaxDialog from './SetMinMaxDialog.tsx'

function open({
  domain,
  manualMinScore,
  manualMaxScore,
  scaleType = 'linear',
}: {
  domain?: [number, number]
  manualMinScore?: number
  manualMaxScore?: number
  scaleType?: string
} = {}) {
  const setMinScore = jest.fn()
  const setMaxScore = jest.fn()
  render(
    <SetMinMaxDialog
      model={{
        manualMinScore,
        manualMaxScore,
        scaleType,
        setMinScore,
        setMaxScore,
      }}
      domain={domain}
      handleClose={jest.fn()}
    />,
  )
  return { setMinScore, setMaxScore }
}

const submit = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Submit' })
const field = (placeholder: string) =>
  screen.getByPlaceholderText<HTMLInputElement>(placeholder)

test('the current range fills both fields and submits what is drawn', () => {
  const { setMinScore, setMaxScore } = open({ domain: [-3, 47] })
  fireEvent.click(screen.getByRole('button', { name: 'Use current range' }))
  expect([
    field('Enter min score').value,
    field('Enter max score').value,
  ]).toEqual(['-3', '47'])
  fireEvent.click(submit())
  expect(setMinScore).toHaveBeenCalledWith(-3)
  expect(setMaxScore).toHaveBeenCalledWith(47)
})

test('the button waits while the drawn domain is unknown', () => {
  open()
  expect(screen.queryByRole('button', { name: 'Use current range' })).toBeNull()
})

test('clearing empties both fields and resumes autoscale', () => {
  const { setMinScore, setMaxScore } = open({
    manualMinScore: 2,
    manualMaxScore: 9,
  })
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
  expect([
    field('Enter min score').value,
    field('Enter max score').value,
  ]).toEqual(['', ''])
  fireEvent.click(submit())
  expect(setMinScore).toHaveBeenCalledWith(undefined)
  expect(setMaxScore).toHaveBeenCalledWith(undefined)
})

test('an edit after a fill still submits the edit', () => {
  const { setMaxScore } = open({ domain: [-3, 47] })
  fireEvent.click(screen.getByRole('button', { name: 'Use current range' }))
  fireEvent.change(field('Enter max score'), { target: { value: '100' } })
  fireEvent.click(submit())
  expect(setMaxScore).toHaveBeenCalledWith(100)
})
