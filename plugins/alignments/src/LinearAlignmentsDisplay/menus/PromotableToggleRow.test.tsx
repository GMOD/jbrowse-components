import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { PromotableToggleRow } from './PromotableToggleRow.tsx'

const theme = createJBrowseTheme()

function renderRow(props: Partial<Parameters<typeof PromotableToggleRow>[0]>) {
  const onToggle = jest.fn()
  const onToggleDefault = jest.fn()
  const utils = render(
    <ThemeProvider theme={theme}>
      <PromotableToggleRow
        label="View as pairs"
        checked={false}
        onToggle={onToggle}
        isDefault={false}
        onToggleDefault={onToggleDefault}
        showDefault={false}
        {...props}
      />
    </ThemeProvider>,
  )
  return { ...utils, onToggle, onToggleDefault }
}

describe('PromotableToggleRow', () => {
  it('clicking the row toggles the value', () => {
    const { getByRole, onToggle, onToggleDefault } = renderRow({})
    fireEvent.click(getByRole('menuitemcheckbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggleDefault).not.toHaveBeenCalled()
  })

  it('hides the default-for-all control when showDefault is false', () => {
    const { queryByText } = renderRow({ checked: true, showDefault: false })
    expect(queryByText('default for all')).toBeNull()
  })

  it('shows the default-for-all control when showDefault is true', () => {
    const { getByText } = renderRow({ checked: true, showDefault: true })
    expect(getByText('default for all')).toBeTruthy()
  })

  it('clicking default-for-all promotes without toggling the value', () => {
    const { getByRole, onToggle, onToggleDefault } = renderRow({
      checked: true,
      showDefault: true,
    })
    fireEvent.click(getByRole('checkbox'))
    expect(onToggleDefault).toHaveBeenCalledTimes(1)
    // stopPropagation keeps the row's value toggle from firing too
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('reflects the checked state via aria-checked', () => {
    const { getByRole } = renderRow({ checked: true })
    expect(getByRole('menuitemcheckbox').getAttribute('aria-checked')).toBe(
      'true',
    )
  })
})
