import { createTheme, ThemeProvider } from '@mui/material/styles'

import React, { Suspense } from 'react'

const react = jest.requireActual('@testing-library/react')
const render = (args: React.ReactNode) => {
  return react.render(
    <Suspense fallback={<div />}>
      <ThemeProvider theme={createTheme()}>{args}</ThemeProvider>
    </Suspense>,
  )
}

module.exports = { ...react, render }
