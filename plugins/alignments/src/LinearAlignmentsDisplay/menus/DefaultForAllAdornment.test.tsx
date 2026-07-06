import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { DefaultForAllAdornment } from './DefaultForAllAdornment.tsx'

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
  it('labels itself "default for all"', () => {
    const { getByText } = renderAdornment(false)
    expect(getByText('default for all')).toBeTruthy()
  })

  it('reflects the promoted state', () => {
    const { getByRole } = renderAdornment(true)
    expect((getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('toggling calls onToggleDefault', () => {
    const { getByRole, onToggleDefault } = renderAdornment(false)
    fireEvent.click(getByRole('checkbox'))
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
    fireEvent.click(getByRole('checkbox'))
    expect(rowClick).not.toHaveBeenCalled()
  })
})
