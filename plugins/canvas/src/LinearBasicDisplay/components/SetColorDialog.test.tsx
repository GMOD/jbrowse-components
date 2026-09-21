import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

function renderDialog(showUtrColor: boolean, value?: string) {
  const setFeatureColor = jest.fn()
  const setUtrColor = jest.fn()
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <SetColorDialog
        model={{
          featureColor: 'goldenrod',
          utrColor: '#357089',
          colorSettings: { value },
          setFeatureColor,
          setUtrColor,
        }}
        handleClose={() => {}}
        showUtrColor={showUtrColor}
      />
    </ThemeProvider>,
  )
  return { ...utils, setFeatureColor, setUtrColor }
}

function setup(showUtrColor: boolean) {
  const utils = renderDialog(showUtrColor)
  fireEvent.click(utils.getByText('Restore default'))
  return utils
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

test('names the track expression a picked color replaces', () => {
  const expr = "jexl:get(feature,'type')=='gene'?'red':'blue'"
  expect(renderDialog(true, expr).getByText(expr)).toBeTruthy()
})

test('a constant color needs no note', () => {
  expect(renderDialog(true, 'purple').queryByText(/replaces/)).toBeNull()
})
