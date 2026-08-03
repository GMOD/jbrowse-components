import { createContext, useContext } from 'react'

import { resolvePalette } from './palette.ts'

import type { JBrowsePalette } from './palette.ts'
import type { ReactNode } from 'react'

/**
 * How a React component asks for JBrowse's colors.
 *
 * This is the toolkit-free counterpart to Material UI's `useTheme`, and it is
 * the seam that lets a display component render without Material UI at all: a
 * display reads `usePalette()` for its content colors, and an embedding app
 * supplies them by mounting `PaletteProvider` rather than a `ThemeProvider`.
 *
 * JBrowse's own products mount both, from the same session, so the Material UI
 * chrome and the display content cannot disagree.
 *
 * With no provider above it this falls back to the default palette, mirroring
 * `useTheme`'s fall back to the default theme. That keeps a bare display
 * mountable in a test or a minimal host without ceremony.
 */
const PaletteContext = createContext<JBrowsePalette | undefined>(undefined)

export function PaletteProvider({
  palette,
  children,
}: {
  palette: JBrowsePalette
  children: ReactNode
}) {
  return (
    <PaletteContext.Provider value={palette}>
      {children}
    </PaletteContext.Provider>
  )
}

// resolved once rather than per call: the default palette is a pure function of
// no arguments, and a fresh object each render would defeat memoization in
// every consumer that depends on palette identity
const defaultPalette = resolvePalette()

export function usePalette(): JBrowsePalette {
  return useContext(PaletteContext) ?? defaultPalette
}
