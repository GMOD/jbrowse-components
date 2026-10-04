import { fireEvent, render, screen } from '@testing-library/react'

import SetMinMaxDialog from './SetMinMaxDialog.tsx'

function open({
  domain,
  range,
  manualMinScore,
  manualMaxScore,
  scaleType = 'linear',
  scaleZero = true,
  offerZero = true,
}: {
  domain?: [number, number]
  range?: [number, number]
  manualMinScore?: number
  manualMaxScore?: number
  scaleType?: string
  scaleZero?: boolean
  offerZero?: boolean
} = {}) {
  const setMinScore = jest.fn()
  const setMaxScore = jest.fn()
  const setScaleZero = jest.fn()
  render(
    <SetMinMaxDialog
      model={{
        manualMinScore,
        manualMaxScore,
        scaleType,
        scaleZero,
        autoscaleRange: range,
        autoscaledDomain: domain,
        setMinScore,
        setMaxScore,
        setScaleZero,
      }}
      offerZero={offerZero}
      handleClose={jest.fn()}
    />,
  )
  return { setMinScore, setMaxScore, setScaleZero }
}

const submit = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'Submit' })
const field = (label: string) => screen.getByLabelText<HTMLInputElement>(label)
const zeroBox = () =>
  screen.getByRole<HTMLInputElement>('checkbox', { name: 'Always include 0' })

test('the current range fills both fields and submits what is drawn', () => {
  const { setMinScore, setMaxScore } = open({ domain: [-3, 47] })
  fireEvent.click(screen.getByRole('button', { name: 'Use current range' }))
  expect([field('Min').value, field('Max').value]).toEqual(['-3', '47'])
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
  expect([field('Min').value, field('Max').value]).toEqual(['', ''])
  fireEvent.click(submit())
  expect(setMinScore).toHaveBeenCalledWith(undefined)
  expect(setMaxScore).toHaveBeenCalledWith(undefined)
})

test('an edit after a fill still submits the edit', () => {
  const { setMaxScore } = open({ domain: [-3, 47] })
  fireEvent.click(screen.getByRole('button', { name: 'Use current range' }))
  fireEvent.change(field('Max'), { target: { value: '100' } })
  fireEvent.click(submit())
  expect(setMaxScore).toHaveBeenCalledWith(100)
})

// The two ranges are what say whether "Always include 0" can move anything:
// values already reaching 0 leave it nothing to do.
test('shows the values in view beside the axis drawn from them', () => {
  open({ range: [118.425, 303], domain: [0, 350] })
  screen.getByText('Values in view: 118.4 – 303')
  screen.getByText('Axis drawn now: 0 – 350')
})

test('unticking Always include 0 writes the slot on submit', () => {
  const { setScaleZero } = open()
  expect(zeroBox().checked).toBe(true)
  fireEvent.click(zeroBox())
  expect(setScaleZero).not.toHaveBeenCalled()
  fireEvent.click(submit())
  expect(setScaleZero).toHaveBeenCalledWith(false)
})

test('Always include 0 greys out with its reason where it moves nothing', () => {
  open({ manualMinScore: 2, manualMaxScore: 9 })
  expect(zeroBox().disabled).toBe(true)
  screen.getByText('Both ends are set')
})

test('a log axis has no 0 to include', () => {
  open({ scaleType: 'log' })
  expect(zeroBox().disabled).toBe(true)
  screen.getByText('A log axis has no 0')
})

// A density plot maps score to colour, so there is no axis for 0 to bottom.
test('a scale ruling no band offers no 0 and leaves the slot alone', () => {
  const { setScaleZero } = open({ offerZero: false })
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(submit())
  expect(setScaleZero).not.toHaveBeenCalled()
})
