import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import SetColorDialog from './SetColorDialog.tsx'

// `withUtr` stands for a display with a `utrColor` slot, the feature display;
// the variant display has none.
function renderDialog(withUtr: boolean, value?: string) {
  const setColorValue = jest.fn()
  const setUtrColor = jest.fn()
  const utils = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <SetColorDialog
        model={{
          featureColor: 'goldenrod',
          colorSetting: { value },
          setColorValue,
          ...(withUtr ? { utrColor: '#357089', setUtrColor } : {}),
        }}
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
  return { ...utils, setColorValue, setUtrColor }
}

function setup(withUtr: boolean) {
  const utils = renderDialog(withUtr)
  fireEvent.click(utils.getByText('Restore default'))
  return utils
}

describe('SetColorDialog reset', () => {
  it('clears both slots on a display with a UTR color', () => {
    const { setColorValue, setUtrColor } = setup(true)
    expect(setColorValue).toHaveBeenCalledWith(undefined)
    expect(setUtrColor).toHaveBeenCalledWith(undefined)
  })

  it('offers no UTR picker on a display without one', () => {
    const { setColorValue, setUtrColor, queryByText } = setup(false)
    expect(setColorValue).toHaveBeenCalledWith(undefined)
    expect(setUtrColor).not.toHaveBeenCalled()
    expect(queryByText(/UTR color/)).toBeNull()
  })
})

test('names the track expression a picked color replaces', () => {
  const expr = "jexl:get(feature,'type')=='gene'?'red':'blue'"
  expect(renderDialog(true, expr).getByText(expr)).toBeTruthy()
})

test('a constant color needs no note', () => {
  expect(renderDialog(true, 'purple').queryByText(/replaces/)).toBeNull()
})
