import {
  checkboxItem,
  radioItem,
  radioItems,
  toggleItem,
} from './toggleMenuItems.ts'

import type { TogglePin, ValuePin } from '../configuration/promotablePin.ts'

function togglePin(onValue: boolean): TogglePin {
  return {
    kind: 'toggle',
    slot: 'setting',
    onValue,
    active: false,
    toggle: () => {},
  }
}

function valuePin(onValue: string): ValuePin {
  return {
    kind: 'value',
    slot: 'setting',
    onValue,
    active: false,
    toggle: () => {},
  }
}

// A row describes its pin as `{ control, label }` and the label is the row's
// own, which is what the adornment's tooltip and aria-label read.
test('a checkbox row carries its toggle pin under the row label', () => {
  const pin = togglePin(true)
  expect(checkboxItem('Show legend', false, () => {}, { pin }).pin).toEqual({
    control: pin,
    label: 'Show legend',
  })
  expect(
    toggleItem('Show legend', true, () => {}, { pin: togglePin(false) }).pin
      ?.label,
  ).toBe('Show legend')
})

test('a radio row carries its value pin under the option label', () => {
  const pin = valuePin('compact')
  expect(radioItem('Compact', false, () => {}, { pin }).pin).toEqual({
    control: pin,
    label: 'Compact',
  })
})

test('a row without a pin declares none', () => {
  expect('pin' in checkboxItem('Show legend', false, () => {})).toBe(false)
  expect('pin' in radioItem('Compact', false, () => {})).toBe(false)
})

test('radioItems hands every option its own pin', () => {
  const pins = { normal: valuePin('normal'), compact: valuePin('compact') }
  const rows = radioItems(
    [
      { value: 'normal', label: 'Normal' },
      { value: 'compact', label: 'Compact' },
    ] as const,
    'normal',
    () => {},
    value => pins[value],
  )
  expect(rows.map(r => r.pin)).toEqual([
    { control: pins.normal, label: 'Normal' },
    { control: pins.compact, label: 'Compact' },
  ])
})
