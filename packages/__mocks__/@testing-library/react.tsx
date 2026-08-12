import { Suspense } from 'react'

import { ThemeProvider, createTheme } from '@mui/material/styles'

// One consequence worth knowing, because it makes a test pass while proving
// nothing: a `<Suspense>` boundary ABOVE a `<StrictMode>` suppresses
// StrictMode's simulated remount, and this wrapper puts one there for every
// `render` in the repo. So an effect that would run setup/cleanup/setup in a
// real StrictMode app runs setup once here. Anything testing remount behaviour
// has to drive `createRoot` itself — see
// `packages/product-core/src/useEngineLifecycle.test.tsx`.
const react = jest.requireActual('@testing-library/react')
const render = (args: React.ReactNode) => {
  return react.render(
    <Suspense fallback={null}>
      <ThemeProvider theme={createTheme()}>{args}</ThemeProvider>
    </Suspense>,
  )
}

module.exports = { ...react, render }
