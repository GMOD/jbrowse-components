import React, { Suspense } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'

const react = jest.requireActual('@testing-library/react')
const render = (args: React.ReactNode) => {
  return react.render(
    <Suspense fallback={null}>
      <ThemeProvider theme={createTheme()}>{args}</ThemeProvider>
    </Suspense>,
  )
}

module.exports = { ...react, render }
