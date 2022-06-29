import { createTheme, ThemeProvider } from '@mui/material/styles'
// eslint-disable-next-line import/no-extraneous-dependencies
import React from 'react'

const react = jest.requireActual('@testing-library/react')
const render = args => {
  return react.render(
    <ThemeProvider theme={createTheme()}>{args}</ThemeProvider>,
  )
}

module.exports = { ...react, render }
