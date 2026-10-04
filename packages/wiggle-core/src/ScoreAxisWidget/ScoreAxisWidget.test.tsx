import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { ScoreScaleMixin } from '../ScoreScaleMixin.ts'
import { scalesSchema, valueScaleSchema } from '../valueScaleConfigSchema.ts'
import ScoreAxisWidget from './ScoreAxisWidget.tsx'

import type { ScoreAxisWidgetModel } from './stateModel.ts'
import type { ValueScale } from '@jbrowse/display-ui'

const configSchema = ConfigurationSchema('TestAxisDisplay', {
  scales: scalesSchema(valueScaleSchema({ domainQuantile: 0.99 })),
})

const Display = types
  .compose(
    'TestAxisDisplay',
    ScoreScaleMixin(),
    types.model({ id: 'd1', configuration: configSchema }),
  )
  .views(() => ({
    get valueScales(): ValueScale[] {
      return [{ domain: [0, 300], scaleType: 'linear', height: 100 }]
    },
    get autoscaleRange(): [number, number] {
      return [27.55, 285.17]
    },
  }))

// `writeThrough` reaches the track that holds the display, as the real one
// does, so the persists are counted here.
let persists = 0
const Track = types
  .model('TestTrack', {
    configuration: types.frozen({ trackId: 't1', name: 'Track one' }),
    display: Display,
  })
  .actions(() => ({
    persistConfigurationNow() {
      persists++
    },
  }))

function open(displaySnapshot: Record<string, unknown> = {}) {
  persists = 0
  const track = Track.create({
    display: { configuration: {}, ...displaySnapshot },
  })
  const { display } = track
  const model = { display, label: 'Y axis' } as unknown as ScoreAxisWidgetModel
  const view = render(<ScoreAxisWidget model={model} />)
  return { display, view }
}

const box = (name: string) =>
  screen.getByRole<HTMLInputElement>('checkbox', { name })
const field = (name: string) =>
  screen.getByRole<HTMLInputElement>('textbox', { name })

afterEach(() => {
  jest.useRealTimers()
})

test('each control writes the scale at once and saves it to the session', () => {
  const { display } = open()
  fireEvent.click(screen.getByRole('radio', { name: 'Log' }))
  expect(display.scaleType).toBe('log')
  fireEvent.click(screen.getByRole('radio', { name: 'Linear' }))

  expect(box('Include 0').checked).toBe(true)
  fireEvent.click(box('Include 0'))
  expect(display.scaleZero).toBe(false)

  expect(box('Clip extreme outliers').checked).toBe(true)
  fireEvent.click(box('Clip extreme outliers'))
  expect(display.domainQuantile).toBe(1)

  fireEvent.click(box('Grid lines'))
  expect(display.grid).toBe(true)
  expect(persists).toBe(5)
})

test('shows the values in view the axis is drawn from', () => {
  open()
  screen.getByText('Values in view: 27.55 – 285.2')
})

// Typing 190 would redraw at 1 and 19 on the way.
test('a typed min writes once the typing pauses, and on blur', () => {
  jest.useFakeTimers()
  const { display } = open()
  fireEvent.change(field('Min'), { target: { value: '1' } })
  fireEvent.change(field('Min'), { target: { value: '19' } })
  fireEvent.change(field('Min'), { target: { value: '190' } })
  expect(display.manualMinScore).toBeUndefined()
  act(() => {
    jest.advanceTimersByTime(300)
  })
  expect(display.manualMinScore).toBe(190)
  expect(persists).toBe(1)

  fireEvent.change(field('Max'), { target: { value: '300' } })
  fireEvent.blur(field('Max'))
  expect(display.manualMaxScore).toBe(300)
})

test('text that is not a number is held back rather than read as auto', () => {
  jest.useFakeTimers()
  const { display } = open({
    configuration: { scales: { y: { domainMin: 5 } } },
  })
  fireEvent.change(field('Min'), { target: { value: 'abc' } })
  act(() => {
    jest.advanceTimersByTime(300)
  })
  expect(display.manualMinScore).toBe(5)
  screen.getByText(/Enter a number/)
})

test('with both ends set, 0 and clipping grey out and say why', () => {
  open({ configuration: { scales: { y: { domainMin: 0, domainMax: 10 } } } })
  expect(box('Include 0').disabled).toBe(true)
  expect(box('Clip extreme outliers').disabled).toBe(true)
  screen.getByText(/Both ends are set/)
})

test('a log axis has no 0 to include', () => {
  open({ configuration: { scales: { y: { type: 'log' } } } })
  expect(box('Include 0').disabled).toBe(true)
  screen.getByText('A log axis has no 0')
})

test('a reference line writes once its value reads', () => {
  const { display } = open()
  fireEvent.click(screen.getByRole('button', { name: 'Add line' }))
  expect(display.scoreRules).toEqual([])
  fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), {
    target: { value: '250' },
  })
  expect(display.scoreRules).toEqual([{ value: 250 }])
  fireEvent.click(screen.getByRole('button', { name: 'Remove line' }))
  expect(display.scoreRules).toEqual([])
})

test('names the loss when the track it edited is gone', () => {
  render(
    <ScoreAxisWidget
      model={{ label: 'Y axis' } as unknown as ScoreAxisWidgetModel}
    />,
  )
  screen.getByText(/no longer shown/)
})
