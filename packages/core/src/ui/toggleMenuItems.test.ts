import {
  checkboxItem,
  radioItem,
  radioItems,
  toggleItem,
} from './toggleMenuItems.ts'

import type { Pin } from '../configuration/promotablePin.ts'

function pin(onValue: unknown): Pin {
  return { slot: 'setting', onValue, active: false, toggle: () => {} }
}

// The pin's label is what the tooltip and aria-label read, and a checkbox
// row's label alone ("Show legend") does not say which state the pin applies.
test('a checkbox row names the pin after its checked state', () => {
  const off = pin(false)
  expect(
    checkboxItem('Show legend', false, () => {}, { pin: off }).pin,
  ).toEqual({ control: off, label: 'Show legend: off' })
  expect(
    toggleItem('Show legend', true, () => {}, { pin: pin(true) }).pin?.label,
  ).toBe('Show legend: on')
})

test('a radio row names the pin after its option', () => {
  const compact = pin('compact')
  expect(radioItem('Compact', false, () => {}, { pin: compact }).pin).toEqual({
    control: compact,
    label: 'Compact',
  })
})

// An unticked "Show read arcs" pin writes the whole shared slot, so its row
// says so rather than naming only itself.
test('pinLabel replaces the derived label', () => {
  expect(
    checkboxItem('Show read arcs', false, () => {}, {
      pin: pin('off'),
      pinLabel: 'Read connections: off',
    }).pin?.label,
  ).toBe('Read connections: off')
})

test('a row without a pin declares none', () => {
  expect('pin' in checkboxItem('Show legend', false, () => {})).toBe(false)
  expect('pin' in radioItem('Compact', false, () => {})).toBe(false)
})

test('radioItems hands every option its own pin', () => {
  const pins = { normal: pin('normal'), compact: pin('compact') }
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
