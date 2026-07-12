import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'
import { openPromotableDefaultDialog } from './openPromotableDefaultDialog.ts'
import { createJBrowseTheme } from './theme.ts'

import type { SessionDefaultControl } from '../configuration/promotableDefaults.ts'

jest.mock('./openPromotableDefaultDialog.ts', () => ({
  openPromotableDefaultDialog: jest.fn(),
}))

const theme = createJBrowseTheme()

// test double: the adornment reads `active` and forwards the control to the
// (mocked) dialog opener, so self/entries/toggle are never exercised here
function fakeControl(active: boolean): SessionDefaultControl {
  return {
    active,
    toggle: () => {},
    entries: [],
    self: undefined,
  } as unknown as SessionDefaultControl
}

function renderAdornment(active: boolean, label?: string) {
  return render(
    <ThemeProvider theme={theme}>
      <DefaultForAllAdornment control={fakeControl(active)} label={label} />
    </ThemeProvider>,
  )
}

describe('DefaultForAllAdornment', () => {
  beforeEach(() => {
    jest.mocked(openPromotableDefaultDialog).mockClear()
  })

  it('renders a labeled dialog-opening button', () => {
    const { getByRole } = renderAdornment(false)
    const button = getByRole('button', { name: 'manage default for this' })
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('names the control after its setting so siblings are distinguishable', () => {
    const { getByRole } = renderAdornment(false, 'Compact')
    expect(
      getByRole('button', { name: 'manage default for Compact' }),
    ).toBeTruthy()
  })

  it('clicking opens the manage-default dialog for its control', () => {
    const control = fakeControl(false)
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <DefaultForAllAdornment control={control} label="Compact" />
      </ThemeProvider>,
    )
    fireEvent.click(getByRole('button'))
    expect(openPromotableDefaultDialog).toHaveBeenCalledWith(control, 'Compact')
  })

  it('stops click propagation so the row value is not toggled', () => {
    const rowClick = jest.fn()
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <div
          onClick={() => {
            rowClick()
          }}
        >
          <DefaultForAllAdornment control={fakeControl(false)} />
        </div>
      </ThemeProvider>,
    )
    fireEvent.click(getByRole('button'))
    expect(rowClick).not.toHaveBeenCalled()
  })
})
