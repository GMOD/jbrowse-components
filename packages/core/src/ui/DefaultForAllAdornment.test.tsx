import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'
import { createJBrowseTheme } from './theme.ts'

import type { SessionDefaultControl } from '../configuration/promotableDefaults.ts'

const theme = createJBrowseTheme()

// test double: the pin only reads `active` and calls `toggle` on click
function fakeControl(
  active: boolean,
  toggle: () => void = () => {},
): SessionDefaultControl {
  return { active, toggle }
}

function renderAdornment(control: SessionDefaultControl, label?: string) {
  return render(
    <ThemeProvider theme={theme}>
      <DefaultForAllAdornment control={control} label={label} />
    </ThemeProvider>,
  )
}

describe('DefaultForAllAdornment', () => {
  it('renders a labeled pin button', () => {
    const { getByRole } = renderAdornment(fakeControl(false))
    expect(
      getByRole('button', { name: 'make this the default for all tracks' }),
    ).toBeTruthy()
  })

  it('names the pin after its setting so siblings are distinguishable', () => {
    const { getByRole } = renderAdornment(fakeControl(false), 'Compact')
    expect(
      getByRole('button', { name: 'make Compact the default for all tracks' }),
    ).toBeTruthy()
  })

  it('reflects the active (pinned) state as pressed', () => {
    const { getByRole } = renderAdornment(fakeControl(true))
    expect(getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking toggles its control', () => {
    const toggle = jest.fn()
    const { getByRole } = renderAdornment(fakeControl(false, toggle))
    fireEvent.click(getByRole('button'))
    expect(toggle).toHaveBeenCalledTimes(1)
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
