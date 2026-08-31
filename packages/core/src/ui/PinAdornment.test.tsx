import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { PinAdornment } from './PinAdornment.tsx'
import { createJBrowseTheme } from './theme.ts'

import type { Pin } from '../configuration/promotableDefaults.ts'

const theme = createJBrowseTheme()

// test double: the pin reads `active` and `onValue`, and calls `toggle` on
// click — never `slot`, which only a menu-wide pin-coverage walk reads
function fakeControl(
  active: boolean,
  toggle: () => void = () => {},
  onValue: unknown = 'compact',
): Pin {
  return { slot: 'unused', onValue, active, toggle }
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

  // A symmetric pin over a maybeBoolean slot carries whatever the row is
  // currently showing, so on an unchecked row it applies the setting OFF. The
  // value-shaped copy every other pin uses states the opposite of what the
  // click does — "apply Show legend" to turn the legend off.
  it('names the state a boolean pin applies, not just the setting', () => {
    const { getByRole } = renderAdornment(
      fakeControl(false, () => {}, false),
      'Show legend',
    )
    expect(
      getByRole('button', {
        name: 'turn Show legend off for all open tracks of this type',
      }),
    ).toBeTruthy()
  })

  it('names the state a filled boolean pin holds', () => {
    const { getByRole } = renderAdornment(
      fakeControl(true, () => {}, true),
      'Show legend',
    )
    expect(
      getByRole('button', {
        name: 'clear the default for Show legend for all tracks of this type',
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
