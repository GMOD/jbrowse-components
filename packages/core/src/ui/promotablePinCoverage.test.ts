import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import {
  pinnedSlots,
  promotableSlotsWithoutPin,
} from './promotablePinCoverage.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'
import type { ResolvableDisplay } from '../configuration/promotableResolve.ts'
import type { MenuItem } from './MenuTypes.ts'

function pin(slot: string): Pin {
  return { slot, onValue: true, active: false, toggle: () => {} }
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
