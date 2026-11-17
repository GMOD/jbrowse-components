import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { act, fireEvent, render, screen } from '@testing-library/react'

import { ScoreScaleMixin } from '../ScoreScaleMixin.ts'
import { yEncodingSchema } from '../yEncodingConfigSchema.ts'
import { yFieldChannelSchema } from '../yFieldChannelConfigSchema.ts'
import ScoreAxisWidget from './ScoreAxisWidget.tsx'

import type { YScalePaths } from '../yScalePaths.ts'
import type { ScoreAxisWidgetModel } from './stateModel.ts'
import type { ValueScale } from '@jbrowse/display-ui'

let mockBase: Record<string, unknown> = {}
jest.mock('@jbrowse/core/util/baseDisplayConfig', () => ({
  baseDisplayConfig: () => mockBase,
}))

const Y = ['encoding', 'y'] as const
const PATHS = {
  members: {
    type: [...Y, 'scale', 'type'],
    zero: [...Y, 'scale', 'zero'],
    domainMin: [...Y, 'scale', 'domainMin'],
    domainMax: [...Y, 'scale', 'domainMax'],
    fence: [...Y, 'scale', 'fenceQuantile'],
    constant: [...Y, 'scale', 'constant'],
    share: [...Y, 'scale', 'share'],
    title: [...Y, 'axis', 'title'],
    show: [...Y, 'axis', 'show'],
    grid: [...Y, 'axis', 'grid'],
    rules: [...Y, 'rules'],
  },
  reset: [
    [...Y, 'scale'],
    [...Y, 'axis'],
    [...Y, 'rules'],
  ],
} as const satisfies YScalePaths

const configSchema = ConfigurationSchema('TestAxisDisplay', {
  encoding: yEncodingSchema(yFieldChannelSchema({ fenceQuantile: 0.99 })),
})

const Display = types
  .compose(
    'TestAxisDisplay',
    ScoreScaleMixin(PATHS),
    types.model({ id: 'd1', configuration: configSchema }),
  )
  .views(() => ({
    get valueScales(): ValueScale[] {
      return [{ domain: [0, 300], scaleType: 'linear', height: 100 }]
    },
    get autoscaleRange(): [number, number] {
      return [122.4, 285.17]
    },
    get valuesInView(): [number, number] {
      return [20, 285.17]
    },
  }))

// The axis setters reach the track that holds the display, as the real one
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
  const { display } = Track.create({
    display: { configuration: {}, ...displaySnapshot },
  })
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
  expect(display.fenceQuantile).toBe(1)

  fireEvent.click(box('Grid lines'))
  expect(display.grid).toBe(true)
  expect(persists).toBe(5)
})

test('a setter called off the panel, as a menu or an agent does, saves too', () => {
  const { display } = open()
  display.setDomainMin(3)
  display.setAutoscaleGroup('g1')
  expect(persists).toBe(2)
})

test('Reset to defaults puts every scale member back, keeps the field, and saves', () => {
  const { display } = open({
    configuration: { encoding: { y: { field: 'maxScore' } } },
  })
  display.setDomainMin(3)
  display.setScaleType('log')
  display.setGrid(true)
  display.setScoreRules([5])
  persists = 0
  fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
  expect(display.domainMin).toBeUndefined()
  expect(display.scaleType).toBe('linear')
  expect(display.grid).toBe(false)
  expect(display.scoreRules).toEqual([])
  expect(display.fenceQuantile).toBe(0.99)
  expect(display.configuration.encoding.y.field).toBe('maxScore')
  expect(persists).toBe(1)
})

test('Reset to defaults returns to the base config, not past it', () => {
  mockBase = { encoding: { y: { scale: { domainMax: 9 } } } }
  const { display } = open()
  display.setDomainMin(3)
  display.setDomainMax(50)
  fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
  expect(display.domainMin).toBeUndefined()
  expect(display.domainMax).toBe(9)
  mockBase = {}
})

test('an empty end shows where the axis resolved it', () => {
  open({ configuration: { encoding: { y: { scale: { domainMin: 5 } } } } })
  expect(field('Min').placeholder).toBe('auto (5)')
  expect(field('Max').placeholder).toBe('auto (300)')
})

// Typing 190 would redraw at 1 and 19 on the way.
test('a typed min writes once the typing pauses, and on blur', () => {
  jest.useFakeTimers()
  const { display } = open()
  fireEvent.change(field('Min'), { target: { value: '1' } })
  fireEvent.change(field('Min'), { target: { value: '19' } })
  fireEvent.change(field('Min'), { target: { value: '190' } })
  expect(display.domainMin).toBeUndefined()
  act(() => {
    jest.advanceTimersByTime(300)
  })
  expect(display.domainMin).toBe(190)
  expect(persists).toBe(1)

  fireEvent.change(field('Max'), { target: { value: '300' } })
  fireEvent.blur(field('Max'))
  expect(display.domainMax).toBe(300)
})

