import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

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

  it('leaves utrColor alone when its picker is hidden', () => {
    const { setFeatureColor, setUtrColor } = setup(false)
    expect(setFeatureColor).toHaveBeenCalledWith(undefined)
    expect(setUtrColor).not.toHaveBeenCalled()
  })
})
