import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

// The dialog's "Restore default" button (SubmitForm's onReset) is the only way
// to clear these slots back to their config defaults, so what it touches has to
// match what the dialog is showing.
function setup(showUtrColor: boolean) {
  const setFeatureColor = jest.fn()
  const setUtrColor = jest.fn()
  const { getByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <SetColorDialog
        model={{
          featureColor: 'goldenrod',
          utrColor: '#357089',
          setFeatureColor,
          setUtrColor,
        }}
        handleClose={() => {}}
        showUtrColor={showUtrColor}
      />
    </ThemeProvider>,
  )
  fireEvent.click(getByText('Restore default'))
  return { setFeatureColor, setUtrColor }
}

describe('SetColorDialog reset', () => {
  it('clears both slots when the UTR picker is shown', () => {
    const { setFeatureColor, setUtrColor } = setup(true)
    expect(setFeatureColor).toHaveBeenCalledWith(undefined)
    expect(setUtrColor).toHaveBeenCalledWith(undefined)
  })

  // Variants opens this with showUtrColor=false (no UTRs to color). Resetting a
  // slot whose control isn't on screen silently drops a config-authored value
  // through an affordance the user can't see the effect of.
  it('leaves utrColor alone when its picker is hidden', () => {
    const { setFeatureColor, setUtrColor } = setup(false)
    expect(setFeatureColor).toHaveBeenCalledWith(undefined)
    expect(setUtrColor).not.toHaveBeenCalled()
  })
})
