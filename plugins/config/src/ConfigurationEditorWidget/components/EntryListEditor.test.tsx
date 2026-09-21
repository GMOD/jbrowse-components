import { fireEvent, render, within } from '@testing-library/react'

import SlotEditor from './SlotEditor.tsx'

import type { SlotFacade } from '@jbrowse/core/configuration'

function listSlot(overrides: Partial<SlotFacade>) {
  return {
    name: 'range',
    description: 'the colours, in order',
    contextVariable: [],
    defaultValue: [],
    modified: true,
    pluginManager: {},
    set: jest.fn(),
    ...overrides,
  } as unknown as SlotFacade
}

describe('a colorArray slot', () => {
  const slot = (value: string[]) => listSlot({ type: 'colorArray', value })

  test('edits each entry as a colour, writing the whole list', () => {
    const s = slot(['white', 'red'])
    const { getByDisplayValue } = render(<SlotEditor slot={s} />)
    fireEvent.change(getByDisplayValue('red'), { target: { value: 'navy' } })
    expect(s.set).toHaveBeenCalledWith(['white', 'navy'])
  })

  test('holds an entry that is not a colour as a draft, and a jexl one too', () => {
    const s = slot(['white', 'red'])
    const { getByDisplayValue, getByText } = render(<SlotEditor slot={s} />)
    const field = getByDisplayValue('red')
    fireEvent.change(field, { target: { value: 'magma' } })
    expect(getByText('"magma" is not a color')).toBeTruthy()
    fireEvent.change(field, { target: { value: "jexl:'red'" } })
    expect(s.set).not.toHaveBeenCalled()
  })

  test('deletes an entry and adds one', () => {
    const s = slot(['white', 'red'])
    const { getAllByLabelText, getByTestId } = render(<SlotEditor slot={s} />)
    fireEvent.click(getAllByLabelText('delete entry')[0]!)
    expect(s.set).toHaveBeenLastCalledWith(['red'])
    fireEvent.click(getByTestId('entryAdd-range'))
    expect(s.set).toHaveBeenLastCalledWith(['white', 'red', 'red'])
  })
})

describe('a stringEnumArray slot', () => {
  const slot = (value: string[]) =>
    listSlot({
      name: 'glyphs',
      type: 'stringEnumArray',
      choices: ['disc', 'triangle', 'diamond'],
      value,
    })

  test('picks each entry from the choices, writing the whole list', () => {
    const s = slot(['disc', 'triangle'])
    const { getAllByRole, getByRole } = render(<SlotEditor slot={s} />)
    fireEvent.mouseDown(getAllByRole('combobox')[1]!)
    fireEvent.click(
      within(getByRole('listbox')).getByRole('option', { name: 'diamond' }),
    )
    expect(s.set).toHaveBeenCalledWith(['disc', 'diamond'])
  })

  test('adds the first choice', () => {
    const s = slot(['triangle'])
    const { getByTestId } = render(<SlotEditor slot={s} />)
    fireEvent.click(getByTestId('entryAdd-glyphs'))
    expect(s.set).toHaveBeenCalledWith(['triangle', 'disc'])
  })
})
