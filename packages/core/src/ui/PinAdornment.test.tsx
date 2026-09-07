import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { PinAdornment } from './PinAdornment.tsx'
import { createJBrowseTheme } from './theme.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'

const theme = createJBrowseTheme()

// test double: the pin reads `active` and calls `toggle` on click — never
// `slot`, which only a menu-wide pin-coverage walk reads, nor `onValue`, which
// the copy takes from the row's label instead
function fakeControl(active: boolean, toggle: () => void = () => {}): Pin {
  return { slot: 'unused', onValue: 'compact', active, toggle }
}

function renderAdornment(control: Pin, label = 'this') {
  return render(
    <ThemeProvider theme={theme}>
      <PinAdornment pin={{ control, label }} />
    </ThemeProvider>,
  )
}

describe('PinAdornment', () => {
  it('renders a labeled pin button', () => {
    const { getByRole } = renderAdornment(fakeControl(false))
    expect(
      getByRole('button', {
        name: 'apply this to all open tracks of this type',
      }),
    ).toBeTruthy()
  })

  it('names the pin after its setting so siblings are distinguishable', () => {
    const { getByRole } = renderAdornment(fakeControl(false), 'Compact')
    expect(
      getByRole('button', {
        name: 'apply Compact to all open tracks of this type',
      }),
    ).toBeTruthy()
  })

  // The click and the state are two different things: an outline pin applies
  // the value to the open tracks, a filled one clears the default it stands
  // for, and one label for both described whichever half was written first.
  it('names the clear, not the apply, once it is the default', () => {
    const { getByRole } = renderAdornment(fakeControl(true), 'Compact')
    expect(
      getByRole('button', {
        name: 'clear the default for Compact for all tracks of this type',
      }),
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

  // A checkbox row's builder folds the state into the label, so the same
  // value-shaped copy names what the click applies.
  it('names a checkbox state the way a radio value is named', () => {
    const { getByRole } = renderAdornment(
      fakeControl(false),
      'Show legend: off',
    )
    expect(
      getByRole('button', {
        name: 'apply Show legend: off to all open tracks of this type',
      }),
    ).toBeTruthy()
  })

  // A disabled menu row is `pointer-events: none`, so a pin inside it takes no
  // click at all — it looked live and did nothing.
  it('is disabled when its row is', () => {
    const { getByRole } = render(
      <ThemeProvider theme={theme}>
        <PinAdornment
          pin={{ control: fakeControl(false), label: 'this' }}
          disabled
        />
      </ThemeProvider>,
    )
    expect(getByRole('button').hasAttribute('disabled')).toBe(true)
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
          <PinAdornment pin={{ control: fakeControl(false), label: 'this' }} />
        </div>
      </ThemeProvider>,
    )
    fireEvent.click(getByRole('button'))
    expect(rowClick).not.toHaveBeenCalled()
  })
})
