import WarningIcon from '@mui/icons-material/WarningAmber'
import { fireEvent, render, within } from '@testing-library/react'

import SettingSelect from './SettingSelect.tsx'

const OPTIONS = [
  { value: 'full', label: 'Colored indels' },
  { value: 'matches', label: 'Transparent indels' },
  { value: 'off', label: "Off - don't draw CIGAR indels", icon: WarningIcon },
] as const

function open(value: (typeof OPTIONS)[number]['value'] = 'full') {
  const onChange = jest.fn()
  const { getByRole } = render(
    <SettingSelect
      ariaLabel="CIGAR indels"
      value={value}
      options={OPTIONS}
      onChange={onChange}
    />,
  )
  fireEvent.mouseDown(getByRole('combobox'))
  return { onChange, listbox: getByRole('listbox') }
}

test('picking an option hands back the value that option carries', () => {
  const { onChange, listbox } = open()
  fireEvent.click(within(listbox).getByText('Transparent indels'))
  expect(onChange).toHaveBeenCalledWith('matches')
})

// The mode that can mislead is marked on the row, and — unlike the menu this
// replaced — the mark is in the closed control too, so a view left on 'off'
// carries its own warning without anyone opening the list.
test('an option icon renders in the list and in the closed control', () => {
  const { getByRole } = render(
    <SettingSelect
      ariaLabel="CIGAR indels"
      value="off"
      options={OPTIONS}
      onChange={() => {}}
    />,
  )
  expect(
    getByRole('combobox').querySelector('svg[data-testid="WarningAmberIcon"]'),
  ).toBeTruthy()
})