test('text that is not a number is held back rather than read as auto', () => {
  jest.useFakeTimers()
  const { display } = open({
    configuration: { encoding: { y: { scale: { domainMin: 5 } } } },
  })
  fireEvent.change(field('Min'), { target: { value: 'abc' } })
  act(() => {
    jest.advanceTimersByTime(300)
  })
  expect(display.domainMin).toBe(5)
  screen.getByText(/Enter a number/)
})

const offered = (name: string) =>
  screen.queryByRole('checkbox', { name }) !== null

test('with both ends set, 0 and clipping leave the panel', () => {
  open({
    configuration: {
      encoding: { y: { scale: { domainMin: 0, domainMax: 10 } } },
    },
  })
  expect(offered('Include 0')).toBe(false)
  expect(offered('Clip extreme outliers')).toBe(false)
  expect(offered('Grid lines')).toBe(true)
})

test('a log axis has no 0 to include', () => {
  open({ configuration: { encoding: { y: { scale: { type: 'log' } } } } })
  expect(offered('Include 0')).toBe(false)
  expect(offered('Clip extreme outliers')).toBe(true)
})

test('a write from off the panel shows in the field and survives its blur', () => {
  jest.useFakeTimers()
  const { display } = open()
  fireEvent.change(field('Min'), { target: { value: '190' } })
  act(() => {
    jest.advanceTimersByTime(300)
  })
  expect(display.domainMin).toBe(190)
  act(() => {
    display.setDomainMin(undefined)
  })
  expect(field('Min').value).toBe('')
  fireEvent.blur(field('Min'))
  expect(display.domainMin).toBeUndefined()
})

test('a write from off the panel survives the drawer closing', () => {
  const { display, view } = open()
  fireEvent.change(field('Max'), { target: { value: '400' } })
  fireEvent.blur(field('Max'))
  act(() => {
    display.setDomainMax(undefined)
  })
  view.unmount()
  return Promise.resolve().then(() => {
    expect(display.domainMax).toBeUndefined()
  })
})

test('Reset empties the typed fields', () => {
  const { display } = open()
  fireEvent.change(field('Min'), { target: { value: '7' } })
  fireEvent.blur(field('Min'))
  expect(display.domainMin).toBe(7)
  fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
  expect(field('Min').value).toBe('')
})

test('a reference line writes once its value reads', () => {
  const { display } = open()
  fireEvent.click(screen.getByRole('button', { name: 'Add line' }))
  expect(display.scoreRules).toEqual([])
  const value = screen.getByRole('textbox', { name: 'Value' })
  fireEvent.change(value, { target: { value: '250' } })
  expect(display.scoreRules).toEqual([])
  fireEvent.blur(value)
  expect(display.scoreRules).toEqual([{ value: 250 }])
  fireEvent.click(screen.getByRole('button', { name: 'Remove line' }))
  expect(display.scoreRules).toEqual([])
})

// One undo step per label, not per letter.
test('typing a line saves once the typing pauses', () => {
  jest.useFakeTimers()
  const { display } = open({
    configuration: { encoding: { y: { rules: [{ value: 5 }] } } },
  })
  persists = 0
  const label = screen.getByRole('textbox', { name: 'Label' })
  for (const text of ['f', 'fl', 'floor']) {
    fireEvent.change(label, { target: { value: text } })
  }
  expect(display.scoreRules).toEqual([{ value: 5 }])
  act(() => {
    jest.advanceTimersByTime(300)
  })
  expect(display.scoreRules).toEqual([{ value: 5, label: 'floor' }])
  expect(persists).toBe(1)
})

test('a line with no value yet holds back neither the others nor its own red', () => {
  const { display } = open({
    configuration: { encoding: { y: { rules: [{ value: 5, label: 'low' }] } } },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Add line' }))
  const values = screen.getAllByRole('textbox', { name: 'Value' })
  expect(values.map(v => v.getAttribute('aria-invalid'))).toEqual([
    'false',
    'false',
  ])
  const label = screen.getByDisplayValue('low')
  fireEvent.change(label, { target: { value: 'floor' } })
  fireEvent.blur(label)
  expect(display.scoreRules).toEqual([{ value: 5, label: 'floor' }])
  expect(screen.getAllByRole('textbox', { name: 'Value' })).toHaveLength(2)
})

test('the lines follow a write from off the panel', () => {
  const { display } = open({
    configuration: { encoding: { y: { rules: [{ value: 5 }] } } },
  })
  const value = screen.getByRole('textbox', { name: 'Value' })
  fireEvent.change(value, { target: { value: '6' } })
  fireEvent.blur(value)
  expect(display.scoreRules).toEqual([{ value: 6 }])
  act(() => {
    display.setScoreRules([{ value: 5 }])
  })
  expect(
    screen.getByRole<HTMLInputElement>('textbox', { name: 'Value' }).value,
  ).toBe('5')
})

test('names the loss when the track it edited is gone', () => {
  render(
    <ScoreAxisWidget
      model={{ label: 'Y axis' } as unknown as ScoreAxisWidgetModel}
    />,
  )
  screen.getByText(/no longer shown/)
})
