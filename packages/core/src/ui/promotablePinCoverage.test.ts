import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import {
  misKindedPins,
  pinnedSlots,
  promotableSlotsWithoutPin,
} from './promotablePinCoverage.ts'

import type { Pin } from '../configuration/promotablePin.ts'
import type { ResolvableDisplay } from '../configuration/promotableResolve.ts'
import type { MenuItem } from './MenuTypes.ts'

function pin(slot: string): Pin {
  return {
    kind: 'toggle',
    slot,
    onValue: true,
    active: false,
    toggle: () => {},
  }
}

function pinnedRow(label: string, slot: string): MenuItem {
  return {
    label,
    type: 'checkbox',
    checked: false,
    onClick: () => {},
    pin: { control: pin(slot), label },
  }
}

const schema = ConfigurationSchema('PinCoverageTest', {
  chevrons: {
    type: 'maybeBoolean',
    defaultValue: undefined,
    promotedBase: true,
  },
  softClip: {
    type: 'maybeBoolean',
    defaultValue: undefined,
    promotedBase: false,
  },
  height: { type: 'number', defaultValue: 10 },
})

// Only the two members the cascade reads; nothing here needs a live state tree.
const display = {
  type: 'PinCoverageTest',
  configuration: schema.create(),
} as unknown as ResolvableDisplay

test('collects pins from the top level', () => {
  expect([...pinnedSlots([pinnedRow('Chevrons', 'chevrons')])]).toEqual([
    'chevrons',
  ])
})

// Every real menu buries its rows: "Show..." holds the toggles, "Read height"
// holds the presets, "Arc placement" is a submenu of a submenu.
test('descends into submenus, however deep', () => {
  const items: MenuItem[] = [
    {
      label: 'Show...',
      subMenu: [
        pinnedRow('Chevrons', 'chevrons'),
        {
          label: 'Advanced',
          subMenu: [pinnedRow('Soft clipping', 'softClip')],
        },
      ],
    },
  ]
  expect([...pinnedSlots(items)].sort()).toEqual(['chevrons', 'softClip'])
})

// Two rows of one radio group promote different *values* of the same slot; the
// question here is which slots are reachable, not how many rows reach them.
test('one slot pinned from several rows counts once', () => {
  const items = [
    pinnedRow('Normal', 'chevrons'),
    pinnedRow('Compact', 'chevrons'),
  ]
  expect([...pinnedSlots(items)]).toEqual(['chevrons'])
})

test('a menu with no pins yields nothing', () => {
  const items: MenuItem[] = [
    { label: 'Plain', onClick: () => {} },
    { type: 'divider' },
  ]
  expect(pinnedSlots(items).size).toBe(0)
})

test('reports the promotable slots the menu never offers', () => {
  expect(
    promotableSlotsWithoutPin(display, [pinnedRow('Chevrons', 'chevrons')]),
  ).toEqual(['softClip'])
})

test('a fully pinned menu reports nothing, and plain slots never count', () => {
  expect(
    promotableSlotsWithoutPin(display, [
      pinnedRow('Chevrons', 'chevrons'),
      pinnedRow('Soft clipping', 'softClip'),
    ]),
  ).toEqual([])
})

describe('misKindedPins', () => {
  const toggle: Pin = {
    kind: 'toggle',
    slot: 'x',
    onValue: true,
    active: false,
    toggle: () => {},
  }
  const value: Pin = { ...toggle, kind: 'value', onValue: 'a' }

  test('a checkbox row wants a toggle pin and a radio row a value pin', () => {
    expect(
      misKindedPins([
        {
          label: 'Show x',
          type: 'checkbox',
          checked: false,
          onClick: () => {},
          pin: { control: toggle, label: 'Show x' },
        },
        {
          label: 'Mode',
          subMenu: [
            {
              label: 'A',
              type: 'radio',
              checked: true,
              onClick: () => {},
              pin: { control: value, label: 'A' },
            },
          ],
        },
      ]),
    ).toEqual([])
  })

  test('names the rows whose pin is the other kind, submenus included', () => {
    expect(
      misKindedPins([
        {
          label: 'Show x',
          type: 'checkbox',
          checked: false,
          onClick: () => {},
          pin: { control: value, label: 'Show x' },
        },
        {
          label: 'Mode',
          subMenu: [
            {
              label: 'A',
              type: 'radio',
              checked: true,
              onClick: () => {},
              pin: { control: toggle, label: 'A' },
            },
          ],
        },
      ]),
    ).toEqual([
      'Show x: value pin on a checkbox row',
      'A: toggle pin on a radio row',
    ])
  })
})
