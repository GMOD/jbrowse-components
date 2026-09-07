import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import SingleSlider from './SingleSlider.tsx'
import { createJBrowseThemeFromArgs } from './theme.ts'

function sliderColor(themeName: string) {
  const { container } = render(
    <ThemeProvider theme={createJBrowseThemeFromArgs({ themeName })}>
      <SingleSlider value={0.2} min={0} max={1} step={0.01} />
    </ThemeProvider>,
  )
  const root = container.querySelector('.MuiSlider-root')!
  return getComputedStyle(root).color
}

test('the dark theme does not paint the slider in midnight', () => {
  expect(sliderColor('darkStock')).toBe('rgba(255, 255, 255, 0.7)')
})

test('the light theme keeps the primary color', () => {
  expect(sliderColor('lightStock')).toBe('rgb(13, 35, 63)')
})
