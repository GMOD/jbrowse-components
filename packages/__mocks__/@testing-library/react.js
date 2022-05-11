import { StylesProvider } from '@mui/styles'
import { createTheme, ThemeProvider } from '@mui/material/styles'
// eslint-disable-next-line import/no-extraneous-dependencies
import React from 'react'

const react = jest.requireActual('@testing-library/react')
const generateClassName = (rule, styleSheet) =>
  `${styleSheet.options.classNamePrefix}-${rule.key}`
const render = args => {
  return react.render(
    <ThemeProvider theme={createTheme()}>
      <StylesProvider generateClassName={generateClassName}>
        {args}
      </StylesProvider>
    </ThemeProvider>,
  )
}

module.exports = { ...react, render }
