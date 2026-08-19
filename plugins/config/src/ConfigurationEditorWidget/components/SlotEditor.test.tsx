import { fireEvent, render } from '@testing-library/react'

import SlotEditor from './SlotEditor.tsx'

import type { SlotFacade } from '@jbrowse/core/configuration'

function enumSlot(overrides: Partial<SlotFacade>) {
  return {
    name: 'heightMode',
    description: 'how the track sizes its rows',
    type: 'maybeStringEnum',
    contextVariable: [],
    defaultValue: undefined,
    choices: ['fixed', 'grow', 'fit'],
    value: undefined,
    modified: false,
    pluginManager: {},
    set: jest.fn(),
    ...overrides,
  } as unknown as SlotFacade
}

// a MUI select renders its options only once opened
function openChoices(slot: SlotFacade) {
  const result = render(<SlotEditor slot={slot} />)
  fireEvent.mouseDown(result.getByRole('combobox'))
  return result
}

// Every other choice in the list is a value the user can read off the plot; the
// unset one was the only one that said nothing about what picking it draws.
test('the unset enum choice names what unset resolves to', () => {
  const { getByText } = openChoices(enumSlot({ promotedBase: 'fixed' }))
  expect(getByText('default (fixed)')).toBeTruthy()
})

test('a plain maybeStringEnum slot keeps the bare label', () => {
  const { getByText } = openChoices(enumSlot({}))
  expect(getByText('default')).toBeTruthy()
})
