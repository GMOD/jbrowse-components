import { createTheme, ThemeProvider } from '@mui/material/styles'

import React from 'react'

const react = jest.requireActual('@testing-library/react')
const render = (args: React.ReactNode) => {
  return react.render(
    <ThemeProvider theme={createTheme()}>{args}</ThemeProvider>,
  )
}

module.exports = { ...react, render }
