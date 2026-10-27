import { render } from '@testing-library/react'

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

// MUI draws an empty-valued selection blank unless told to show it
test('a maybeStringEnum slot shows its unset choice as selected', () => {
  const { getByRole } = render(<SlotEditor slot={enumSlot({})} />)
  expect(getByRole('combobox').textContent).toBe('default')
})

test('a featureField holding a jexl: expression edits it as text', () => {
  const expression = "jexl:get(feature,'biotype')"
  const { getByDisplayValue, queryByRole } = render(
    <SlotEditor
      slot={
        {
          name: 'field',
          description: 'feature field',
          type: 'featureField',
          contextVariable: [],
          defaultValue: '',
          value: expression,
          modified: true,
          pluginManager: {},
          set: jest.fn(),
        } as unknown as SlotFacade
      }
    />,
  )
  expect(getByDisplayValue(expression).tagName).toBe('INPUT')
  expect(queryByRole('button', { name: /callback/i })).toBeNull()
})
