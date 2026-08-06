import { createContext, useContext, useEffect } from 'react'

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

/** What {@link useSessionPalette} needs of a session. */
export interface ThemeModeSession {
  setThemeMode: (mode: 'light' | 'dark') => void
  readonly palette: JBrowsePalette
}

/**
 * Point a session at light or dark and get back the palette it resolves to,
 * for a host following its own dark-mode state. Feed the result to
 * `PaletteProvider`:
 *
 * ```tsx
 * const palette = useSessionPalette(session, myAppIsDark ? 'dark' : 'light')
 * return <PaletteProvider palette={palette}>{tracks}</PaletteProvider>
 * ```
 *
 * How the host knows its own mode is the host's business — an attribute on
 * `<html>`, a `prefers-color-scheme` media query, a design-system context —
 * and deliberately not this hook's.
 *
 * **Reaching for `PaletteProvider` alone is the trap this exists to close.**
 * The palette is what *React* draws with; the config `theme` slot is also what
 * ships to the RPC worker, where feature labels are baked into the rendered
 * image. Supply only the first and those labels stay in the old mode — light
 * text on a light image, and no error anywhere. `setThemeMode` writes the one
 * slot both are derived from, which is why this returns the palette rather
 * than taking one.
 *
 * The write lands in an effect, so the first paint after a mode change uses
 * the previous palette. That is a frame on a canvas that is about to be
 * redrawn anyway; it is not somewhere to add a suspense boundary.
 */
export function useSessionPalette(
  session: ThemeModeSession,
  mode: 'light' | 'dark',
): JBrowsePalette {
  useEffect(() => {
    session.setThemeMode(mode)
  }, [session, mode])
  return session.palette
}
