import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'
import { createJBrowseTheme } from './theme.ts'

const theme = createJBrowseTheme()

function renderAdornment(isDefault: boolean) {
  const onToggleDefault = jest.fn()
  const utils = render(
    <ThemeProvider theme={theme}>
      <DefaultForAllAdornment
        isDefault={isDefault}
        onToggleDefault={onToggleDefault}
      />
    </ThemeProvider>,
  )
  return { ...utils, onToggleDefault }
}

describe('DefaultForAllAdornment', () => {
  it('renders a labeled toggle button', () => {
    const { getByRole } = renderAdornment(false)
    expect(getByRole('button', { name: 'default for all tracks' })).toBeTruthy()
  })

  it('reflects the promoted state via aria-pressed', () => {
    const on = renderAdornment(true)
    expect(on.getByRole('button').getAttribute('aria-pressed')).toBe('true')
    on.unmount()
    const off = renderAdornment(false)
    expect(off.getByRole('button').getAttribute('aria-pressed')).toBe('false')
  })

  it('toggling calls onToggleDefault', () => {
    const { getByRole, onToggleDefault } = renderAdornment(false)
    fireEvent.click(getByRole('button'))
    expect(onToggleDefault).toHaveBeenCalledTimes(1)
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
          <DefaultForAllAdornment
            isDefault={false}
            onToggleDefault={() => {}}
          />
        </div>
      </ThemeProvider>,
    )
    fireEvent.click(getByRole('button'))
    expect(rowClick).not.toHaveBeenCalled()
  })
})
