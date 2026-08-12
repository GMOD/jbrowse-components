import { Suspense } from 'react'

import { ThemeProvider, createTheme } from '@mui/material/styles'

// Every `render` in the repo gets a MUI theme and a Suspense boundary, so no
// test has to supply either for a themed or lazily-imported component.
//
// One consequence worth knowing, because it makes a test pass while proving
// nothing: React only runs StrictMode's simulated remount when `<StrictMode>` is
// the ROOT element of the render, and these wrappers sit above it. So
// `render(<StrictMode><Thing/></StrictMode>)` runs setup once here where a real
// StrictMode app runs setup/cleanup/setup. It is NOT Suspense specifically —
// measured, a bare `<div>` in that position suppresses it just the same, as does
// the ThemeProvider — so removing the boundary does not buy the behaviour back.
//
// The fix is RTL's own option, which wraps at the root, above these:
//
//     render(<Thing />, { reactStrictMode: true })
//
// which is why `options` is forwarded rather than dropped. `useCreateOnce` /
// `useFinalUnmount` in `packages/core/src/util/hooks.ts` are what that mode is
// worth testing against.
const react = jest.requireActual('@testing-library/react')
const render = (args: React.ReactNode, options?: unknown) => {
  return react.render(
    <Suspense fallback={null}>
      <ThemeProvider theme={createTheme()}>{args}</ThemeProvider>
    </Suspense>,
    options,
  )
}

module.exports = { ...react, render }
